const Core = require('./core.js')

const COMMAND_TYPES = new Set([
    'project.add',
    'project.select',
    'project.rename',
    'project.delete',
    'checklist.add',
    'checklist.select',
    'checklist.rename',
    'checklist.delete',
    'item.add',
    'item.complete',
    'item.rename',
    'item.delete',
    'item.move',
    'loop.set',
    'understanding.set',
    'understanding.confirm',
    'project.depth',
    'state.replace'
])

const LEGACY_RESEARCH_COMMANDS = new Set([
    'research.begin',
    'research.add',
    'research.confirm',
    'research.skip'
])

function normalizeLookup(value) {
    return String(value ?? '').trim().toLowerCase()
}

function findProject(state, nameOrId) {
    const project = state.projects.find(
        (candidate) => candidate.id === nameOrId
    )

    if (project) {
        return project
    }

    const normalizedName = normalizeLookup(nameOrId)
    const namedProject = state.projects.find(
        (candidate) => normalizeLookup(candidate.name) === normalizedName
    )

    if (!namedProject) {
        throw new Error(`Project not found: ${nameOrId}`)
    }

    return namedProject
}

function findChecklist(project, nameOrId) {
    const checklist = project.checklists.find(
        (candidate) => candidate.id === nameOrId
    )

    if (checklist) {
        return checklist
    }

    const normalizedName = normalizeLookup(nameOrId)
    const namedChecklist = project.checklists.find(
        (candidate) => normalizeLookup(candidate.name) === normalizedName
    )

    if (!namedChecklist) {
        throw new Error(`Checklist not found: ${nameOrId}`)
    }

    return namedChecklist
}

function findItem(checklist, itemNameOrId) {
    const item = checklist.items.find(
        (candidate) => candidate.id === itemNameOrId
    )

    if (item) {
        return item
    }

    const normalizedText = normalizeLookup(itemNameOrId)
    const namedItem = checklist.items.find(
        (candidate) => normalizeLookup(candidate.text) === normalizedText
    )

    if (!namedItem) {
        throw new Error(`Item not found: ${itemNameOrId}`)
    }

    return namedItem
}

function nextEntityId(prefix, ids) {
    const highestId = ids.reduce((highest, id) => {
        const match = String(id).match(/(\d+)$/)
        const numericId = match ? Number(match[1]) : 0

        return Math.max(highest, numericId)
    }, 0)

    return `${prefix}-${highestId + 1}`
}

function addProject(state, payload) {
    const name = String(payload.name ?? '').trim()
    const existingProject = state.projects.find(
        (project) => normalizeLookup(project.name) === normalizeLookup(name)
    )

    if (existingProject) {
        Core.setActiveProject(state, existingProject.id)
        return {
            project: existingProject,
            created: false,
            message: `Project "${existingProject.name}" is already active.`
        }
    }

    const id = nextEntityId(
        'project',
        state.projects.map((project) => project.id)
    )

    Core.addProject(state, id, name)
    Core.setActiveProject(state, id)

    const project = findProject(state, id)

    return {
        project,
        created: true,
        message: `Created and activated project "${project.name}".`
    }
}

function selectProject(state, payload) {
    const project = findProject(state, payload.nameOrId)
    Core.setActiveProject(state, project.id)

    return {
        project,
        message: `Selected project "${project.name}".`
    }
}

function renameProject(state, payload) {
    const project = findProject(state, payload.nameOrId)
    Core.renameProject(state, project.id, payload.name)

    return {
        project,
        message: `Renamed project to "${project.name}".`
    }
}

function deleteProject(state, payload) {
    const project = findProject(state, payload.nameOrId)
    Core.deleteProject(state, project.id)

    return {
        project,
        message: `Deleted project "${project.name}".`
    }
}

