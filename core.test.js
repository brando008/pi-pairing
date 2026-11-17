const test = require('node:test')
const assert = require('node:assert/strict')
const Core = require('./core.js')

function createTwoProjectState() {
    const state = Core.createInitialState()

    Core.addProject(state, 'project-1', 'Ignite')
    Core.addProject(state, 'project-2', 'Campus')

    return state
}

function createChecklistState() {
    const state = createTwoProjectState()

    Core.addChecklist(state, 'project-1', 'checklist-1', 'Backend')

    return state
}

function createItemState() {
    const state = createChecklistState()

    Core.addItem(state, 'project-1', 'checklist-1', 'item-1', 'Write endpoint')

    return state
}

test('the initial state has a monotonic revision counter', () => {
    const state = Core.createInitialState()

    assert.equal(state.version, 3)
    assert.equal(state.revision, 0)
})

test('version one state is migrated with a zero revision', () => {
    const restored = Core.parseState(
        JSON.stringify({
            version: 1,
            activeProjectId: null,
            projects: []
        })
    )

    assert.equal(restored.version, 3)
    assert.equal(restored.revision, 0)
})

test('parsing rejects a negative revision', () => {
    const state = Core.createInitialState()
    state.revision = -1

    assert.throws(
        () => Core.parseState(Core.serializeState(state)),
        /revision/i
    )
})

function createResearchState() {
    const state = Core.createInitialState()
    Core.addProject(state, 'project-1', 'Campus')
    return state
}

test('beginning research creates a round and moves the loop to Research', () => {
    const state = createResearchState()

    Core.beginResearch(
        state,
        'project-1',
        'Add attendance validation',
        'research-1'
    )
    const project = state.projects[0]

    assert.equal(project.research.rounds.length, 1)
    assert.equal(project.research.activeRoundId, 'research-1')
    assert.equal(project.research.rounds[0].problem, 'Add attendance validation')
    assert.equal(project.research.rounds[0].status, 'open')
    assert.equal(project.currentLoopStep, 1)
})

test('research entries accept findings, questions, and decisions', () => {
    const state = createResearchState()
    Core.beginResearch(state, 'project-1', 'Problem', 'research-1')

    Core.addResearchEntry(state, 'project-1', {
        id: 'entry-1',
        kind: 'finding',
        title: 'Corrections must be append-only',
        explanation: 'Audit requirements forbid mutation.',
        sources: [{ label: 'Audit spec', location: 'docs/audit.md' }],
        confidence: 'high',
        relatedItemIds: []
    })
    Core.addResearchEntry(state, 'project-1', {
        id: 'entry-2',
        kind: 'question',
        title: 'How long are records retained?',
        explanation: 'Not answered yet.',
        sources: [],
        confidence: 'low',
        relatedItemIds: []
    })

    const round = Core.getResearchRound(state.projects[0])

    assert.equal(round.entries.length, 2)
    assert.equal(round.entries[0].kind, 'finding')
    assert.equal(round.entries[0].sources[0].location, 'docs/audit.md')
    assert.equal(round.entries[1].kind, 'question')
})

test('a research finding requires at least one source', () => {
    const state = createResearchState()
    Core.beginResearch(state, 'project-1', 'Problem', 'research-1')

    assert.throws(
        () =>
            Core.addResearchEntry(state, 'project-1', {
                id: 'entry-1',
                kind: 'finding',
                title: 'Unsourced claim',
                explanation: 'No evidence attached.',
                sources: [],
                confidence: 'medium',
                relatedItemIds: []
            }),
        /source/i
    )
})

test('a no-research-needed entry requires an explanation', () => {
    const state = createResearchState()
    Core.beginResearch(state, 'project-1', 'Problem', 'research-1')

    assert.throws(
        () =>
            Core.addResearchEntry(state, 'project-1', {
                id: 'entry-1',
                kind: 'no-research-needed',
                title: 'Routine local change',
                explanation: '   ',
                sources: [],
                confidence: 'high',
                relatedItemIds: []
            }),
        /explanation/i
    )
})

