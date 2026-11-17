const fs = require('node:fs')
const path = require('node:path')
const Core = require('./core.js')
const StateStore = require('./state-store.js')

const DEFAULT_BASE_URL = process.env.PI_PAIRING_URL || 'http://127.0.0.1:4173'

const HELP_TEXT = `Pi Pairing CLI

Usage:
  pairing project add "<name>"
  pairing project select "<name>"
  pairing project rename "<name>" "<new name>"
  pairing project delete "<name>"
  pairing checklist add "<project>" "<name>"
  pairing checklist select "<project>" "<name>"
  pairing checklist rename "<project>" "<name>" "<new name>"
  pairing checklist delete "<project>" "<name>"
  pairing item add "<project>" "<checklist>" "<text>"
  pairing item complete "<project>" "<checklist>" "<item>"
  pairing item reopen "<project>" "<checklist>" "<item>"
  pairing item rename "<project>" "<checklist>" "<item>" "<new text>"
  pairing item move "<project>" "<checklist>" "<item>" <up|down>
  pairing item delete "<project>" "<checklist>" "<item>"
  pairing loop set "<project>" "<step or 1-8>"
  pairing understanding set "<project>" "<summary>"
  pairing understanding confirm "<project>"
  pairing understanding show "<project>"
  pairing project depth "<project>" <concise|standard|deep>
  pairing projects
  pairing export "<file.json>"
  pairing import "<file.json>"
  pairing data-path

The dashboard server must be running at ${DEFAULT_BASE_URL}.`

function requireArguments(args, count, usage) {
    if (args.length !== count) {
        throw new Error(`This command requires ${usage}`)
    }

    return args
}

