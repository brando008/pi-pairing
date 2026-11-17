const test = require('node:test')
const assert = require('node:assert/strict')
const Core = require('./core.js')
const Commands = require('./commands.js')

function createProjectState() {
    const state = Core.createInitialState()

    Core.addProject(state, 'project-1', 'Campus')
    Core.addProject(state, 'project-2', 'Ignite')

    return state
}

function createChecklistState() {
    const state = createProjectState()

    Core.addChecklist(state, 'project-1', 'checklist-1', 'Current Work')

    return state
}

test('adding a project creates and activates it', () => {
    const state = Core.createInitialState()
    const result = Commands.applyCommand(state, {
        type: 'project.add',
        payload: { name: 'Campus' }
    })

    assert.equal(result.state.projects.length, 1)
    assert.equal(result.state.activeProjectId, 'project-1')
    assert.equal(result.result.project.name, 'Campus')
})

test('adding a project with an existing name selects the existing project', () => {
    const state = createProjectState()
    const result = Commands.applyCommand(state, {
        type: 'project.add',
        payload: { name: 'ignite' }
    })

    assert.equal(result.state.projects.length, 2)
    assert.equal(result.state.activeProjectId, 'project-2')
})

test('selecting a project resolves by ID or case-insensitive name', () => {
    const state = createProjectState()

    Commands.applyCommand(state, {
        type: 'project.select',
        payload: { nameOrId: 'ignite' }
    })

    assert.equal(state.activeProjectId, 'project-2')
})

test('renaming and deleting a project update shared state', () => {
    const state = createProjectState()

    Commands.applyCommand(state, {
        type: 'project.rename',
        payload: { nameOrId: 'Campus', name: 'Campus App' }
    })
    assert.equal(state.projects[0].name, 'Campus App')

    Commands.applyCommand(state, {
        type: 'project.delete',
        payload: { nameOrId: 'Campus App' }
    })
    assert.equal(state.projects.length, 1)
})

test('adding a checklist creates and activates it', () => {
    const state = createProjectState()
    const result = Commands.applyCommand(state, {
        type: 'checklist.add',
        payload: { project: 'Campus', name: 'Backend' }
    })

    assert.equal(result.state.projects[0].checklists.length, 1)
    assert.equal(result.state.projects[0].activeChecklistId, 'checklist-1')
})

test('adding an existing checklist selects it without duplication', () => {
    const state = createChecklistState()
    const result = Commands.applyCommand(state, {
        type: 'checklist.add',
        payload: { project: 'Campus', name: 'current work' }
    })

    assert.equal(result.state.projects[0].checklists.length, 1)
    assert.equal(result.state.projects[0].activeChecklistId, 'checklist-1')
})

test('renaming, selecting, and deleting a checklist update shared state', () => {
    const state = createChecklistState()

    Commands.applyCommand(state, {
        type: 'checklist.rename',
        payload: { project: 'Campus', nameOrId: 'Current Work', name: 'API Work' }
    })
    assert.equal(state.projects[0].checklists[0].name, 'API Work')

    Commands.applyCommand(state, {
        type: 'checklist.select',
        payload: { project: 'Campus', nameOrId: 'API Work' }
    })
    assert.equal(state.projects[0].activeChecklistId, 'checklist-1')

    Commands.applyCommand(state, {
        type: 'checklist.delete',
        payload: { project: 'Campus', nameOrId: 'API Work' }
    })
    assert.equal(state.projects[0].checklists.length, 0)
})

test('adding an item appends it and is idempotent for the same text', () => {
    const state = createChecklistState()
    const first = Commands.applyCommand(state, {
        type: 'item.add',
        payload: {
            project: 'Campus',
            checklist: 'Current Work',
            text: 'Inspect the API'
        }
    })
    const second = Commands.applyCommand(state, {
        type: 'item.add',
        payload: {
            project: 'Campus',
            checklist: 'Current Work',
            text: 'Inspect the API'
        }
    })

    assert.equal(first.result.item.id, 'item-1')
    assert.equal(second.result.item.id, 'item-1')
    assert.equal(state.projects[0].checklists[0].items.length, 1)
})

