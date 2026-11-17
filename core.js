(function attachPairingCore(root, factory) {
    const api = factory()

    if (typeof module === 'object' && module.exports) {
        module.exports = api
    } else {
        root.PairingCore = api
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPairingCore() {
    const STORAGE_VERSION = 4
    const LEGACY_STATE_VERSIONS = [1, 2, 3]

    const LOOP_STEPS = Object.freeze([
        Object.freeze({
            label: 'Problem',
            prompt: 'What are we trying to accomplish?'
        }),
        Object.freeze({
            label: 'Understanding',
            prompt:
                'What do I understand about the problem, and what approach should we take?'
        }),
        Object.freeze({
            label: 'Inspection and Explanation',
            prompt: 'What should we understand before changing anything?'
        }),
        Object.freeze({
            label: 'Steps',
            prompt: 'What is the smallest useful next step?'
        }),
        Object.freeze({
            label: 'Changes',
            prompt: 'What change are we making, and why?'
        }),
        Object.freeze({
            label: 'Help',
            prompt: 'What kind of help would unblock the next step?'
        }),
        Object.freeze({
            label: 'Review',
            prompt: 'Does the result satisfy the goal?'
        }),
        Object.freeze({
            label: 'Recap',
            prompt: 'What did we learn, and what comes next?'
        })
    ])

    const UNDERSTANDING_STEP_INDEX = LOOP_STEPS.findIndex(
        (step) => step.label === 'Understanding'
    )
    const INSPECTION_STEP_INDEX = LOOP_STEPS.findIndex(
        (step) => step.label === 'Inspection and Explanation'
    )

    const DEPTH_LEVELS = Object.freeze(['concise', 'standard', 'deep'])
    const UNDERSTANDING_STATUSES = Object.freeze([
        'empty',
        'pending',
        'confirmed'
    ])

    function createInitialState() {
        return {
            version: STORAGE_VERSION,
            revision: 0,
            activeProjectId: null,
            projects: []
        }
    }

    function requireName(name, label) {
        if (typeof name !== 'string') {
            throw new Error(`${label} name must be text`)
        }

        const trimmedName = name.trim()

        if (trimmedName === '') {
            throw new Error(`${label} name cannot be blank`)
        }

        return trimmedName
    }

    function requireId(id, label) {
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(`${label} ID cannot be blank`)
        }

        return id.trim()
    }

    function now() {
        return new Date().toISOString()
    }

    function findProject(state, projectId) {
        const project = state.projects.find(
            (candidate) => candidate.id === projectId
        )

        if (!project) {
            throw new Error(`Project not found: ${projectId}`)
        }

        return project
    }

    function findChecklist(state, projectId, checklistId) {
        const project = findProject(state, projectId)
        const checklist = project.checklists.find(
            (candidate) => candidate.id === checklistId
        )

        if (!checklist) {
            throw new Error(`Checklist not found: ${checklistId}`)
        }

        return checklist
    }

    function findItem(checklist, itemId) {
        const item = checklist.items.find((candidate) => candidate.id === itemId)

        if (!item) {
            throw new Error(`Item not found: ${itemId}`)
        }

        return item
    }

    function createEmptyUnderstanding() {
        return {
            summary: '',
            status: 'empty',
            updatedAt: null,
            confirmedAt: null
        }
    }

    function understandingConfirmed(project) {
        return project.understanding?.status === 'confirmed'
    }

    function setUnderstanding(state, projectId, summary) {
        const project = findProject(state, projectId)
        const trimmedSummary =
            typeof summary === 'string' ? summary.trim() : ''

        project.understanding = {
            summary: trimmedSummary,
            status: trimmedSummary === '' ? 'empty' : 'pending',
            updatedAt: now(),
            confirmedAt: null
        }

        return state
    }

    function confirmUnderstanding(state, projectId) {
        const project = findProject(state, projectId)

        if (!project.understanding.summary) {
            throw new Error(
                'The understanding summary cannot be blank before it is confirmed.'
            )
        }

        if (project.understanding.status === 'confirmed') {
            return state
        }

        project.understanding.status = 'confirmed'
        project.understanding.confirmedAt = now()
        project.currentLoopStep = INSPECTION_STEP_INDEX

        return state
    }

    function setProjectDepth(state, projectId, depth) {
        const project = findProject(state, projectId)
        const normalizedDepth = String(depth ?? '').trim()

        if (!DEPTH_LEVELS.includes(normalizedDepth)) {
            throw new Error(
                `Unknown project depth: ${normalizedDepth}. Use concise, standard, or deep.`
            )
        }

        project.depth = normalizedDepth

        return state
    }

    function addProject(state, id, name) {
        const normalizedId = requireId(id, 'Project')

        if (state.projects.some((project) => project.id === normalizedId)) {
            throw new Error(`Project ID already exists: ${normalizedId}`)
        }

        const project = {
            id: normalizedId,
            name: requireName(name, 'Project'),
            currentLoopStep: 0,
            depth: 'standard',
            understanding: createEmptyUnderstanding(),
            activeChecklistId: null,
            checklists: []
        }

        state.projects.push(project)

        if (state.activeProjectId === null) {
            state.activeProjectId = project.id
        }

        return state
    }

    function renameProject(state, id, name) {
        const project = findProject(state, id)
        const validatedName = requireName(name, 'Project')

        project.name = validatedName

        return state
    }

    function setActiveProject(state, id) {
        findProject(state, id)
        state.activeProjectId = id

        return state
    }

    function deleteProject(state, id) {
        const projectIndex = state.projects.findIndex(
            (project) => project.id === id
        )

        if (projectIndex === -1) {
            throw new Error(`Project not found: ${id}`)
        }

        const deletedProject = state.projects[projectIndex]
        state.projects.splice(projectIndex, 1)

        if (state.activeProjectId === deletedProject.id) {
            state.activeProjectId = state.projects[0]?.id ?? null
        }

        return state
    }

    function addChecklist(state, projectId, id, name) {
        const project = findProject(state, projectId)
        const normalizedId = requireId(id, 'Checklist')

        if (
            project.checklists.some(
                (checklist) => checklist.id === normalizedId
            )
        ) {
            throw new Error(`Checklist ID already exists: ${normalizedId}`)
        }

        const checklist = {
            id: normalizedId,
            name: requireName(name, 'Checklist'),
            items: []
        }

        project.checklists.push(checklist)

        if (project.activeChecklistId === null) {
            project.activeChecklistId = checklist.id
        }

        return state
    }

    function renameChecklist(state, projectId, checklistId, name) {
        const checklist = findChecklist(state, projectId, checklistId)
        const validatedName = requireName(name, 'Checklist')

        checklist.name = validatedName

        return state
    }

    function setActiveChecklist(state, projectId, checklistId) {
        const project = findProject(state, projectId)
        findChecklist(state, projectId, checklistId)

        project.activeChecklistId = checklistId

        return state
    }

    function deleteChecklist(state, projectId, checklistId) {
        const project = findProject(state, projectId)
        const checklistIndex = project.checklists.findIndex(
            (checklist) => checklist.id === checklistId
        )

        if (checklistIndex === -1) {
            throw new Error(`Checklist not found: ${checklistId}`)
        }

        const deletedChecklist = project.checklists[checklistIndex]
        project.checklists.splice(checklistIndex, 1)

        if (project.activeChecklistId === deletedChecklist.id) {
            project.activeChecklistId = project.checklists[0]?.id ?? null
        }

        return state
    }

    function addItem(state, projectId, checklistId, id, text) {
        const checklist = findChecklist(state, projectId, checklistId)
        const normalizedId = requireId(id, 'Item')

        if (checklist.items.some((item) => item.id === normalizedId)) {
            throw new Error(`Item ID already exists: ${normalizedId}`)
        }

        const item = {
            id: normalizedId,
            text: requireName(text, 'Item'),
            completed: false
        }

        checklist.items.push(item)

        return state
    }

    function renameItem(state, projectId, checklistId, itemId, text) {
        const checklist = findChecklist(state, projectId, checklistId)
        const item = findItem(checklist, itemId)
        const validatedText = requireName(text, 'Item')

        item.text = validatedText

        return state
    }

    function setItemCompleted(
        state,
        projectId,
        checklistId,
        itemId,
        completed
    ) {
        const checklist = findChecklist(state, projectId, checklistId)
        const item = findItem(checklist, itemId)

        if (typeof completed !== 'boolean') {
            throw new Error('Item completion must be true or false')
        }

        item.completed = completed

        return state
    }

    function deleteItem(state, projectId, checklistId, itemId) {
        const checklist = findChecklist(state, projectId, checklistId)
        const itemIndex = checklist.items.findIndex((item) => item.id === itemId)

        if (itemIndex === -1) {
            throw new Error(`Item not found: ${itemId}`)
        }

        checklist.items.splice(itemIndex, 1)

        return state
    }

    function moveItem(state, projectId, checklistId, itemId, direction) {
        const checklist = findChecklist(state, projectId, checklistId)
        const itemIndex = checklist.items.findIndex((item) => item.id === itemId)

        if (itemIndex === -1) {
            throw new Error(`Item not found: ${itemId}`)
        }

        if (direction !== 'up' && direction !== 'down') {
            throw new Error('Item direction must be up or down')
        }

        const targetIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1

        if (targetIndex < 0 || targetIndex >= checklist.items.length) {
            return state
        }

        const currentItem = checklist.items[itemIndex]
        checklist.items[itemIndex] = checklist.items[targetIndex]
        checklist.items[targetIndex] = currentItem

        return state
    }

    function setLoopStep(state, projectId, stepIndex) {
        const project = findProject(state, projectId)

        if (
            !Number.isInteger(stepIndex) ||
            stepIndex < 0 ||
            stepIndex >= LOOP_STEPS.length
        ) {
            throw new Error(
                `Loop step must be an integer between 0 and ${LOOP_STEPS.length - 1}`
            )
        }

        if (
            stepIndex > UNDERSTANDING_STEP_INDEX &&
            !understandingConfirmed(project)
        ) {
            throw new Error(
                'The understanding summary must be confirmed before moving past Understanding.'
            )
        }

        project.currentLoopStep = stepIndex

        return state
    }

    function createId(prefix = 'id') {
        const safePrefix = String(prefix).trim() || 'id'
        const randomPart =
            typeof globalThis.crypto?.randomUUID === 'function'
                ? globalThis.crypto.randomUUID()
                : `${Date.now().toString(36)}-${Math.random()
                      .toString(36)
                      .slice(2)}`

        return `${safePrefix}-${randomPart}`
    }

    function serializeState(state) {
        return JSON.stringify(state)
    }

    function parseState(rawState) {
        let parsedState

        try {
            parsedState = JSON.parse(rawState)
        } catch (error) {
            throw new Error(`Could not parse saved data: ${error.message}`)
        }

        if (
            !parsedState ||
            typeof parsedState !== 'object' ||
            Array.isArray(parsedState)
        ) {
            throw new Error('Could not parse saved data: expected an object')
        }

        const isLegacyVersion = LEGACY_STATE_VERSIONS.includes(
            parsedState.version
        )

        if (parsedState.version !== STORAGE_VERSION && !isLegacyVersion) {
            throw new Error(
                `Saved data version ${parsedState.version} is not supported`
            )
        }

        const revision = isLegacyVersion ? 0 : parsedState.revision

        if (!Number.isInteger(revision) || revision < 0) {
            throw new Error('Could not parse saved data: invalid revision')
        }

        if (!Array.isArray(parsedState.projects)) {
            throw new Error('Could not parse saved data: projects must be a list')
        }

        const projectIds = new Set()
        const projects = parsedState.projects.map((project) => {
            if (!project || typeof project !== 'object') {
                throw new Error(
                    'Could not parse saved data: invalid project entry'
                )
            }

            if (typeof project.id !== 'string' || project.id.trim() === '') {
                throw new Error(
                    'Could not parse saved data: invalid project ID'
                )
            }

            const projectId = project.id.trim()

            if (projectIds.has(projectId)) {
                throw new Error(
                    `Could not parse saved data: duplicate project ID ${projectId}`
                )
            }
            projectIds.add(projectId)

            if (typeof project.name !== 'string' || project.name.trim() === '') {
                throw new Error(
                    'Could not parse saved data: invalid project name'
                )
            }

            const requestedLoopStep = project.currentLoopStep ?? 0
            const normalizedLoopStep =
                parsedState.version <= 2
                    ? requestedLoopStep === 0
                        ? 0
                        : UNDERSTANDING_STEP_INDEX
                    : requestedLoopStep

            if (
                !Number.isInteger(normalizedLoopStep) ||
                normalizedLoopStep < 0 ||
                normalizedLoopStep >= LOOP_STEPS.length
            ) {
                throw new Error(
                    'Could not parse saved data: invalid loop step'
                )
            }

            const requestedActiveChecklistId =
                project.activeChecklistId ?? null

            if (
                requestedActiveChecklistId !== null &&
                typeof requestedActiveChecklistId !== 'string'
            ) {
                throw new Error(
                    'Could not parse saved data: invalid active checklist'
                )
            }

            const normalizedActiveChecklistId =
                typeof requestedActiveChecklistId === 'string'
                    ? requestedActiveChecklistId.trim()
                    : null

            if (!Array.isArray(project.checklists)) {
                throw new Error(
                    'Could not parse saved data: checklists must be a list'
                )
            }

            const checklistIds = new Set()
            const checklists = project.checklists.map((checklist) => {
                if (!checklist || typeof checklist !== 'object') {
                    throw new Error(
                        'Could not parse saved data: invalid checklist entry'
                    )
                }

                if (
                    typeof checklist.id !== 'string' ||
                    checklist.id.trim() === ''
                ) {
                    throw new Error(
                        'Could not parse saved data: invalid checklist ID'
                    )
                }

                const checklistId = checklist.id.trim()

                if (checklistIds.has(checklistId)) {
                    throw new Error(
                        `Could not parse saved data: duplicate checklist ID ${checklistId}`
                    )
                }
                checklistIds.add(checklistId)

                if (
                    typeof checklist.name !== 'string' ||
                    checklist.name.trim() === ''
                ) {
                    throw new Error(
                        'Could not parse saved data: invalid checklist name'
                    )
                }

                if (!Array.isArray(checklist.items)) {
                    throw new Error(
                        'Could not parse saved data: items must be a list'
                    )
                }

                const itemIds = new Set()
                const items = checklist.items.map((item) => {
                    if (!item || typeof item !== 'object') {
                        throw new Error(
                            'Could not parse saved data: invalid item entry'
                        )
                    }

                    if (
                        typeof item.id !== 'string' ||
                        item.id.trim() === ''
                    ) {
                        throw new Error(
                            'Could not parse saved data: invalid item ID'
                        )
                    }

                    const itemId = item.id.trim()

                    if (itemIds.has(itemId)) {
                        throw new Error(
                            `Could not parse saved data: duplicate item ID ${itemId}`
                        )
                    }
                    itemIds.add(itemId)

                    if (
                        typeof item.text !== 'string' ||
                        item.text.trim() === ''
                    ) {
                        throw new Error(
                            'Could not parse saved data: invalid item name'
                        )
                    }

                    if (typeof item.completed !== 'boolean') {
                        throw new Error(
                            'Could not parse saved data: invalid item completion'
                        )
                    }

                    return {
                        id: itemId,
                        text: item.text.trim(),
                        completed: item.completed
                    }
                })

                return {
                    id: checklistId,
                    name: checklist.name.trim(),
                    items
                }
            })

            const activeChecklistId =
                normalizedActiveChecklistId ?? checklists[0]?.id ?? null

            if (
                activeChecklistId !== null &&
                !checklistIds.has(activeChecklistId)
            ) {
                throw new Error(
                    'Could not parse saved data: active checklist does not exist'
                )
            }

            const depth = normalizeDepth(
                parsedState.version === STORAGE_VERSION
                    ? project.depth
                    : 'standard'
            )
            const understanding =
                parsedState.version === STORAGE_VERSION
                    ? normalizeUnderstanding(project.understanding)
                    : parsedState.version === 3
                      ? migrateResearchToUnderstanding(project.research)
                      : createEmptyUnderstanding()

            if (
                normalizedLoopStep > UNDERSTANDING_STEP_INDEX &&
                understanding.status !== 'confirmed'
            ) {
                throw new Error(
                    'Could not parse saved data: the understanding checkpoint is missing'
                )
            }

            return {
                id: projectId,
                name: project.name.trim(),
                currentLoopStep: normalizedLoopStep,
                depth,
                understanding,
                activeChecklistId,
                checklists
            }
        })

        const requestedActiveProjectId = parsedState.activeProjectId ?? null

        if (
            requestedActiveProjectId !== null &&
            typeof requestedActiveProjectId !== 'string'
        ) {
            throw new Error(
                'Could not parse saved data: invalid active project'
            )
        }

        const normalizedActiveProjectId =
            typeof requestedActiveProjectId === 'string'
                ? requestedActiveProjectId.trim()
                : null

        if (
            normalizedActiveProjectId !== null &&
            !projectIds.has(normalizedActiveProjectId)
        ) {
            throw new Error(
                'Could not parse data: active project does not exist'
            )
        }

        const activeProjectId =
            normalizedActiveProjectId ?? projects[0]?.id ?? null

        return {
            version: STORAGE_VERSION,
            revision,
            activeProjectId,
            projects
        }
    }

    function normalizeDepth(depth) {
        const normalizedDepth = String(depth ?? 'standard').trim()

        if (!DEPTH_LEVELS.includes(normalizedDepth)) {
            throw new Error('Could not parse saved data: invalid project depth')
        }

        return normalizedDepth
    }

    function normalizeUnderstanding(understanding) {
        if (!understanding || typeof understanding !== 'object') {
            throw new Error(
                'Could not parse saved data: invalid understanding summary'
            )
        }

        const summary =
            typeof understanding.summary === 'string'
                ? understanding.summary.trim()
                : ''
        const status = String(understanding.status ?? 'empty').trim()

        if (!UNDERSTANDING_STATUSES.includes(status)) {
            throw new Error(
                'Could not parse saved data: invalid understanding status'
            )
        }

        if (status !== 'empty' && summary === '') {
            throw new Error(
                'Could not parse saved data: understanding summary cannot be blank'
            )
        }

        const updatedAt =
            typeof understanding.updatedAt === 'string'
                ? understanding.updatedAt.trim() || null
                : null
        const confirmedAt =
            typeof understanding.confirmedAt === 'string'
                ? understanding.confirmedAt.trim() || null
                : null

        if (status === 'confirmed' && !confirmedAt) {
            throw new Error(
                'Could not parse saved data: confirmed understanding needs a date'
            )
        }

        return {
            summary,
            status,
            updatedAt,
            confirmedAt
        }
    }

    function migrateResearchToUnderstanding(research) {
        if (!research || !Array.isArray(research.rounds)) {
            return createEmptyUnderstanding()
        }

        const activeRound =
            research.rounds.find(
                (round) => round.id === research.activeRoundId
            ) ?? research.rounds[research.rounds.length - 1]

        if (!activeRound || !Array.isArray(activeRound.entries)) {
            return createEmptyUnderstanding()
        }

        const problem = String(activeRound.problem ?? '').trim()
        const titles = activeRound.entries
            .map((entry) => String(entry.title ?? '').trim())
            .filter(Boolean)
        const lines = []

        if (problem) {
            lines.push(problem)
        }

        for (const title of titles.slice(0, 5)) {
            lines.push(`- ${title}`)
        }

        if (titles.length > 5) {
            lines.push(`- …and ${titles.length - 5} more findings`)
        }

        const summary = lines.join('\n')

        if (!summary) {
            return {
                ...createEmptyUnderstanding(),
                updatedAt:
                    typeof activeRound.startedAt === 'string'
                        ? activeRound.startedAt.trim() || null
                        : null
            }
        }

        const confirmed = activeRound.status === 'confirmed'

        return {
            summary,
            status: confirmed ? 'confirmed' : 'pending',
            updatedAt:
                typeof activeRound.startedAt === 'string'
                    ? activeRound.startedAt.trim() || null
                    : null,
            confirmedAt: confirmed
                ? typeof activeRound.concludedAt === 'string'
                    ? activeRound.concludedAt.trim() || null
                    : null
                : null
        }
    }

    return {
        STORAGE_VERSION,
        LOOP_STEPS,
        DEPTH_LEVELS,
        UNDERSTANDING_STEP_INDEX,
        INSPECTION_STEP_INDEX,
        createInitialState,
        addProject,
        renameProject,
        setActiveProject,
        deleteProject,
        setUnderstanding,
        confirmUnderstanding,
        setProjectDepth,
        understandingConfirmed,
        addChecklist,
        renameChecklist,
        setActiveChecklist,
        deleteChecklist,
        addItem,
        renameItem,
        setItemCompleted,
        deleteItem,
        moveItem,
        setLoopStep,
        createId,
        serializeState,
        parseState
    }
})