test('confirming research requires a qualifying entry and advances the loop', () => {
    const state = createResearchState()
    Core.beginResearch(state, 'project-1', 'Problem', 'research-1')

    assert.throws(
        () => Core.confirmResearch(state, 'project-1'),
        /finding|no-research/i
    )

    Core.addResearchEntry(state, 'project-1', {
        id: 'entry-1',
        kind: 'finding',
        title: 'Documented constraint',
        explanation: 'The audit spec requires append-only corrections.',
        sources: [{ label: 'Audit spec', location: 'https://example.com/audit' }],
        confidence: 'high',
        relatedItemIds: []
    })
    Core.confirmResearch(state, 'project-1')

    const project = state.projects[0]
    const round = Core.getResearchRound(project)

    assert.equal(round.status, 'confirmed')
    assert.ok(round.concludedAt)
    assert.equal(project.currentLoopStep, 2)
})

test('skipping research requires a reason and records a visible warning', () => {
    const state = createResearchState()
    Core.beginResearch(state, 'project-1', 'Problem', 'research-1')

    assert.throws(
        () => Core.skipResearch(state, 'project-1', '   '),
        /reason/i
    )

    const result = Core.skipResearch(state, 'project-1', 'Existing incident review')
    const project = state.projects[0]
    const round = Core.getResearchRound(project)

    assert.equal(result.warning, 'Research was skipped: Existing incident review')
    assert.equal(round.status, 'skipped')
    assert.equal(round.reason, 'Existing incident review')
    assert.equal(round.entries[0].kind, 'skipped')
    assert.equal(project.currentLoopStep, 2)
})

test('the loop cannot advance past Research before the gate is satisfied', () => {
    const state = createResearchState()
    Core.beginResearch(state, 'project-1', 'Problem', 'research-1')

    assert.throws(
        () => Core.setLoopStep(state, 'project-1', 2),
        /research/i
    )

    Core.addResearchEntry(state, 'project-1', {
        id: 'entry-1',
        kind: 'no-research-needed',
        title: 'Routine local change',
        explanation: 'The change only touches one local module.',
        sources: [],
        confidence: 'high',
        relatedItemIds: []
    })
    Core.confirmResearch(state, 'project-1')

    assert.equal(state.projects[0].currentLoopStep, 2)
})

test('version two state migrates into an open research round', () => {
    const legacyState = {
        version: 2,
        revision: 4,
        activeProjectId: 'project-1',
        projects: [
            {
                id: 'project-1',
                name: 'Campus',
                currentLoopStep: 3,
                activeChecklistId: null,
                checklists: []
            }
        ]
    }

    const restored = Core.parseState(JSON.stringify(legacyState))
    const project = restored.projects[0]

    assert.equal(restored.version, 3)
    assert.equal(project.currentLoopStep, 1)
    assert.equal(project.research.rounds.length, 1)
    assert.equal(project.research.rounds[0].status, 'open')
    assert.equal(project.research.activeRoundId, project.research.rounds[0].id)
})

test('parsing rejects invalid research data', () => {
    const state = createResearchState()
    Core.beginResearch(state, 'project-1', 'Problem', 'research-1')

    const invalidKind = Core.parseState(Core.serializeState(state))
    invalidKind.projects[0].research.rounds[0].entries.push({
        id: 'entry-1',
        kind: 'invented',
        title: 'Bad',
        explanation: 'Bad',
        sources: [],
        confidence: 'high',
        relatedItemIds: []
    })

    assert.throws(
        () => Core.parseState(Core.serializeState(invalidKind)),
        /research/i
    )
})

test('adding the first project makes it active', () => {
    const state = Core.createInitialState()
    const result = Core.addProject(state, 'project-1', 'Ignite')

    assert.equal(result.projects.length, 1)
    assert.equal(result.projects[0].name, 'Ignite')
    assert.equal(result.activeProjectId, 'project-1')
})