test('completing and reopening an item updates shared state', () => {
    const state = createChecklistState()
    Commands.applyCommand(state, {
        type: 'item.add',
        payload: {
            project: 'Campus',
            checklist: 'Current Work',
            text: 'Inspect the API'
        }
    })

    Commands.applyCommand(state, {
        type: 'item.complete',
        payload: {
            project: 'Campus',
            checklist: 'Current Work',
            item: 'Inspect the API',
            completed: true
        }
    })
    assert.equal(state.projects[0].checklists[0].items[0].completed, true)

    Commands.applyCommand(state, {
        type: 'item.complete',
        payload: {
            project: 'Campus',
            checklist: 'Current Work',
            item: 'Inspect the API',
            completed: false
        }
    })
    assert.equal(state.projects[0].checklists[0].items[0].completed, false)
})

test('renaming an item updates shared state', () => {
    const state = createChecklistState()
    Commands.applyCommand(state, {
        type: 'item.add',
        payload: {
            project: 'Campus',
            checklist: 'Current Work',
            text: 'Inspect the API'
        }
    })

    Commands.applyCommand(state, {
        type: 'item.rename',
        payload: {
            project: 'Campus',
            checklist: 'Current Work',
            item: 'Inspect the API',
            text: 'Inspect the endpoint'
        }
    })

    assert.equal(
        state.projects[0].checklists[0].items[0].text,
        'Inspect the endpoint'
    )
})

test('deleting and moving an item update shared state', () => {
    const state = createChecklistState()
    Commands.applyCommand(state, {
        type: 'item.add',
        payload: {
            project: 'Campus',
            checklist: 'Current Work',
            text: 'First'
        }
    })
    Commands.applyCommand(state, {
        type: 'item.add',
        payload: {
            project: 'Campus',
            checklist: 'Current Work',
            text: 'Second'
        }
    })

    Commands.applyCommand(state, {
        type: 'item.move',
        payload: {
            project: 'Campus',
            checklist: 'Current Work',
            item: 'Second',
            direction: 'up'
        }
    })
    assert.equal(state.projects[0].checklists[0].items[0].text, 'Second')

    Commands.applyCommand(state, {
        type: 'item.delete',
        payload: {
            project: 'Campus',
            checklist: 'Current Work',
            item: 'First'
        }
    })
    assert.equal(state.projects[0].checklists[0].items.length, 1)
})

test('setting a loop step accepts its label or one-based position', () => {
    const state = createProjectState()
    Commands.applyCommand(state, {
        type: 'research.begin',
        payload: { project: 'Campus', problem: 'Problem' }
    })
    Commands.applyCommand(state, {
        type: 'research.add',
        payload: {
            project: 'Campus',
            kind: 'finding',
            title: 'Documented constraint',
            explanation: 'The source explains the constraint.',
            sources: [{ label: 'Spec', location: 'docs/spec.md' }],
            confidence: 'high',
            relatedItemIds: []
        }
    })
    Commands.applyCommand(state, {
        type: 'research.confirm',
        payload: { project: 'Campus' }
    })

    Commands.applyCommand(state, {
        type: 'loop.set',
        payload: { project: 'Campus', step: 'Inspection and Explanation' }
    })
    assert.equal(state.projects[0].currentLoopStep, 2)

    Commands.applyCommand(state, {
        type: 'loop.set',
        payload: { project: 'Campus', step: 4 }
    })
    assert.equal(state.projects[0].currentLoopStep, 3)
})

test('replacing shared state validates and replaces empty current state', () => {
    const state = Core.createInitialState()
    const replacement = Core.createInitialState()
    Core.addProject(replacement, 'project-new', 'New Project')

    const result = Commands.applyCommand(state, {
        type: 'state.replace',
        payload: {
            state: replacement,
            expectedRevision: state.revision
        }
    })

    assert.equal(result.state.projects.length, 1)
    assert.equal(result.state.projects[0].name, 'New Project')
    assert.equal(state.projects.length, 1)
    assert.equal(state.projects[0].name, 'New Project')
})

