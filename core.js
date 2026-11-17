(function attachPairingCore(root, factory) {
    const api = factory()

    if (typeof module === 'object' && module.exports) {
        module.exports = api
    } else {
        root.PairingCore = api
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPairingCore() {
    const STORAGE_VERSION = 3
    const LEGACY_STATE_VERSIONS = [1, 2]

    const LOOP_STEPS = Object.freeze([
        Object.freeze({
            label: 'Problem',
            prompt: 'What are we trying to accomplish?'
        }),
        Object.freeze({
            label: 'Research',
            prompt:
                'What do we need to understand about the problem before we design a solution?'
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

    const RESEARCH_STEP_INDEX = LOOP_STEPS.findIndex(
        (step) => step.label === 'Research'
    )
    const INSPECTION_STEP_INDEX = LOOP_STEPS.findIndex(
        (step) => step.label === 'Inspection and Explanation'
    )

    const RESEARCH_KINDS = Object.freeze([
        'finding',
        'question',
        'decision',
        'no-research-needed',
        'skipped'
    ])
    const RESEARCH_CONFIDENCE_LEVELS = Object.freeze(['high', 'medium', 'low'])
    const RESEARCH_ROUND_STATUSES = Object.freeze([
        'open',
        'confirmed',
        'skipped'
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

    function requireText(text, label) {
        if (typeof text !== 'string') {
            throw new Error(`${label} must be text`)
        }

        const trimmedText = text.trim()

        if (trimmedText === '') {
            throw new Error(`${label} cannot be blank`)
        }

        return trimmedText
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

    function createEmptyResearch() {
        return {
            activeRoundId: null,
            rounds: []
        }
    }

    function getResearchRound(project) {
        if (!project.research?.activeRoundId) {
            return null
        }

        return (
            project.research.rounds.find(
                (round) => round.id === project.research.activeRoundId
            ) ?? null
        )
    }

    function hasQualifyingResearchEntry(round) {
        if (!round) {
            return false
        }

        return round.entries.some((entry) => {
            if (entry.kind === 'finding') {
                return entry.sources.length > 0
            }

            return entry.kind === 'no-research-needed'
        })
    }

    function researchGateSatisfied(project) {
        const round = getResearchRound(project)

        return (
            round !== null &&
            (round.status === 'confirmed' || round.status === 'skipped')
        )
    }

    function normalizeSources(sources, label) {
        if (!Array.isArray(sources)) {
            throw new Error(`${label} sources must be a list`)
        }

        return sources.map((source) => {
            if (!source || typeof source !== 'object') {
                throw new Error(`${label} source must be an object`)
            }

            return {
                label: requireText(source.label, 'Source label'),
                location: requireText(source.location, 'Source location')
            }
        })
    }

    function normalizeResearchEntry(entry) {
        if (!entry || typeof entry !== 'object') {
            throw new Error('Research entry must be an object')
        }

        const id = requireId(entry.id, 'Research entry')
        const kind = String(entry.kind ?? '').trim()

        if (!RESEARCH_KINDS.includes(kind)) {
            throw new Error(`Unknown research entry kind: ${kind}`)
        }

        const title = requireText(entry.title, 'Research entry title')
        const explanation =
            typeof entry.explanation === 'string' ? entry.explanation.trim() : ''

        if (
            (kind === 'no-research-needed' || kind === 'skipped') &&
            explanation === ''
        ) {
            throw new Error(
                `A ${kind} research entry requires an explanation`
            )
        }

        const sources = normalizeSources(entry.sources ?? [], 'Research entry')
        const confidence = String(entry.confidence ?? 'medium').trim()

        if (!RESEARCH_CONFIDENCE_LEVELS.includes(confidence)) {
            throw new Error(`Unknown research confidence: ${confidence}`)
        }

        if (kind === 'finding' && sources.length === 0) {
            throw new Error('A research finding requires at least one source')
        }

        const relatedItemIds = entry.relatedItemIds ?? []

        if (!Array.isArray(relatedItemIds)) {
            throw new Error('Related research items must be a list')
        }

        return {
            id,
            kind,
            title,
            explanation,
            sources,
            confidence,
            relatedItemIds: relatedItemIds.map((itemId) =>
                requireId(itemId, 'Related research item')
            ),
            createdAt:
                typeof entry.createdAt === 'string' && entry.createdAt.trim()
                    ? entry.createdAt.trim()
                    : now()
        }
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
            activeChecklistId: null,
            checklists: [],
            research: createEmptyResearch()
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

    function beginResearch(state, projectId, problem, roundId) {
        const project = findProject(state, projectId)
        const normalizedId = requireId(roundId, 'Research round')
        const validatedProblem = requireText(problem, 'Research problem')

        if (
            project.research.rounds.some(
                (round) => round.id === normalizedId
            )
        ) {
            throw new Error(
                `Research round ID already exists: ${normalizedId}`
            )
        }

        const activeRound = getResearchRound(project)

        if (activeRound && activeRound.status === 'open') {
            throw new Error(
                'A research round is already open. Confirm or skip it before starting another.'
            )
        }

        const round = {
            id: normalizedId,
            problem: validatedProblem,
            status: 'open',
            startedAt: now(),
            concludedAt: null,
            reason: '',
            entries: []
        }

        project.research.rounds.push(round)
        project.research.activeRoundId = round.id
        project.currentLoopStep = RESEARCH_STEP_INDEX

        return state
    }

    function addResearchEntry(state, projectId, entry) {
        const project = findProject(state, projectId)
        const round = getResearchRound(project)

        if (!round) {
            throw new Error(
                'No active research round. Begin research before recording entries.'
            )
        }

        if (round.entries.some((candidate) => candidate.id === entry?.id)) {
            throw new Error(
                `Research entry ID already exists: ${entry?.id}`
            )
        }

        const normalizedEntry = normalizeResearchEntry(entry)
        round.entries.push(normalizedEntry)

        if (round.status !== 'open') {
            round.status = 'open'
            round.concludedAt = null
            round.reason = ''
        }

        return state
    }

    function confirmResearch(state, projectId) {
        const project = findProject(state, projectId)
        const round = getResearchRound(project)

        if (!round) {
            throw new Error(
                'No active research round. Begin research before confirming.'
            )
        }

        if (!hasQualifyingResearchEntry(round)) {
            throw new Error(
                'Research needs a sourced finding or a no-research-needed entry before it can be confirmed.'
            )
        }

        round.status = 'confirmed'
        round.concludedAt = now()
        round.reason = ''
        project.currentLoopStep = INSPECTION_STEP_INDEX

        return state
    }

    function skipResearch(state, projectId, reason) {
        const project = findProject(state, projectId)
        const round = getResearchRound(project)

        if (!round) {
            throw new Error(
                'No active research round. Begin research before skipping.'
            )
        }

        const validatedReason = requireText(reason, 'Research skip reason')

        round.entries.push(
            normalizeResearchEntry({
                id: createId('research-entry'),
                kind: 'skipped',
                title: 'Research skipped',
                explanation: validatedReason,
                sources: [],
                confidence: 'high',
                relatedItemIds: [],
                createdAt: now()
            })
        )
        round.status = 'skipped'
        round.concludedAt = now()
        round.reason = validatedReason
        project.currentLoopStep = INSPECTION_STEP_INDEX

        return {
            state,
            warning: `Research was skipped: ${validatedReason}`
        }
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
            stepIndex > RESEARCH_STEP_INDEX &&
            !researchGateSatisfied(project)
        ) {
            throw new Error(
                'Research must be confirmed or explicitly skipped before moving past Research.'
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
            const legacyLoopStep = isLegacyVersion
                ? requestedLoopStep === 0
                    ? 0
                    : RESEARCH_STEP_INDEX
                : requestedLoopStep

            if (
                !Number.isInteger(legacyLoopStep) ||
                legacyLoopStep < 0 ||
                legacyLoopStep >= LOOP_STEPS.length
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

            const research = isLegacyVersion
                ? createLegacyResearch(projectId)
                : normalizeResearch(project.research, projectId)

            if (
                legacyLoopStep > RESEARCH_STEP_INDEX &&
                !researchGateSatisfied({
                    research,
                    currentLoopStep: legacyLoopStep
                })
            ) {
                throw new Error(
                    'Could not parse saved data: the research checkpoint is missing'
                )
            }

            return {
                id: projectId,
                name: project.name.trim(),
                currentLoopStep: legacyLoopStep,
                activeChecklistId,
                checklists,
                research
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
                'Could not parse saved data: active project does not exist'
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

    function createLegacyResearch(projectId) {
        const round = {
            id: `${projectId}-research-1`,
            problem: 'Continue the current work',
            status: 'open',
            startedAt: now(),
            concludedAt: null,
            reason: '',
            entries: []
        }

        return {
            activeRoundId: round.id,
            rounds: [round]
        }
    }

    function normalizeResearch(research, projectId) {
        if (!research || typeof research !== 'object') {
            throw new Error(
                'Could not parse saved data: invalid research area'
            )
        }

        if (!Array.isArray(research.rounds)) {
            throw new Error(
                'Could not parse saved data: research rounds must be a list'
            )
        }

        const roundIds = new Set()
        const rounds = research.rounds.map((round) => {
            if (!round || typeof round !== 'object') {
                throw new Error(
                    'Could not parse saved data: invalid research round'
                )
            }

            if (
                typeof round.id !== 'string' ||
                round.id.trim() === ''
            ) {
                throw new Error(
                    'Could not parse saved data: invalid research round ID'
                )
            }

            const roundId = round.id.trim()

            if (roundIds.has(roundId)) {
                throw new Error(
                    `Could not parse saved data: duplicate research round ID ${roundId}`
                )
            }
            roundIds.add(roundId)

            if (
                typeof round.problem !== 'string' ||
                round.problem.trim() === ''
            ) {
                throw new Error(
                    'Could not parse saved data: invalid research problem'
                )
            }

            if (!RESEARCH_ROUND_STATUSES.includes(round.status)) {
                throw new Error(
                    'Could not parse saved data: invalid research round status'
                )
            }

            if (!Array.isArray(round.entries)) {
                throw new Error(
                    'Could not parse saved data: research entries must be a list'
                )
            }

            const entryIds = new Set()
            const entries = round.entries.map((entry) => {
                if (!entry || typeof entry !== 'object') {
                    throw new Error(
                        'Could not parse saved data: invalid research entry'
                    )
                }

                if (
                    typeof entry.id !== 'string' ||
                    entry.id.trim() === ''
                ) {
                    throw new Error(
                        'Could not parse saved data: invalid research entry ID'
                    )
                }

                const entryId = entry.id.trim()

                if (entryIds.has(entryId)) {
                    throw new Error(
                        `Could not parse saved data: duplicate research entry ID ${entryId}`
                    )
                }
                entryIds.add(entryId)

                if (!RESEARCH_KINDS.includes(entry.kind)) {
                    throw new Error(
                        'Could not parse saved data: unknown research entry kind'
                    )
                }

                if (
                    typeof entry.title !== 'string' ||
                    entry.title.trim() === ''
                ) {
                    throw new Error(
                        'Could not parse saved data: invalid research entry title'
                    )
                }

                if (typeof entry.explanation !== 'string') {
                    throw new Error(
                        'Could not parse saved data: invalid research explanation'
                    )
                }

                if (!Array.isArray(entry.sources)) {
                    throw new Error(
                        'Could not parse saved data: research sources must be a list'
                    )
                }

                const sources = entry.sources.map((source) => {
                    if (!source || typeof source !== 'object') {
                        throw new Error(
                            'Could not parse saved data: invalid research source'
                        )
                    }

                    if (
                        typeof source.label !== 'string' ||
                        source.label.trim() === ''
                    ) {
                        throw new Error(
                            'Could not parse saved data: invalid research source label'
                        )
                    }

                    if (
                        typeof source.location !== 'string' ||
                        source.location.trim() === ''
                    ) {
                        throw new Error(
                            'Could not parse saved data: invalid research source location'
                        )
                    }

                    return {
                        label: source.label.trim(),
                        location: source.location.trim()
                    }
                })

                if (entry.kind === 'finding' && sources.length === 0) {
                    throw new Error(
                        'Could not parse saved data: research finding requires a source'
                    )
                }

                if (
                    !RESEARCH_CONFIDENCE_LEVELS.includes(entry.confidence)
                ) {
                    throw new Error(
                        'Could not parse saved data: invalid research confidence'
                    )
                }

                if (!Array.isArray(entry.relatedItemIds)) {
                    throw new Error(
                        'Could not parse saved data: related research items must be a list'
                    )
                }

                if (
                    typeof entry.createdAt !== 'string' ||
                    entry.createdAt.trim() === ''
                ) {
                    throw new Error(
                        'Could not parse saved data: invalid research entry date'
                    )
                }

                return {
                    id: entryId,
                    kind: entry.kind,
                    title: entry.title.trim(),
                    explanation: entry.explanation.trim(),
                    sources,
                    confidence: entry.confidence,
                    relatedItemIds: entry.relatedItemIds.map((itemId) =>
                        String(itemId)
                    ),
                    createdAt: entry.createdAt.trim()
                }
            })

            return {
                id: roundId,
                problem: round.problem.trim(),
                status: round.status,
                startedAt:
                    typeof round.startedAt === 'string'
                        ? round.startedAt.trim()
                        : now(),
                concludedAt:
                    typeof round.concludedAt === 'string'
                        ? round.concludedAt.trim()
                        : null,
                reason:
                    typeof round.reason === 'string' ? round.reason.trim() : '',
                entries
            }
        })

        const requestedActiveRoundId = research.activeRoundId ?? null

        if (
            requestedActiveRoundId !== null &&
            typeof requestedActiveRoundId !== 'string'
        ) {
            throw new Error(
                'Could not parse saved data: invalid active research round'
            )
        }

        const normalizedActiveRoundId =
            typeof requestedActiveRoundId === 'string'
                ? requestedActiveRoundId.trim()
                : null

        if (
            normalizedActiveRoundId !== null &&
            !roundIds.has(normalizedActiveRoundId)
        ) {
            throw new Error(
                'Could not parse saved data: active research round does not exist'
            )
        }

        return {
            activeRoundId: normalizedActiveRoundId,
            rounds
        }
    }

    return {
        STORAGE_VERSION,
        LOOP_STEPS,
        RESEARCH_KINDS,
        RESEARCH_CONFIDENCE_LEVELS,
        RESEARCH_STEP_INDEX,
        INSPECTION_STEP_INDEX,
        createInitialState,
        addProject,
        renameProject,
        setActiveProject,
        deleteProject,
        beginResearch,
        addResearchEntry,
        confirmResearch,
        skipResearch,
        getResearchRound,
        hasQualifyingResearchEntry,
        researchGateSatisfied,
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