test('adding another project keeps the current active project', () => {
    const state = createTwoProjectState()

    assert.equal(state.activeProjectId, 'project-1')
    assert.equal(state.projects.length, 2)
})

test('rejects a blank project name', () => {
    const state = Core.createInitialState()

    assert.throws(
        () => Core.addProject(state, 'project-1', '   '),
        /project name cannot be blank/i
    )
    assert.equal(state.projects.length, 0)
})

test('renaming a project replaces its name and removes surrounding whitespace', () => {
    const state = createTwoProjectState()
    const result = Core.renameProject(state, 'project-1', '   Ignite API  ')

    assert.equal(result.projects[0].name, 'Ignite API')
})

test('rejecting a blank project rename preserves the existing name', () => {
    const state = createTwoProjectState()

    assert.throws(
        () => Core.renameProject(state, 'project-1', '   '),
        /project name cannot be blank/i
    )
    assert.equal(state.projects[0].name, 'Ignite')
})

test('renaming an unknown project throws an error', () => {
    const state = createTwoProjectState()

    assert.throws(
        () => Core.renameProject(state, 'missing', 'New name'),
        /Project not found/i
    )
})

test('selecting an existing project makes it active', () => {
    const state = createTwoProjectState()
    const result = Core.setActiveProject(state, 'project-2')

    assert.equal(result.activeProjectId, 'project-2')
})

test('selecting an unknown project throws an error', () => {
    const state = createTwoProjectState()

    assert.throws(
        () => Core.setActiveProject(state, 'project-3'),
        /Project not found/i
    )
})

test('deleting a non-active project keeps the active project selected', () => {
    const state = createTwoProjectState()
    const result = Core.deleteProject(state, 'project-2')

    assert.equal(result.projects.length, 1)
    assert.equal(result.projects[0].id, 'project-1')
    assert.equal(result.activeProjectId, 'project-1')
})

test('deleting the active project selects the first remaining project', () => {
    const state = createTwoProjectState()
    Core.setActiveProject(state, 'project-2')

    const result = Core.deleteProject(state, 'project-2')

    assert.equal(result.projects.length, 1)
    assert.equal(result.projects[0].id, 'project-1')
    assert.equal(result.activeProjectId, 'project-1')
})

test('deleting the only project clears the active project', () => {
    const state = Core.createInitialState()
    Core.addProject(state, 'project-1', 'Ignite')

    const result = Core.deleteProject(state, 'project-1')

    assert.equal(result.projects.length, 0)
    assert.equal(result.activeProjectId, null)
})

test('deleting an unknown project throws an error', () => {
    const state = createTwoProjectState()

    assert.throws(
        () => Core.deleteProject(state, 'missing'),
        /Project not found/i
    )
})

test('adding the first checklist makes it active', () => {
    const state = createTwoProjectState()
    const result = Core.addChecklist(
        state,
        'project-1',
        'checklist-1',
        'Backend'
    )
    const project = result.projects[0]

    assert.equal(project.checklists.length, 1)
    assert.equal(project.activeChecklistId, 'checklist-1')
})

test('adding another checklist keeps the current active checklist', () => {
    const state = createChecklistState()
    Core.addChecklist(state, 'project-1', 'checklist-2', 'Frontend')

    const project = state.projects[0]

    assert.equal(project.checklists.length, 2)
    assert.equal(project.activeChecklistId, 'checklist-1')
})

test('rejects a blank checklist name', () => {
    const state = createTwoProjectState()

    assert.throws(
        () => Core.addChecklist(state, 'project-1', 'checklist-1', '  '),
        /checklist name cannot be blank/i
    )
})

test('renaming a checklist trims its new name', () => {
    const state = createChecklistState()
    const result = Core.renameChecklist(
        state,
        'project-1',
        'checklist-1',
        '  Database  '
    )

    assert.equal(result.projects[0].checklists[0].name, 'Database')
})

