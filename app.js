(function initializePairingApp() {
    'use strict'

    const Core = window.PairingCore
    const STATE_API = '/api/state'
    const COMMAND_API = '/api/command'
    const EVENTS_API = '/api/events'
    const LEGACY_STORAGE_KEY = 'pi-pairing-tool:v1'
    const LEGACY_BACKUP_KEY = 'pi-pairing-tool:v1:corrupt-backup'

    const elements = {
        statusMessage: document.getElementById('status-message'),
        projectSelect: document.getElementById('project-select'),
        addProjectButton: document.getElementById('add-project-button'),
        renameProjectButton: document.getElementById('rename-project-button'),
        deleteProjectButton: document.getElementById('delete-project-button'),
        loopSteps: document.getElementById('loop-steps'),
        loopPosition: document.getElementById('loop-position'),
        loopPrompt: document.getElementById('loop-prompt-text'),
        loopGateHint: document.getElementById('loop-gate-hint'),
        researchStatus: document.getElementById('research-status'),
        researchWarning: document.getElementById('research-warning'),
        researchBeginForm: document.getElementById('research-begin-form'),
        researchProblemInput: document.getElementById('research-problem-input'),
        researchRound: document.getElementById('research-round'),
        researchRoundProblem: document.getElementById('research-round-problem'),
        researchConfirmButton: document.getElementById('research-confirm-button'),
        researchSkipButton: document.getElementById('research-skip-button'),
        researchNewRoundButton: document.getElementById('research-new-round-button'),
        researchEntries: document.getElementById('research-entries'),
        researchAddForm: document.getElementById('research-add-form'),
        researchKind: document.getElementById('research-kind'),
        researchConfidence: document.getElementById('research-confidence'),
        researchTitleInput: document.getElementById('research-title-input'),
        researchExplanationInput: document.getElementById(
            'research-explanation-input'
        ),
        researchSourceLabel: document.getElementById('research-source-label'),
        researchSourceLocation: document.getElementById(
            'research-source-location'
        ),
        checklistSelect: document.getElementById('checklist-select'),
        addChecklistButton: document.getElementById('add-checklist-button'),
        renameChecklistButton: document.getElementById(
            'rename-checklist-button'
        ),
        deleteChecklistButton: document.getElementById(
            'delete-checklist-button'
        ),
        checklistTitle: document.getElementById('active-checklist-title'),
        itemCount: document.getElementById('item-count'),
        checklistItems: document.getElementById('checklist-items'),
        checklistEmpty: document.getElementById('checklist-empty'),
        addItemForm: document.getElementById('add-item-form'),
        addItemInput: document.getElementById('add-item-input'),
        addItemSubmitButton: document.getElementById(
            'add-item-submit-button'
        )
    }

    let state = Core.createInitialState()
    let connected = false
    let statusTimer = null
    let commandQueue = Promise.resolve()
    let eventSource = null
    let stateRetryTimer = null
    let currentServerInstanceId = null
    let currentServerStartedAt = 0

    function getActiveProject() {
        return (
            state.projects.find(
                (project) => project.id === state.activeProjectId
            ) ?? null
        )
    }

    function getActiveChecklist(project) {
        if (!project) {
            return null
        }

        return (
            project.checklists.find(
                (checklist) => checklist.id === project.activeChecklistId
            ) ?? null
        )
    }

    function showStatus(message, kind = 'info') {
        window.clearTimeout(statusTimer)
        elements.statusMessage.textContent = message
        elements.statusMessage.dataset.kind = kind
        elements.statusMessage.hidden = false

        if (kind !== 'error') {
            statusTimer = window.setTimeout(() => {
                elements.statusMessage.textContent = ''
                delete elements.statusMessage.dataset.kind
            }, 3500)
        }
    }

    function captureFocus() {
        const activeElement = document.activeElement

        if (!(activeElement instanceof window.HTMLElement)) {
            return null
        }

        if (activeElement.matches('#loop-steps button[data-step-index]')) {
            return {
                type: 'loop',
                stepIndex: activeElement.dataset.stepIndex
            }
        }

        if (activeElement.matches('#checklist-items input[data-item-id]')) {
            return {
                type: 'item-toggle',
                itemId: activeElement.dataset.itemId
            }
        }

        if (activeElement.matches('#checklist-items button[data-action]')) {
            const listItem = activeElement.closest('li[data-item-id]')

            if (!listItem) {
                return null
            }

            return {
                type: 'item-action',
                itemId: listItem.dataset.itemId,
                action: activeElement.dataset.action
            }
        }

        return null
    }

    function restoreFocus(focusTarget) {
        if (!focusTarget) {
            return
        }

        let target = null

        if (focusTarget.type === 'loop') {
            target = [...elements.loopSteps.querySelectorAll('button')].find(
                (button) =>
                    button.dataset.stepIndex === focusTarget.stepIndex
            )
        } else if (focusTarget.type === 'item-toggle') {
            target = [...elements.checklistItems.querySelectorAll('input')].find(
                (input) => input.dataset.itemId === focusTarget.itemId
            )
        } else if (focusTarget.type === 'item-action') {
            target = [
                ...elements.checklistItems.querySelectorAll('button[data-action]')
            ].find(
                (button) =>
                    button.closest('li[data-item-id]')?.dataset.itemId ===
                        focusTarget.itemId &&
                    button.dataset.action === focusTarget.action
            )
        }

        if (target && !target.disabled) {
            target.focus()
            return
        }

        if (focusTarget.itemId) {
            const fallback = [
                ...elements.checklistItems.querySelectorAll('input[data-item-id]')
            ].find((input) => input.dataset.itemId === focusTarget.itemId)

            if (fallback) {
                fallback.focus()
                return
            }
        }

        if (!elements.addItemInput.disabled) {
            elements.addItemInput.focus()
        } else if (!elements.checklistSelect.disabled) {
            elements.checklistSelect.focus()
        } else if (!elements.projectSelect.disabled) {
            elements.projectSelect.focus()
        }
    }

    async function fetchState() {
        let response

        try {
            response = await fetch(STATE_API, {
                headers: { accept: 'application/json' }
            })
        } catch (error) {
            throw new Error(
                'Cannot reach the local Pi Pairing server. Run scripts/ensure-server.sh first.'
            )
        }

        if (!response.ok) {
            throw new Error(`Could not load shared state (${response.status})`)
        }

        return response.json()
    }

    async function sendCommand(command) {
        let response

        try {
            response = await fetch(COMMAND_API, {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: JSON.stringify(command)
            })
        } catch (error) {
            throw new Error(
                'Cannot reach the local Pi Pairing server. Run scripts/ensure-server.sh first.'
            )
        }

        const body = await response.json().catch(() => ({}))

        if (!response.ok) {
            throw new Error(body.error || `Command failed (${response.status})`)
        }

        return body
    }

    function commit(command, successMessage) {
        const operation = commandQueue.then(async () => {
            try {
                const body = await sendCommand(command)

                if (!applyIncomingState(body.state)) {
                    throw new Error(
                        'The shared-state update was stale. Refresh the dashboard and try again.'
                    )
                }

                if (successMessage) {
                    showStatus(successMessage, 'success')
                }

                return true
            } catch (error) {
                showStatus(error.message, 'error')
                return false
            }
        })

        commandQueue = operation.catch(() => false)
        return operation
    }

    function applyIncomingState(nextState) {
        if (!nextState || !Number.isInteger(nextState.revision)) {
            return false
        }

        if (
            typeof nextState.serverInstanceId !== 'string' ||
            !Number.isInteger(nextState.serverStartedAt)
        ) {
            return false
        }

        const instanceChanged =
            nextState.serverInstanceId !== currentServerInstanceId

        if (instanceChanged) {
            if (
                currentServerInstanceId !== null &&
                nextState.serverStartedAt < currentServerStartedAt
            ) {
                return false
            }
        } else if (nextState.revision < state.revision) {
            return false
        }

        const focusTarget = captureFocus()
        state = nextState
        currentServerInstanceId = nextState.serverInstanceId
        currentServerStartedAt = nextState.serverStartedAt
        connected = true
        render()
        restoreFocus(focusTarget)
        return true
    }

    async function migrateLegacyState() {
        let legacyState = null

        try {
            legacyState = window.localStorage.getItem(LEGACY_STORAGE_KEY)
        } catch {
            return
        }

        if (!legacyState) {
            return
        }

        try {
            const parsedLegacyState = Core.parseState(legacyState)
            let migrationCompleted = false

            if (
                state.projects.length === 0 &&
                parsedLegacyState.projects.length > 0
            ) {
                const body = await sendCommand({
                    type: 'state.replace',
                    payload: {
                        state: parsedLegacyState,
                        expectedRevision: state.revision
                    }
                })
                if (!applyIncomingState(body.state)) {
                    throw new Error(
                        'Shared state changed while browser data was being migrated'
                    )
                }

                migrationCompleted = true
                showStatus('Imported saved browser data.', 'success')
            }

            if (migrationCompleted) {
                window.localStorage.removeItem(LEGACY_STORAGE_KEY)
                window.localStorage.removeItem(LEGACY_BACKUP_KEY)
            }
        } catch (error) {
            try {
                window.localStorage.setItem(LEGACY_BACKUP_KEY, legacyState)
            } catch {}

            showStatus(
                `Legacy browser data could not be imported: ${error.message}`,
                'error'
            )
        }
    }

    function connectEventStream() {
        if (eventSource) {
            return
        }

        eventSource = new EventSource(EVENTS_API)

        eventSource.addEventListener('state', (event) => {
            try {
                applyIncomingState(JSON.parse(event.data))
            } catch (error) {
                showStatus(`Live update could not be read: ${error.message}`, 'error')
            }
        })

        eventSource.addEventListener('open', () => {
            connected = true
            render()

            if (
                elements.statusMessage.textContent ===
                'Live updates are reconnecting.'
            ) {
                elements.statusMessage.textContent = ''
                delete elements.statusMessage.dataset.kind
            }
        })

        eventSource.addEventListener('error', () => {
            connected = false
            render()
            showStatus('Live updates are reconnecting.', 'error')
        })
    }

    function createSelectOption(value, label) {
        const option = document.createElement('option')
        option.value = value
        option.textContent = label
        return option
    }

    function createIconButton(
        action,
        label,
        symbol,
        disabled = false,
        extraClass = ''
    ) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = `icon-button${extraClass ? ` ${extraClass}` : ''}`
        button.dataset.action = action
        button.title = label
        button.setAttribute('aria-label', label)
        button.textContent = symbol
        button.disabled = disabled
        return button
    }

    function renderProjectControls() {
        const project = getActiveProject()

        elements.projectSelect.replaceChildren()

        if (state.projects.length === 0) {
            elements.projectSelect.append(
                createSelectOption('', 'No projects yet')
            )
            elements.projectSelect.disabled = true
        } else {
            state.projects.forEach((candidate) => {
                elements.projectSelect.append(
                    createSelectOption(candidate.id, candidate.name)
                )
            })
            elements.projectSelect.disabled = !connected
            elements.projectSelect.value = state.activeProjectId ?? ''
        }

        elements.addProjectButton.disabled = !connected
        elements.renameProjectButton.disabled = !project || !connected
        elements.deleteProjectButton.disabled = !project || !connected
    }

    function renderLoop() {
        const project = getActiveProject()
        elements.loopSteps.replaceChildren()

        if (!project) {
            elements.loopPosition.textContent = 'No project'
            elements.loopPrompt.textContent =
                'Create a project to begin tracking the pairing loop.'
            return
        }

        const activeStepIndex = project.currentLoopStep
        const activeStep = Core.LOOP_STEPS[activeStepIndex]

        elements.loopPosition.textContent = `Step ${activeStepIndex + 1} of ${
            Core.LOOP_STEPS.length
        }`
        elements.loopPrompt.textContent = activeStep.prompt

        Core.LOOP_STEPS.forEach((step, index) => {
            const listItem = document.createElement('li')
            const button = document.createElement('button')
            const number = document.createElement('span')
            const label = document.createElement('span')

            button.type = 'button'
            button.className = 'loop-step-button'
            button.dataset.stepIndex = String(index)
            button.disabled = !connected

            if (index === activeStepIndex) {
                button.setAttribute('aria-current', 'step')
            }

            number.className = 'step-number'
            number.textContent = String(index + 1).padStart(2, '0')

            label.className = 'step-label'
            label.textContent = step.label

            button.append(number, label)
            listItem.append(button)
            elements.loopSteps.append(listItem)
        })
    }

    function renderChecklistControls(project) {
        const checklist = getActiveChecklist(project)

        elements.checklistSelect.replaceChildren()

        if (!project) {
            elements.checklistSelect.append(
                createSelectOption('', 'No project selected')
            )
            elements.checklistSelect.disabled = true
        } else if (project.checklists.length === 0) {
            elements.checklistSelect.append(
                createSelectOption('', 'No checklists yet')
            )
            elements.checklistSelect.disabled = true
        } else {
            project.checklists.forEach((candidate) => {
                elements.checklistSelect.append(
                    createSelectOption(candidate.id, candidate.name)
                )
            })
            elements.checklistSelect.disabled = !connected
            elements.checklistSelect.value = project.activeChecklistId ?? ''
        }

        elements.addChecklistButton.disabled = !project || !connected
        elements.renameChecklistButton.disabled = !checklist || !connected
        elements.deleteChecklistButton.disabled = !checklist || !connected
        elements.addItemInput.disabled = !checklist || !connected
        elements.addItemSubmitButton.disabled = !checklist || !connected
    }

    function renderChecklistItems(project, checklist) {
        elements.checklistItems.replaceChildren()

        if (!checklist) {
            elements.checklistTitle.textContent = 'No checklist selected'
            elements.itemCount.textContent = '0 items'

            if (!project) {
                elements.checklistEmpty.textContent =
                    'Create or select a project to begin.'
            } else if (project.checklists.length === 0) {
                elements.checklistEmpty.textContent =
                    'Add a checklist to start tracking project work.'
            } else {
                elements.checklistEmpty.textContent =
                    'Select a checklist to view its items.'
            }

            elements.checklistEmpty.hidden = false
            return
        }

        elements.checklistTitle.textContent = checklist.name

        const completedCount = checklist.items.filter(
            (item) => item.completed
        ).length
        elements.itemCount.textContent = `${completedCount} of ${
            checklist.items.length
        } complete`

        checklist.items.forEach((item, index) => {
            const listItem = document.createElement('li')
            const main = document.createElement('label')
            const checkbox = document.createElement('input')
            const text = document.createElement('span')
            const actions = document.createElement('div')

            listItem.className = 'checklist-item'
            listItem.dataset.itemId = item.id

            if (item.completed) {
                listItem.classList.add('is-complete')
            }

            main.className = 'item-main'
            checkbox.type = 'checkbox'
            checkbox.checked = item.completed
            checkbox.disabled = !connected
            checkbox.dataset.itemId = item.id
            checkbox.setAttribute(
                'aria-label',
                `Mark ${item.text} as ${
                    item.completed ? 'incomplete' : 'complete'
                }`
            )

            text.className = 'item-text'
            text.textContent = item.text

            actions.className = 'item-actions'
            actions.append(
                createIconButton(
                    'move-up',
                    `Move ${item.text} up`,
                    '↑',
                    index === 0 || !connected
                ),
                createIconButton(
                    'move-down',
                    `Move ${item.text} down`,
                    '↓',
                    index === checklist.items.length - 1 || !connected
                ),
                createIconButton(
                    'rename',
                    `Rename ${item.text}`,
                    '✎',
                    !connected
                ),
                createIconButton(
                    'delete',
                    `Delete ${item.text}`,
                    '×',
                    !connected,
                    'danger'
                )
            )

            main.append(checkbox, text)
            listItem.append(main, actions)
            elements.checklistItems.append(listItem)
        })

        elements.checklistEmpty.hidden = checklist.items.length > 0
        elements.checklistEmpty.textContent =
            'This checklist is empty. Add the first item below.'
    }

    function renderResearch(project) {
        const round = project
            ? (project.research?.rounds?.find(
                  (candidate) => candidate.id === project.research.activeRoundId
              ) ?? null)
            : null

        elements.researchEntries.replaceChildren()

        if (!project) {
            elements.researchStatus.textContent = 'No project'
            elements.researchBeginForm.hidden = true
            elements.researchRound.hidden = true
            elements.researchWarning.hidden = true
            elements.loopGateHint.hidden = true
            return
        }

        if (!round) {
            elements.researchStatus.textContent = 'No round'
            elements.researchBeginForm.hidden = false
            elements.researchRound.hidden = true
            elements.researchWarning.hidden = true
            elements.loopGateHint.hidden = false
            return
        }

        elements.researchBeginForm.hidden = true
        elements.researchRound.hidden = false
        elements.researchStatus.textContent = round.status
        elements.researchRoundProblem.textContent = round.problem

        if (round.status === 'skipped') {
            elements.researchWarning.textContent = `Research was skipped: ${round.reason}`
            elements.researchWarning.hidden = false
        } else {
            elements.researchWarning.hidden = true
        }

        elements.researchConfirmButton.disabled = !(
            round.status === 'open' &&
            Core.hasQualifyingResearchEntry(round)
        )
        elements.researchSkipButton.disabled = round.status !== 'open'
        elements.researchNewRoundButton.disabled = round.status === 'open'
        elements.loopGateHint.hidden = Core.researchGateSatisfied(project)

        round.entries.forEach((entry) => {
            const listItem = document.createElement('li')
            const header = document.createElement('div')
            const kind = document.createElement('span')
            const title = document.createElement('strong')
            const confidence = document.createElement('span')
            const explanation = document.createElement('p')
            const sources = document.createElement('ul')

            listItem.className = 'research-entry'
            header.className = 'research-entry-header'

            kind.className = 'research-kind'
            kind.dataset.kind = entry.kind
            kind.textContent = entry.kind

            title.className = 'research-entry-title'
            title.textContent = entry.title

            confidence.className = 'research-confidence'
            confidence.textContent = entry.confidence

            header.append(kind, title, confidence)

            if (entry.explanation) {
                explanation.className = 'research-entry-explanation'
                explanation.textContent = entry.explanation
            }

            if (entry.sources.length > 0) {
                sources.className = 'research-sources'

                entry.sources.forEach((source) => {
                    const sourceItem = document.createElement('li')
                    const sourceLabel = document.createElement('span')

                    sourceLabel.textContent = `${source.label}: `

                    if (/^https?:\/\//i.test(source.location)) {
                        const link = document.createElement('a')
                        link.href = source.location
                        link.textContent = source.location
                        link.target = '_blank'
                        link.rel = 'noreferrer noopener'
                        sourceItem.append(sourceLabel, link)
                    } else {
                        const code = document.createElement('code')
                        code.textContent = source.location
                        sourceItem.append(sourceLabel, code)
                    }

                    sources.append(sourceItem)
                })
            }

            listItem.append(header)

            if (entry.explanation) {
                listItem.append(explanation)
            }

            if (entry.sources.length > 0) {
                listItem.append(sources)
            }

            elements.researchEntries.append(listItem)
        })
    }

    function render() {
        const project = getActiveProject()
        const checklist = getActiveChecklist(project)

        renderProjectControls()
        renderLoop()
        renderResearch(project)
        renderChecklistControls(project)
        renderChecklistItems(project, checklist)
    }

    function addProject() {
        const name = window.prompt('Project name')

        if (name === null) {
            return
        }

        commit(
            {
                type: 'project.add',
                payload: { name }
            },
            'Project added.'
        )
    }

    function renameProject() {
        const project = getActiveProject()

        if (!project) {
            return
        }

        const name = window.prompt('Rename project', project.name)

        if (name === null) {
            return
        }

        commit(
            {
                type: 'project.rename',
                payload: { nameOrId: project.id, name }
            },
            'Project renamed.'
        )
    }

    function deleteProject() {
        const project = getActiveProject()

        if (!project) {
            return
        }

        const confirmed = window.confirm(
            `Delete “${project.name}” and all of its checklists?`
        )

        if (!confirmed) {
            return
        }

        commit(
            {
                type: 'project.delete',
                payload: { nameOrId: project.id }
            },
            'Project deleted.'
        )
    }

    function addChecklist() {
        const project = getActiveProject()

        if (!project) {
            return
        }

        const name = window.prompt('Checklist name')

        if (name === null) {
            return
        }

        commit(
            {
                type: 'checklist.add',
                payload: { project: project.id, name }
            },
            'Checklist added.'
        )
    }

    function renameChecklist() {
        const project = getActiveProject()
        const checklist = getActiveChecklist(project)

        if (!project || !checklist) {
            return
        }

        const name = window.prompt('Rename checklist', checklist.name)

        if (name === null) {
            return
        }

        commit(
            {
                type: 'checklist.rename',
                payload: {
                    project: project.id,
                    nameOrId: checklist.id,
                    name
                }
            },
            'Checklist renamed.'
        )
    }

    function deleteChecklist() {
        const project = getActiveProject()
        const checklist = getActiveChecklist(project)

        if (!project || !checklist) {
            return
        }

        const confirmed = window.confirm(
            `Delete the checklist “${checklist.name}” and all of its items?`
        )

        if (!confirmed) {
            return
        }

        commit(
            {
                type: 'checklist.delete',
                payload: { project: project.id, nameOrId: checklist.id }
            },
            'Checklist deleted.'
        )
    }

    async function addItem() {
        const project = getActiveProject()
        const checklist = getActiveChecklist(project)
        const text = elements.addItemInput.value

        if (!project || !checklist) {
            return
        }

        const added = await commit(
            {
                type: 'item.add',
                payload: {
                    project: project.id,
                    checklist: checklist.id,
                    text
                }
            },
            'Item added.'
        )

        if (added) {
            elements.addItemInput.value = ''
            elements.addItemInput.focus()
        }
    }

    function handleItemAction(event) {
        const button = event.target.closest('button[data-action]')

        if (!button) {
            return
        }

        const listItem = button.closest('li[data-item-id]')

        if (!listItem) {
            return
        }

        const project = getActiveProject()
        const checklist = getActiveChecklist(project)
        const itemId = listItem.dataset.itemId

        if (!project || !checklist) {
            return
        }

        const item = checklist.items.find(
            (candidate) => candidate.id === itemId
        )

        if (!item) {
            return
        }

        const action = button.dataset.action

        if (action === 'move-up' || action === 'move-down') {
            commit(
                {
                    type: 'item.move',
                    payload: {
                        project: project.id,
                        checklist: checklist.id,
                        item: itemId,
                        direction: action === 'move-up' ? 'up' : 'down'
                    }
                },
                'Item reordered.'
            )
            return
        }

        if (action === 'rename') {
            const text = window.prompt('Rename item', item.text)

            if (text === null) {
                return
            }

            commit(
                {
                    type: 'item.rename',
                    payload: {
                        project: project.id,
                        checklist: checklist.id,
                        item: itemId,
                        text
                    }
                },
                'Item renamed.'
            )
            return
        }

        if (action === 'delete') {
            const confirmed = window.confirm(`Delete “${item.text}”?`)

            if (confirmed) {
                commit(
                    {
                        type: 'item.delete',
                        payload: {
                            project: project.id,
                            checklist: checklist.id,
                            item: itemId
                        }
                    },
                    'Item deleted.'
                )
            }
        }
    }

    elements.projectSelect.addEventListener('change', () => {
        const projectId = elements.projectSelect.value

        commit(
            {
                type: 'project.select',
                payload: { nameOrId: projectId }
            },
            'Project selected.'
        )
    })

    elements.addProjectButton.addEventListener('click', addProject)
    elements.renameProjectButton.addEventListener('click', renameProject)
    elements.deleteProjectButton.addEventListener('click', deleteProject)

    elements.checklistSelect.addEventListener('change', () => {
        const project = getActiveProject()
        const checklistId = elements.checklistSelect.value

        if (!project) {
            return
        }

        commit(
            {
                type: 'checklist.select',
                payload: { project: project.id, nameOrId: checklistId }
            },
            'Checklist selected.'
        )
    })

    elements.addChecklistButton.addEventListener('click', addChecklist)
    elements.renameChecklistButton.addEventListener('click', renameChecklist)
    elements.deleteChecklistButton.addEventListener('click', deleteChecklist)

    elements.loopSteps.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-step-index]')
        const project = getActiveProject()

        if (!button || !project) {
            return
        }

        const stepNumber = Number(button.dataset.stepIndex) + 1

        commit(
            {
                type: 'loop.set',
                payload: { project: project.id, step: stepNumber }
            },
            'Pairing loop updated.'
        )
    })

    elements.checklistItems.addEventListener('change', (event) => {
        const checkbox = event.target.closest('input[type="checkbox"]')
        const project = getActiveProject()
        const checklist = getActiveChecklist(project)

        if (!checkbox || !project || !checklist) {
            return
        }

        const itemId = checkbox.dataset.itemId

        commit(
            {
                type: 'item.complete',
                payload: {
                    project: project.id,
                    checklist: checklist.id,
                    item: itemId,
                    completed: checkbox.checked
                }
            },
            checkbox.checked ? 'Item completed.' : 'Item reopened.'
        )
    })

    elements.checklistItems.addEventListener('click', handleItemAction)

    elements.addItemForm.addEventListener('submit', (event) => {
        event.preventDefault()
        void addItem()
    })

    elements.researchBeginForm.addEventListener('submit', (event) => {
        event.preventDefault()

        const project = getActiveProject()
        const problem = elements.researchProblemInput.value.trim()

        if (!project || !problem) {
            return
        }

        void commit(
            {
                type: 'research.begin',
                payload: { project: project.id, problem }
            },
            'Research round started.'
        ).then(() => {
            elements.researchProblemInput.value = ''
        })
    })

    elements.researchAddForm.addEventListener('submit', (event) => {
        event.preventDefault()

        const project = getActiveProject()
        const title = elements.researchTitleInput.value.trim()
        const explanation = elements.researchExplanationInput.value.trim()
        const sourceLabel = elements.researchSourceLabel.value.trim()
        const sourceLocation = elements.researchSourceLocation.value.trim()
        const sources =
            sourceLabel && sourceLocation
                ? [{ label: sourceLabel, location: sourceLocation }]
                : []

        if (!project || !title) {
            return
        }

        void commit(
            {
                type: 'research.add',
                payload: {
                    project: project.id,
                    kind: elements.researchKind.value,
                    title,
                    explanation,
                    sources,
                    confidence: elements.researchConfidence.value,
                    relatedItemIds: []
                }
            },
            'Research entry recorded.'
        ).then(() => {
            elements.researchTitleInput.value = ''
            elements.researchExplanationInput.value = ''
            elements.researchSourceLabel.value = ''
            elements.researchSourceLocation.value = ''
        })
    })

    elements.researchConfirmButton.addEventListener('click', () => {
        const project = getActiveProject()

        if (!project) {
            return
        }

        void commit(
            {
                type: 'research.confirm',
                payload: { project: project.id }
            },
            'Research confirmed.'
        )
    })

    elements.researchSkipButton.addEventListener('click', () => {
        const project = getActiveProject()

        if (!project) {
            return
        }

        const reason = window.prompt(
            'Why is research being skipped for this problem?'
        )

        if (reason === null) {
            return
        }

        void commit(
            {
                type: 'research.skip',
                payload: { project: project.id, reason }
            },
            'Research skipped.'
        )
    })

    elements.researchNewRoundButton.addEventListener('click', () => {
        const project = getActiveProject()

        if (!project) {
            return
        }

        const problem = window.prompt('What problem should this round research?')

        if (problem === null) {
            return
        }

        void commit(
            {
                type: 'research.begin',
                payload: { project: project.id, problem }
            },
            'New research round started.'
        )
    })

    async function retryStateLoad() {
        try {
            const nextState = await fetchState()
            applyIncomingState(nextState)
            await migrateLegacyState()
        } catch (error) {
            window.clearTimeout(stateRetryTimer)
            stateRetryTimer = window.setTimeout(retryStateLoad, 2000)
        }
    }

    async function initialize() {
        render()
        connectEventStream()

        try {
            const nextState = await fetchState()
            applyIncomingState(nextState)
            await migrateLegacyState()
            connected = true
            render()
        } catch (error) {
            connected = false
            render()
            showStatus(
                `Pi Pairing could not connect to its local server: ${error.message}`,
                'error'
            )
            window.clearTimeout(stateRetryTimer)
            stateRetryTimer = window.setTimeout(retryStateLoad, 2000)
        }
    }

    void initialize()
})()