test('replacing shared state rejects non-empty or concurrently changed state', () => {
    const state = createProjectState()
    const replacement = Core.createInitialState()

    assert.throws(
        () =>
            Commands.applyCommand(state, {
                type: 'state.replace',
                payload: {
                    state: replacement,
                    expectedRevision: state.revision
                }
            }),
        /not empty/i
    )

    assert.throws(
        () =>
            Commands.applyCommand(state, {
                type: 'state.replace',
                payload: {
                    state: replacement,
                    expectedRevision: state.revision + 1,
                    force: true
                }
            }),
        /changed/i
    )
})

test('beginning research creates a round for the resolved project', () => {
    const state = createProjectState()
    const result = Commands.applyCommand(state, {
        type: 'research.begin',
        payload: { project: 'Campus', problem: 'Add attendance validation' }
    })

    const project = result.state.projects[0]
    assert.equal(project.research.rounds.length, 1)
    assert.equal(project.research.rounds[0].problem, 'Add attendance validation')
    assert.equal(project.currentLoopStep, 1)
    assert.match(result.message, /research round/i)
})

test('research entries are added to the active round', () => {
    const state = createProjectState()
    Commands.applyCommand(state, {
        type: 'research.begin',
        payload: { project: 'Campus', problem: 'Problem' }
    })

    const result = Commands.applyCommand(state, {
        type: 'research.add',
        payload: {
            project: 'Campus',
            kind: 'finding',
            title: 'Append-only corrections',
            explanation: 'The audit spec requires append-only corrections.',
            sources: [{ label: 'Audit spec', location: 'docs/audit.md' }],
            confidence: 'high',
            relatedItemIds: []
        }
    })

    const round = result.state.projects[0].research.rounds[0]
    assert.equal(round.entries.length, 1)
    assert.equal(round.entries[0].kind, 'finding')
})

test('confirming research satisfies the gate and advances the loop', () => {
    const state = createProjectState()
    Commands.applyCommand(state, {
        type: 'research.begin',
        payload: { project: 'Campus', problem: 'Problem' }
    })
    Commands.applyCommand(state, {
        type: 'research.add',
        payload: {
            project: 'Campus',
            kind: 'finding',
            title: 'Documented constraint',
            explanation: 'The source explains the constraint.',
            sources: [{ label: 'Spec', location: 'https://example.com/spec' }],
            confidence: 'high',
            relatedItemIds: []
        }
    })

    const result = Commands.applyCommand(state, {
        type: 'research.confirm',
        payload: { project: 'Campus' }
    })

    assert.equal(result.state.projects[0].currentLoopStep, 2)
    assert.match(result.message, /confirmed/i)
})

test('skipping research records a reason and returns a warning', () => {
    const state = createProjectState()
    Commands.applyCommand(state, {
        type: 'research.begin',
        payload: { project: 'Campus', problem: 'Problem' }
    })

    const result = Commands.applyCommand(state, {
        type: 'research.skip',
        payload: { project: 'Campus', reason: 'Incident review already done' }
    })

    assert.match(result.result.warning, /research was skipped/i)
    assert.equal(result.state.projects[0].research.rounds[0].status, 'skipped')
    assert.equal(result.state.projects[0].currentLoopStep, 2)
})

test('commands reject inherited object property names as command types', () => {
    const state = createProjectState()

    for (const type of ['constructor', 'toString', 'valueOf', '__proto__']) {
        assert.throws(
            () => Commands.applyCommand(state, { type }),
            /Unknown command/i
        )
    }
})

test('commands reject unknown command types and entities', () => {
    const state = createProjectState()

    assert.throws(
        () => Commands.applyCommand(state, { type: 'unknown.command' }),
        /Unknown command/i
    )
    assert.throws(
        () =>
            Commands.applyCommand(state, {
                type: 'project.select',
                payload: { nameOrId: 'Missing' }
            }),
        /Project not found/i
    )
    assert.throws(
        () =>
            Commands.applyCommand(state, {
                type: 'loop.set',
                payload: { project: 'Campus', step: 'Not a step' }
            }),
        /Loop step/i
    )
})