test('selecting a checklist makes it active', () => {
    const state = createChecklistState()
    Core.addChecklist(state, 'project-1', 'checklist-2', 'Frontend')

    const result = Core.setActiveChecklist(
        state,
        'project-1',
        'checklist-2'
    )

    assert.equal(result.projects[0].activeChecklistId, 'checklist-2')
})

test('deleting the active checklist selects the first remaining checklist', () => {
    const state = createChecklistState()
    Core.addChecklist(state, 'project-1', 'checklist-2', 'Frontend')
    Core.setActiveChecklist(state, 'project-1', 'checklist-2')

    const result = Core.deleteChecklist(
        state,
        'project-1',
        'checklist-2'
    )
    const project = result.projects[0]

    assert.equal(project.checklists.length, 1)
    assert.equal(project.activeChecklistId, 'checklist-1')
})

test('deleting the only checklist clears the active checklist', () => {
    const state = createChecklistState()
    const result = Core.deleteChecklist(
        state,
        'project-1',
        'checklist-1'
    )

    assert.equal(result.projects[0].checklists.length, 0)
    assert.equal(result.projects[0].activeChecklistId, null)
})

test('deleting an unknown checklist throws an error', () => {
    const state = createChecklistState()

    assert.throws(
        () => Core.deleteChecklist(state, 'project-1', 'missing'),
        /Checklist not found/i
    )
})

test('adding an item appends it to the checklist', () => {
    const state = createChecklistState()
    const result = Core.addItem(
        state,
        'project-1',
        'checklist-1',
        'item-1',
        'Write endpoint'
    )
    const checklist = result.projects[0].checklists[0]

    assert.equal(checklist.items.length, 1)
    assert.equal(checklist.items[0].text, 'Write endpoint')
    assert.equal(checklist.items[0].completed, false)
})

test('rejects a blank item name', () => {
    const state = createChecklistState()

    assert.throws(
        () => Core.addItem(
            state,
            'project-1',
            'checklist-1',
            'item-1',
            '   '
        ),
        /item name cannot be blank/i
    )
})

test('renaming an item trims its new text', () => {
    const state = createItemState()
    const result = Core.renameItem(
        state,
        'project-1',
        'checklist-1',
        'item-1',
        '  Write handler  '
    )
    const item = result.projects[0].checklists[0].items[0]

    assert.equal(item.text, 'Write handler')
})

test('setting item completion updates only that item', () => {
    const state = createItemState()
    Core.addItem(state, 'project-1', 'checklist-1', 'item-2', 'Write tests')

    const result = Core.setItemCompleted(
        state,
        'project-1',
        'checklist-1',
        'item-1',
        true
    )
    const items = result.projects[0].checklists[0].items

    assert.equal(items[0].completed, true)
    assert.equal(items[1].completed, false)
})

test('moving an item up swaps it with the previous item', () => {
    const state = createItemState()
    Core.addItem(state, 'project-1', 'checklist-1', 'item-2', 'Write tests')

    const result = Core.moveItem(
        state,
        'project-1',
        'checklist-1',
        'item-2',
        'up'
    )
    const items = result.projects[0].checklists[0].items

    assert.equal(items[0].id, 'item-2')
    assert.equal(items[1].id, 'item-1')
})

test('moving an item beyond a boundary leaves it in place', () => {
    const state = createItemState()
    const result = Core.moveItem(
        state,
        'project-1',
        'checklist-1',
        'item-1',
        'up'
    )
    const items = result.projects[0].checklists[0].items

    assert.equal(items[0].id, 'item-1')
})

test('deleting an item removes only that item', () => {
    const state = createItemState()
    Core.addItem(state, 'project-1', 'checklist-1', 'item-2', 'Write tests')

    const result = Core.deleteItem(
        state,
        'project-1',
        'checklist-1',
        'item-1'
    )
    const items = result.projects[0].checklists[0].items

    assert.equal(items.length, 1)
    assert.equal(items[0].id, 'item-2')
})

