const test = require('node:test')
const assert = require('node:assert/strict')
const Cli = require('./cli.js')

test('parses project commands', () => {
    assert.deepEqual(Cli.parseCommand(['project', 'add', 'Campus App']), {
        type: 'project.add',
        payload: { name: 'Campus App' }
    })
    assert.deepEqual(Cli.parseCommand(['project', 'select', 'Campus App']), {
        type: 'project.select',
        payload: { nameOrId: 'Campus App' }
    })
    assert.deepEqual(
        Cli.parseCommand(['project', 'rename', 'Campus', 'Campus Web']),
        {
            type: 'project.rename',
            payload: { nameOrId: 'Campus', name: 'Campus Web' }
        }
    )
    assert.deepEqual(Cli.parseCommand(['project', 'delete', 'Campus']), {
        type: 'project.delete',
        payload: { nameOrId: 'Campus' }
    })
})

test('parses checklist commands', () => {
    assert.deepEqual(
        Cli.parseCommand(['checklist', 'add', 'Campus', 'Current Work']),
        {
            type: 'checklist.add',
            payload: { project: 'Campus', name: 'Current Work' }
        }
    )
    assert.deepEqual(
        Cli.parseCommand(['checklist', 'select', 'Campus', 'Backend']),
        {
            type: 'checklist.select',
            payload: { project: 'Campus', nameOrId: 'Backend' }
        }
    )
    assert.deepEqual(
        Cli.parseCommand(['checklist', 'rename', 'Campus', 'Backend', 'API']),
        {
            type: 'checklist.rename',
            payload: { project: 'Campus', nameOrId: 'Backend', name: 'API' }
        }
    )
    assert.deepEqual(
        Cli.parseCommand(['checklist', 'delete', 'Campus', 'Backend']),
        {
            type: 'checklist.delete',
            payload: { project: 'Campus', nameOrId: 'Backend' }
        }
    )
})

test('parses item commands', () => {
    assert.deepEqual(
        Cli.parseCommand([
            'item',
            'add',
            'Campus',
            'Current Work',
            'Inspect the API'
        ]),
        {
            type: 'item.add',
            payload: {
                project: 'Campus',
                checklist: 'Current Work',
                text: 'Inspect the API'
            }
        }
    )
    assert.deepEqual(
        Cli.parseCommand([
            'item',
            'complete',
            'Campus',
            'Current Work',
            'Inspect the API'
        ]),
        {
            type: 'item.complete',
            payload: {
                project: 'Campus',
                checklist: 'Current Work',
                item: 'Inspect the API',
                completed: true
            }
        }
    )
    assert.deepEqual(
        Cli.parseCommand([
            'item',
            'reopen',
            'Campus',
            'Current Work',
            'Inspect the API'
        ]),
        {
            type: 'item.complete',
            payload: {
                project: 'Campus',
                checklist: 'Current Work',
                item: 'Inspect the API',
                completed: false
            }
        }
    )
    assert.deepEqual(
        Cli.parseCommand([
            'item',
            'rename',
            'Campus',
            'Current Work',
            'Inspect the API',
            'Inspect the endpoint'
        ]),
        {
            type: 'item.rename',
            payload: {
                project: 'Campus',
                checklist: 'Current Work',
                item: 'Inspect the API',
                text: 'Inspect the endpoint'
            }
        }
    )
    assert.deepEqual(
        Cli.parseCommand([
            'item',
            'move',
            'Campus',
            'Current Work',
            'Inspect the API',
            'up'
        ]),
        {
            type: 'item.move',
            payload: {
                project: 'Campus',
                checklist: 'Current Work',
                item: 'Inspect the API',
                direction: 'up'
            }
        }
    )
    assert.deepEqual(
        Cli.parseCommand([
            'item',
            'delete',
            'Campus',
            'Current Work',
            'Inspect the API'
        ]),
        {
            type: 'item.delete',
            payload: {
                project: 'Campus',
                checklist: 'Current Work',
                item: 'Inspect the API'
            }
        }
    )
})

test('parses loop commands and converts numeric positions', () => {
    assert.deepEqual(Cli.parseCommand(['loop', 'set', 'Campus', 'Review']), {
        type: 'loop.set',
        payload: { project: 'Campus', step: 'Review' }
    })
    assert.deepEqual(Cli.parseCommand(['loop', 'set', 'Campus', '4']), {
        type: 'loop.set',
        payload: { project: 'Campus', step: 4 }
    })
})

test('recognizes the state listing command', () => {
    assert.deepEqual(Cli.parseCommand(['state']), { kind: 'state' })
})

test('parses research commands', () => {
    assert.deepEqual(
        Cli.parseCommand(['research', 'begin', 'Campus', 'Add validation']),
        {
            type: 'research.begin',
            payload: { project: 'Campus', problem: 'Add validation' }
        }
    )
    assert.deepEqual(
        Cli.parseCommand([
            'research',
            'add',
            'Campus',
            'finding',
            'Append-only corrections',
            'The audit spec requires append-only corrections.',
            '--source',
            'Audit spec|docs/audit.md',
            '--confidence',
            'high',
            '--link',
            'item-1'
        ]),
        {
            type: 'research.add',
            payload: {
                project: 'Campus',
                kind: 'finding',
                title: 'Append-only corrections',
                explanation:
                    'The audit spec requires append-only corrections.',
                sources: [{ label: 'Audit spec', location: 'docs/audit.md' }],
                confidence: 'high',
                relatedItemIds: ['item-1']
            }
        }
    )
    assert.deepEqual(
        Cli.parseCommand(['research', 'confirm', 'Campus']),
        {
            type: 'research.confirm',
            payload: { project: 'Campus' }
        }
    )
    assert.deepEqual(
        Cli.parseCommand(['research', 'skip', 'Campus', 'Already reviewed']),
        {
            type: 'research.skip',
            payload: { project: 'Campus', reason: 'Already reviewed' }
        }
    )
    assert.deepEqual(Cli.parseCommand(['research', 'list', 'Campus']), {
        kind: 'research-list',
        payload: { project: 'Campus' }
    })
})

test('parses data management commands', () => {
    assert.deepEqual(Cli.parseCommand(['projects']), {
        kind: 'projects',
        payload: {}
    })
    assert.deepEqual(Cli.parseCommand(['export', '/tmp/state.json']), {
        kind: 'export',
        payload: { file: '/tmp/state.json' }
    })
    assert.deepEqual(Cli.parseCommand(['import', '/tmp/state.json']), {
        kind: 'import',
        payload: { file: '/tmp/state.json' }
    })
    assert.deepEqual(Cli.parseCommand(['data-path']), {
        kind: 'data-path',
        payload: {}
    })
})

test('maps network failures to an actionable server message', async () => {
    await assert.rejects(
        () =>
            Cli.runCli(['project', 'add', 'Campus'], {
                fetchImpl: async () => {
                    throw new Error('fetch failed')
                }
            }),
        /Could not reach the Pi Pairing server.*ensure-server\.sh/i
    )
})

test('rejects unknown commands and missing arguments', () => {
    assert.throws(
        () => Cli.parseCommand(['unknown', 'value']),
        /Unknown command/i
    )
    assert.throws(
        () => Cli.parseCommand(['project', 'add']),
        /requires/i
    )
    assert.throws(
        () => Cli.parseCommand(['item', 'move', 'Campus', 'Work', 'Task']),
        /requires/i
    )
})