function parseCommand(args) {
    if (args.length === 0) {
        throw new Error(`A command is required.\n\n${HELP_TEXT}`)
    }

    if (args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
        return { kind: 'help' }
    }

    if (args[0] === 'state' && args.length === 1) {
        return { kind: 'state' }
    }

    if (args[0] === 'projects' && args.length === 1) {
        return { kind: 'projects', payload: {} }
    }

    if (args[0] === 'data-path' && args.length === 1) {
        return { kind: 'data-path', payload: {} }
    }

    if (args[0] === 'export' && args.length === 2) {
        return { kind: 'export', payload: { file: args[1] } }
    }

    if (args[0] === 'import' && args.length === 2) {
        return { kind: 'import', payload: { file: args[1] } }
    }

    if (args[0] === 'project') {
        const operation = args[1]

        if (operation === 'add') {
            const [name] = requireArguments(args.slice(2), 1, 'a project name')
            return {
                type: 'project.add',
                payload: { name }
            }
        }

        if (operation === 'select') {
            const [nameOrId] = requireArguments(
                args.slice(2),
                1,
                'a project name or ID'
            )
            return {
                type: 'project.select',
                payload: { nameOrId }
            }
        }

        if (operation === 'rename') {
            const [nameOrId, name] = requireArguments(
                args.slice(2),
                2,
                'a project name or ID and a new name'
            )
            return {
                type: 'project.rename',
                payload: { nameOrId, name }
            }
        }

        if (operation === 'delete') {
            const [nameOrId] = requireArguments(
                args.slice(2),
                1,
                'a project name or ID'
            )
            return {
                type: 'project.delete',
                payload: { nameOrId }
            }
        }

        if (operation === 'depth') {
            const [project, depth] = requireArguments(
                args.slice(2),
                2,
                'a project and depth (concise, standard, or deep)'
            )
            return {
                type: 'project.depth',
                payload: { project, depth }
            }
        }
    }

    if (args[0] === 'checklist') {
        const operation = args[1]

        if (operation === 'add') {
            const [project, name] = requireArguments(
                args.slice(2),
                2,
                'a project and checklist name'
            )
            return {
                type: 'checklist.add',
                payload: { project, name }
            }
        }

        if (operation === 'select') {
            const [project, nameOrId] = requireArguments(
                args.slice(2),
                2,
                'a project and checklist name or ID'
            )
            return {
                type: 'checklist.select',
                payload: { project, nameOrId }
            }
        }

        if (operation === 'rename') {
            const [project, nameOrId, name] = requireArguments(
                args.slice(2),
                3,
                'a project, checklist name or ID, and a new name'
            )
            return {
                type: 'checklist.rename',
                payload: { project, nameOrId, name }
            }
        }

        if (operation === 'delete') {
            const [project, nameOrId] = requireArguments(
                args.slice(2),
                2,
                'a project and checklist name or ID'
            )
            return {
                type: 'checklist.delete',
                payload: { project, nameOrId }
            }
        }
    }

    if (args[0] === 'item') {
        const operation = args[1]

        if (operation === 'add') {
            const [project, checklist, text] = requireArguments(
                args.slice(2),
                3,
                'a project, checklist, and item text'
            )
            return {
                type: 'item.add',
                payload: { project, checklist, text }
            }
        }

        if (operation === 'complete' || operation === 'reopen') {
            const [project, checklist, item] = requireArguments(
                args.slice(2),
                3,
                'a project, checklist, and item'
            )
            return {
                type: 'item.complete',
                payload: {
                    project,
                    checklist,
                    item,
                    completed: operation === 'complete'
                }
            }
        }

        if (operation === 'rename') {
            const [project, checklist, item, text] = requireArguments(
                args.slice(2),
                4,
                'a project, checklist, item, and new text'
            )
            return {
                type: 'item.rename',
                payload: { project, checklist, item, text }
            }
        }

        if (operation === 'move') {
            const [project, checklist, item, direction] = requireArguments(
                args.slice(2),
                4,
                'a project, checklist, item, and direction (up or down)'
            )

            if (direction !== 'up' && direction !== 'down') {
                throw new Error('Item direction must be up or down')
            }

            return {
                type: 'item.move',
                payload: { project, checklist, item, direction }
            }
        }

        if (operation === 'delete') {
            const [project, checklist, item] = requireArguments(
                args.slice(2),
                3,
                'a project, checklist, and item'
            )
            return {
                type: 'item.delete',
                payload: { project, checklist, item }
            }
        }
    }

    if (args[0] === 'loop') {
        if (args[1] === 'set') {
            const [project, rawStep] = requireArguments(
                args.slice(2),
                2,
                'a project and loop step'
            )
            const step = /^\d+$/.test(rawStep) ? Number(rawStep) : rawStep

            return {
                type: 'loop.set',
                payload: { project, step }
            }
        }
    }

    if (args[0] === 'understanding') {
        const operation = args[1]

        if (operation === 'set') {
            const [project, summary] = requireArguments(
                args.slice(2),
                2,
                'a project and a summary'
            )
            return {
                type: 'understanding.set',
                payload: { project, summary }
            }
        }

        if (operation === 'confirm') {
            const [project] = requireArguments(
                args.slice(2),
                1,
                'a project'
            )
            return {
                type: 'understanding.confirm',
                payload: { project }
            }
        }

        if (operation === 'show') {
            const [project] = requireArguments(
                args.slice(2),
                1,
                'a project'
            )
            return {
                kind: 'understanding-show',
                payload: { project }
            }
        }
    }

    throw new Error(
        `Unknown command: ${args.slice(0, 2).join(' ')}\n\n${HELP_TEXT}`
    )
}

function findProjectByName(state, name) {
    const normalizedName = String(name ?? '').trim().toLowerCase()
    const project = state.projects.find(
        (candidate) =>
            candidate.id === name ||
            candidate.name.trim().toLowerCase() === normalizedName
    )

    if (!project) {
        throw new Error(`Project not found: ${name}`)
    }

    return project
}

function formatState(state) {
    if (!state.projects || state.projects.length === 0) {
        return 'No projects yet.'
    }

    const lines = ['Projects:']

    for (const project of state.projects) {
        const activeMarker = project.id === state.activeProjectId ? ' [active]' : ''
        const step =
            Core.LOOP_STEPS[project.currentLoopStep]?.label ??
            `Step ${project.currentLoopStep + 1}`
        lines.push(`- ${project.name}${activeMarker} — ${step}`)

        const understanding = project.understanding
        lines.push(
            `  Depth: ${project.depth} · Understanding: ${understanding.status}`
        )

        if (understanding.summary) {
            for (const line of understanding.summary.split('\n')) {
                lines.push(`    ${line}`)
            }
        }

        for (const checklist of project.checklists) {
            const checklistMarker =
                checklist.id === project.activeChecklistId ? ' [active]' : ''
            lines.push(`  - ${checklist.name}${checklistMarker}`)

            for (const item of checklist.items) {
                const completedMarker = item.completed ? 'x' : ' '
                lines.push(`    - [${completedMarker}] ${item.text}`)
            }
        }
    }

    return lines.join('\n')
}