function addChecklist(state, payload) {
    const project = findProject(state, payload.project)
    const name = String(payload.name ?? '').trim()
    const existingChecklist = project.checklists.find(
        (checklist) =>
            normalizeLookup(checklist.name) === normalizeLookup(name)
    )

    if (existingChecklist) {
        Core.setActiveChecklist(state, project.id, existingChecklist.id)
        return {
            project,
            checklist: existingChecklist,
            created: false,
            message: `Checklist "${existingChecklist.name}" is already active.`
        }
    }

    const id = nextEntityId(
        'checklist',
        project.checklists.map((checklist) => checklist.id)
    )

    Core.addChecklist(state, project.id, id, name)
    Core.setActiveChecklist(state, project.id, id)

    const checklist = findChecklist(project, id)

    return {
        project,
        checklist,
        created: true,
        message: `Created and activated checklist "${checklist.name}".`
    }
}

function selectChecklist(state, payload) {
    const project = findProject(state, payload.project)
    const checklist = findChecklist(project, payload.nameOrId)
    Core.setActiveChecklist(state, project.id, checklist.id)

    return {
        project,
        checklist,
        message: `Selected checklist "${checklist.name}".`
    }
}

function renameChecklist(state, payload) {
    const project = findProject(state, payload.project)
    const checklist = findChecklist(project, payload.nameOrId)
    Core.renameChecklist(state, project.id, checklist.id, payload.name)

    return {
        project,
        checklist,
        message: `Renamed checklist to "${checklist.name}".`
    }
}

function deleteChecklist(state, payload) {
    const project = findProject(state, payload.project)
    const checklist = findChecklist(project, payload.nameOrId)
    Core.deleteChecklist(state, project.id, checklist.id)

    return {
        project,
        checklist,
        message: `Deleted checklist "${checklist.name}".`
    }
}

function addItem(state, payload) {
    const project = findProject(state, payload.project)
    const checklist = findChecklist(project, payload.checklist)
    const text = String(payload.text ?? '').trim()
    const existingItem = checklist.items.find(
        (item) => normalizeLookup(item.text) === normalizeLookup(text)
    )

    if (existingItem) {
        return {
            project,
            checklist,
            item: existingItem,
            created: false,
            message: `Item "${existingItem.text}" already exists.`
        }
    }

    const id = nextEntityId(
        'item',
        checklist.items.map((item) => item.id)
    )

    Core.addItem(state, project.id, checklist.id, id, text)
    const item = findItem(checklist, id)

    return {
        project,
        checklist,
        item,
        created: true,
        message: `Added item "${item.text}".`
    }
}

function completeItem(state, payload) {
    const project = findProject(state, payload.project)
    const checklist = findChecklist(project, payload.checklist)
    const item = findItem(checklist, payload.item)
    const completed = payload.completed ?? true

    if (typeof completed !== 'boolean') {
        throw new Error('Item completion must be true or false')
    }

    Core.setItemCompleted(
        state,
        project.id,
        checklist.id,
        item.id,
        completed
    )

    return {
        project,
        checklist,
        item,
        message: completed
            ? `Completed item "${item.text}".`
            : `Reopened item "${item.text}".`
    }
}

function renameItem(state, payload) {
    const project = findProject(state, payload.project)
    const checklist = findChecklist(project, payload.checklist)
    const item = findItem(checklist, payload.item)
    Core.renameItem(
        state,
        project.id,
        checklist.id,
        item.id,
        payload.text
    )

    return {
        project,
        checklist,
        item,
        message: `Renamed item to "${item.text}".`
    }
}

function deleteItem(state, payload) {
    const project = findProject(state, payload.project)
    const checklist = findChecklist(project, payload.checklist)
    const item = findItem(checklist, payload.item)
    Core.deleteItem(state, project.id, checklist.id, item.id)

    return {
        project,
        checklist,
        item,
        message: `Deleted item "${item.text}".`
    }
}

function moveItem(state, payload) {
    const project = findProject(state, payload.project)
    const checklist = findChecklist(project, payload.checklist)
    const item = findItem(checklist, payload.item)
    Core.moveItem(
        state,
        project.id,
        checklist.id,
        item.id,
        payload.direction
    )

    return {
        project,
        checklist,
        item,
        message: `Moved item "${item.text}" ${payload.direction}.`
    }
}