test('the pairing loop contains the eight fixed steps in order', () => {
    assert.deepEqual(
        Core.LOOP_STEPS.map((step) => step.label),
        [
            'Problem',
            'Research',
            'Inspection and Explanation',
            'Steps',
            'Changes',
            'Help',
            'Review',
            'Recap'
        ]
    )
})

test('setting a loop step updates only the selected project', () => {
    const state = createTwoProjectState()
    Core.beginResearch(state, 'project-2', 'Problem', 'research-1')
    Core.addResearchEntry(state, 'project-2', {
        id: 'entry-1',
        kind: 'finding',
        title: 'Documented constraint',
        explanation: 'The source explains the constraint.',
        sources: [{ label: 'Spec', location: 'docs/spec.md' }],
        confidence: 'high',
        relatedItemIds: []
    })
    Core.confirmResearch(state, 'project-2')

    const result = Core.setLoopStep(state, 'project-2', 3)

    assert.equal(result.projects[0].currentLoopStep, 0)
    assert.equal(result.projects[1].currentLoopStep, 3)
})

test('rejecting an invalid loop step preserves the current step', () => {
    const state = createTwoProjectState()

    assert.throws(
        () => Core.setLoopStep(state, 'project-1', 99),
        /Loop step/i
    )
    assert.equal(state.projects[0].currentLoopStep, 0)
})

test('serialized state can be parsed and restored', () => {
    const state = createItemState()
    Core.setItemCompleted(state, 'project-1', 'checklist-1', 'item-1', true)

    const restored = Core.parseState(Core.serializeState(state))

    assert.deepEqual(restored, state)
})

test('parsing malformed JSON throws an error', () => {
    assert.throws(
        () => Core.parseState('{not json'),
        /parse saved data/i
    )
})

test('parsing an unsupported state version throws an error', () => {
    const state = Core.createInitialState()
    state.version = 999

    assert.throws(
        () => Core.parseState(JSON.stringify(state)),
        /version/i
    )
})

test('parsing state with an invalid active project reference throws an error', () => {
    const state = Core.createInitialState()
    state.activeProjectId = 'missing'

    assert.throws(
        () => Core.parseState(JSON.stringify(state)),
        /active project/i
    )
})

test('parsing state with an invalid active checklist reference throws an error', () => {
    const state = Core.createInitialState()
    Core.addProject(state, 'project-1', 'Ignite')
    state.projects[0].activeChecklistId = 'missing'

    assert.throws(
        () => Core.parseState(JSON.stringify(state)),
        /active checklist/i
    )
})

test('creating IDs adds the requested prefix and keeps IDs unique', () => {
    const first = Core.createId('project')
    const second = Core.createId('project')

    assert.match(first, /^project-/)
    assert.notEqual(first, second)
})

test('project IDs are trimmed when a project is created', () => {
    const state = Core.createInitialState()
    const result = Core.addProject(state, '  project-1  ', 'Ignite')

    assert.equal(result.projects[0].id, 'project-1')
})

test('parsing projects without an active project selects the first project', () => {
    const state = Core.createInitialState()
    Core.addProject(state, 'project-1', 'Ignite')
    state.activeProjectId = null

    const restored = Core.parseState(Core.serializeState(state))

    assert.equal(restored.activeProjectId, 'project-1')
})

test('parsing checklists without an active checklist selects the first checklist', () => {
    const state = Core.createInitialState()
    Core.addProject(state, 'project-1', 'Ignite')
    Core.addChecklist(state, 'project-1', 'checklist-1', 'Backend')
    state.projects[0].activeChecklistId = null

    const restored = Core.parseState(Core.serializeState(state))

    assert.equal(restored.projects[0].activeChecklistId, 'checklist-1')
})