function formatProjects(state) {
    if (!state.projects || state.projects.length === 0) {
        return 'No projects yet.'
    }

    return state.projects
        .map((project) => {
            const activeMarker = project.id === state.activeProjectId ? ' *' : ''
            const understanding = project.understanding
            return `${project.name}${activeMarker} — ${project.depth}, understanding ${understanding.status}`
        })
        .join('\n')
}

function formatUnderstanding(project) {
    const understanding = project.understanding

    if (!understanding.summary) {
        return `No understanding summary for ${project.name} yet.`
    }

    return [
        `Understanding for ${project.name} (${understanding.status}, depth ${project.depth}):`,
        understanding.summary
    ].join('\n')
}

function stripServerMetadata(state) {
    const { serverInstanceId, serverStartedAt, ...persistedState } = state
    return persistedState
}

async function request(fetchImpl, url, options, baseUrl) {
    try {
        return await fetchImpl(url, options)
    } catch (error) {
        throw new Error(
            `Could not reach the Pi Pairing server at ${baseUrl}. Run scripts/ensure-server.sh first.`
        )
    }
}

async function fetchState(fetchImpl, baseUrl) {
    const response = await request(
        fetchImpl,
        `${baseUrl}/api/state`,
        undefined,
        baseUrl
    )

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Request failed with ${response.status}`)
    }

    return response.json()
}

async function sendCommand(fetchImpl, baseUrl, command) {
    const response = await request(
        fetchImpl,
        `${baseUrl}/api/command`,
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(command)
        },
        baseUrl
    )
    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
        throw new Error(body.error || `Request failed with ${response.status}`)
    }

    return body
}

async function runCli(args, {
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl = globalThis.fetch,
    output = console.log
} = {}) {
    const command = parseCommand(args)

    if (command.kind === 'help') {
        output(HELP_TEXT)
        return { kind: 'help' }
    }

    if (command.kind === 'data-path') {
        const dataPath =
            typeof StateStore.defaultStateFile === 'function'
                ? StateStore.defaultStateFile()
                : StateStore.DEFAULT_STATE_FILE
        output(dataPath)
        return { kind: 'data-path', dataPath }
    }

    if (command.kind === 'state') {
        const state = await fetchState(fetchImpl, baseUrl)
        output(formatState(state))
        return { kind: 'state', state }
    }

    if (command.kind === 'projects') {
        const state = await fetchState(fetchImpl, baseUrl)
        output(formatProjects(state))
        return { kind: 'projects', state }
    }

    if (command.kind === 'understanding-show') {
        const state = await fetchState(fetchImpl, baseUrl)
        const project = findProjectByName(state, command.payload.project)
        output(formatUnderstanding(project))
        return { kind: 'understanding-show', project }
    }

    if (command.kind === 'export') {
        const state = await fetchState(fetchImpl, baseUrl)
        const persistedState = stripServerMetadata(state)
        fs.writeFileSync(
            command.payload.file,
            `${JSON.stringify(persistedState, null, 4)}\n`,
            'utf8'
        )
        output(`Exported shared state to ${command.payload.file}`)
        return { kind: 'export', file: command.payload.file }
    }

    if (command.kind === 'import') {
        const rawState = fs.readFileSync(command.payload.file, 'utf8')
        const importedState = Core.parseState(rawState)
        const currentState = await fetchState(fetchImpl, baseUrl)
        const body = await sendCommand(fetchImpl, baseUrl, {
            type: 'state.replace',
            payload: {
                state: importedState,
                expectedRevision: currentState.revision,
                force: true
            }
        })
        output(`Imported shared state from ${command.payload.file}`)
        return { kind: 'import', file: command.payload.file, body }
    }

    const body = await sendCommand(fetchImpl, baseUrl, command)

    const warning = body.warning ?? body.result?.warning

    if (warning) {
        output(warning)
    }

    output(body.message)
    return body
}

if (require.main === module) {
    runCli(process.argv.slice(2)).catch((error) => {
        console.error(`Error: ${error.message}`)
        process.exitCode = 1
    })
}

module.exports = {
    HELP_TEXT,
    parseCommand,
    formatState,
    formatProjects,
    formatUnderstanding,
    runCli
}