function setLoopStep(state, payload) {
    const project = findProject(state, payload.project)
    let stepIndex = null

    if (typeof payload.step === 'number') {
        stepIndex = payload.step - 1
    } else {
        const normalizedStep = normalizeLookup(payload.step)
        stepIndex = Core.LOOP_STEPS.findIndex(
            (step) => normalizeLookup(step.label) === normalizedStep
        )

        if (stepIndex < 0 && normalizedStep === 'inspection') {
            stepIndex = 1
        }
    }

    if (stepIndex < 0) {
        throw new Error(`Loop step not found: ${payload.step}`)
    }

    Core.setLoopStep(state, project.id, stepIndex)

    return {
        project,
        step: Core.LOOP_STEPS[stepIndex],
        message: `Set "${project.name}" to ${Core.LOOP_STEPS[stepIndex].label}.`
    }
}

function replaceState(state, payload) {
    if (!Number.isInteger(payload.expectedRevision)) {
        throw new Error('State replacement requires an expected revision')
    }

    if (payload.expectedRevision !== state.revision) {
        throw new Error(
            'Shared state changed while the replacement was being prepared'
        )
    }

    if (!payload.force && state.projects.length > 0) {
        throw new Error('Shared state is not empty')
    }

    const normalizedState = Core.parseState(
        Core.serializeState(payload.state)
    )

    for (const key of Object.keys(state)) {
        delete state[key]
    }

    Object.assign(state, normalizedState)

    return {
        message: 'Replaced shared state.'
    }
}

function setUnderstanding(state, payload) {
    const project = findProject(state, payload.project)
    Core.setUnderstanding(state, project.id, payload.summary ?? '')

    return {
        project,
        understanding: project.understanding,
        message:
            project.understanding.status === 'empty'
                ? 'Cleared the understanding summary.'
                : 'Understanding summary saved. Waiting for confirmation.'
    }
}

function confirmUnderstanding(state, payload) {
    const project = findProject(state, payload.project)
    Core.confirmUnderstanding(state, project.id)

    return {
        project,
        understanding: project.understanding,
        message: 'Understanding confirmed. Moving on to inspection.'
    }
}

function setDepth(state, payload) {
    const project = findProject(state, payload.project)
    Core.setProjectDepth(state, project.id, payload.depth)

    return {
        project,
        depth: project.depth,
        message: `Set ${project.name} teaching depth to ${project.depth}.`
    }
}

const COMMAND_HANDLERS = Object.freeze({
    'project.add': addProject,
    'project.select': selectProject,
    'project.rename': renameProject,
    'project.delete': deleteProject,
    'checklist.add': addChecklist,
    'checklist.select': selectChecklist,
    'checklist.rename': renameChecklist,
    'checklist.delete': deleteChecklist,
    'item.add': addItem,
    'item.complete': completeItem,
    'item.rename': renameItem,
    'item.delete': deleteItem,
    'item.move': moveItem,
    'loop.set': setLoopStep,
    'understanding.set': setUnderstanding,
    'understanding.confirm': confirmUnderstanding,
    'project.depth': setDepth,
    'state.replace': replaceState
})

function applyCommand(state, command) {
    if (!command || typeof command !== 'object') {
        throw new Error('Command must be an object')
    }

    if (LEGACY_RESEARCH_COMMANDS.has(command.type)) {
        throw new Error(
            'Research commands were replaced by understanding commands in v1.1.0. Use understanding.set and understanding.confirm.'
        )
    }

    if (!COMMAND_TYPES.has(command.type)) {
        throw new Error(`Unknown command: ${command.type}`)
    }

    const handler = COMMAND_HANDLERS[command.type]

    if (!handler) {
        throw new Error(`Unknown command: ${command.type}`)
    }

    const payload = command.payload ?? {}
    const result = handler(state, payload)

    return {
        state,
        result,
        message: result.message
    }
}

module.exports = {
    COMMAND_TYPES,
    applyCommand
}