test('moving an item down swaps it with the next item', () => {
    const state = createItemState()
    Core.addItem(state, 'project-1', 'checklist-1', 'item-2', 'Write tests')

    const result = Core.moveItem(
        state,
        'project-1',
        'checklist-1',
        'item-1',
        'down'
    )
    const items = result.projects[0].checklists[0].items

    assert.equal(items[0].id, 'item-2')
    assert.equal(items[1].id, 'item-1')
})

test('moving an item rejects an unknown direction', () => {
    const state = createItemState()

    assert.throws(
        () =>
            Core.moveItem(
                state,
                'project-1',
                'checklist-1',
                'item-1',
                'sideways'
            ),
        /direction must be up or down/i
    )
})

test('setting item completion rejects a non-boolean value', () => {
    const state = createItemState()

    assert.throws(
        () =>
            Core.setItemCompleted(
                state,
                'project-1',
                'checklist-1',
                'item-1',
                'yes'
            ),
        /completion must be true or false/i
    )
})

test('adding entities rejects duplicate IDs', () => {
    const state = createItemState()

    assert.throws(
        () => Core.addProject(state, 'project-1', 'Duplicate'),
        /project ID already exists/i
    )
    assert.throws(
        () =>
            Core.addChecklist(
                state,
                'project-1',
                'checklist-1',
                'Duplicate'
            ),
        /checklist ID already exists/i
    )
    assert.throws(
        () =>
            Core.addItem(
                state,
                'project-1',
                'checklist-1',
                'item-1',
                'Duplicate'
            ),
        /item ID already exists/i
    )
})

test('parsing state rejects duplicate entity IDs', () => {
    const duplicateProject = Core.createInitialState()
    Core.addProject(duplicateProject, 'project-1', 'Ignite')
    Core.addProject(duplicateProject, 'project-2', 'Duplicate')
    duplicateProject.projects[1].id = 'project-1'

    assert.throws(
        () => Core.parseState(Core.serializeState(duplicateProject)),
        /duplicate project ID/i
    )

    const duplicateChecklist = Core.createInitialState()
    Core.addProject(duplicateChecklist, 'project-1', 'Ignite')
    Core.addChecklist(
        duplicateChecklist,
        'project-1',
        'checklist-1',
        'Backend'
    )
    Core.addChecklist(
        duplicateChecklist,
        'project-1',
        'checklist-2',
        'Duplicate'
    )
    duplicateChecklist.projects[0].checklists[1].id = 'checklist-1'

    assert.throws(
        () => Core.parseState(Core.serializeState(duplicateChecklist)),
        /duplicate checklist ID/i
    )

    const duplicateItem = Core.createInitialState()
    Core.addProject(duplicateItem, 'project-1', 'Ignite')
    Core.addChecklist(duplicateItem, 'project-1', 'checklist-1', 'Backend')
    Core.addItem(
        duplicateItem,
        'project-1',
        'checklist-1',
        'item-1',
        'First'
    )
    Core.addItem(
        duplicateItem,
        'project-1',
        'checklist-1',
        'item-2',
        'Duplicate'
    )
    duplicateItem.projects[0].checklists[0].items[1].id = 'item-1'

    assert.throws(
        () => Core.parseState(Core.serializeState(duplicateItem)),
        /duplicate item ID/i
    )
})

test('item operations reject an unknown item', () => {
    const state = createChecklistState()

    assert.throws(
        () =>
            Core.renameItem(
                state,
                'project-1',
                'checklist-1',
                'missing',
                'New text'
            ),
        /item not found/i
    )
    assert.throws(
        () =>
            Core.deleteItem(
                state,
                'project-1',
                'checklist-1',
                'missing'
            ),
        /item not found/i
    )
    assert.throws(
        () =>
            Core.moveItem(
                state,
                'project-1',
                'checklist-1',
                'missing',
                'up'
            ),
        /item not found/i
    )
})
