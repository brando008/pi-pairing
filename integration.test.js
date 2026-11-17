const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Cli = require('./cli.js')
const StateStore = require('./state-store.js')
const { createPairingServer } = require('./server.js')

async function startTestServer() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-pairing-e2e-'))
    const stateFile = path.join(directory, 'state.json')
    const stateStore = new StateStore(stateFile)
    const server = createPairingServer({ stateStore })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()

    return {
        server,
        stateFile,
        baseUrl: `http://127.0.0.1:${address.port}`
    }
}

async function stopTestServer(server) {
    await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
    })
}

test('CLI commands build the same shared state exposed by the API', async (t) => {
    const { server, stateFile, baseUrl } = await startTestServer()
    t.after(() => stopTestServer(server))
    const output = []

    await Cli.runCli(['project', 'add', 'Campus'], {
        baseUrl,
        output: (message) => output.push(message)
    })
    await Cli.runCli(
        ['checklist', 'add', 'Campus', 'Current Work'],
        { baseUrl, output: (message) => output.push(message) }
    )
    await Cli.runCli(
        ['item', 'add', 'Campus', 'Current Work', 'Inspect the API'],
        { baseUrl, output: (message) => output.push(message) }
    )
    await Cli.runCli(['loop', 'set', 'Campus', 'Inspection'], {
        baseUrl,
        output: (message) => output.push(message)
    })

    const response = await fetch(`${baseUrl}/api/state`)
    const state = await response.json()
    const project = state.projects[0]
    const checklist = project.checklists[0]

    assert.equal(state.activeProjectId, project.id)
    assert.equal(project.name, 'Campus')
    assert.equal(project.currentLoopStep, 1)
    assert.equal(project.activeChecklistId, checklist.id)
    assert.equal(checklist.name, 'Current Work')
    assert.equal(checklist.items[0].text, 'Inspect the API')
    assert.equal(output.length, 4)

    const persistedState = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    assert.equal(persistedState.projects[0].name, 'Campus')
    assert.equal(persistedState.revision, 4)
})
