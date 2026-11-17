const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const Core = require('./core.js')
const StateStore = require('./state-store.js')
const { createPairingServer } = require('./server.js')

async function startTestServer(providedStateStore) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-pairing-server-'))
    const stateStore =
        providedStateStore ??
        new StateStore(path.join(directory, 'state.json'))
    const server = createPairingServer({ stateStore })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()

    return {
        server,
        stateStore,
        baseUrl: `http://127.0.0.1:${address.port}`
    }
}

async function stopTestServer(server) {
    await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
    })
}

test('the server exposes the current state and applies commands', async (t) => {
    const { server, baseUrl } = await startTestServer()
    t.after(() => stopTestServer(server))

    const initialResponse = await fetch(`${baseUrl}/api/state`)
    assert.equal(initialResponse.status, 200)
    const initialState = await initialResponse.json()
    assert.equal(initialState.version, Core.createInitialState().version)
    assert.equal(initialState.revision, 0)
    assert.equal(initialState.projects.length, 0)
    assert.equal(typeof initialState.serverInstanceId, 'string')
    assert.equal(typeof initialState.serverStartedAt, 'number')

    const commandResponse = await fetch(`${baseUrl}/api/command`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            type: 'project.add',
            payload: { name: 'Campus' }
        })
    })

    assert.equal(commandResponse.status, 200)
    const body = await commandResponse.json()
    assert.equal(body.state.projects[0].name, 'Campus')
    assert.equal(
        body.state.serverInstanceId,
        initialState.serverInstanceId
    )
    assert.match(body.message, /created and activated/i)
})

test('the server increments revisions for accepted mutations', async (t) => {
    const { server, baseUrl } = await startTestServer()
    t.after(() => stopTestServer(server))

    const first = await fetch(`${baseUrl}/api/command`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            type: 'project.add',
            payload: { name: 'Campus' }
        })
    })
    const firstBody = await first.json()

    assert.equal(firstBody.state.revision, 1)

    const second = await fetch(`${baseUrl}/api/command`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            type: 'checklist.add',
            payload: { project: 'Campus', name: 'Backend' }
        })
    })
    const secondBody = await second.json()

    assert.equal(secondBody.state.revision, 2)
})

test('the server rejects non-JSON content types and foreign origins', async (t) => {
    const { server, baseUrl } = await startTestServer()
    t.after(() => stopTestServer(server))

    const wrongContentType = await fetch(`${baseUrl}/api/command`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ type: 'project.add', payload: { name: 'Bad' } })
    })
    assert.equal(wrongContentType.status, 415)

    const foreignOrigin = await fetch(`${baseUrl}/api/command`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            origin: 'https://evil.example'
        },
        body: JSON.stringify({ type: 'project.add', payload: { name: 'Bad' } })
    })
    assert.equal(foreignOrigin.status, 403)
})

test('the server rejects API requests with a foreign host header', async (t) => {
    const { server, baseUrl } = await startTestServer()
    t.after(() => stopTestServer(server))
    const address = new URL(baseUrl)
    const response = await new Promise((resolve, reject) => {
        const request = http.request(
            {
                hostname: '127.0.0.1',
                port: address.port,
                path: '/api/state',
                headers: { host: 'evil.example' }
            },
            (apiResponse) => {
                apiResponse.resume()
                apiResponse.on('end', () => resolve(apiResponse))
            }
        )

        request.on('error', reject)
        request.end()
    })

    assert.equal(response.statusCode, 403)
    assert.ok(address.port)
})

test('a failed persistence write does not mutate the in-memory state', async (t) => {
    const initialState = Core.createInitialState()
    const failingStore = {
        load: () => initialState,
        save: () => {
            throw new Error('disk is read-only')
        }
    }
    const { server, baseUrl } = await startTestServer(failingStore)
    t.after(() => stopTestServer(server))

    const commandResponse = await fetch(`${baseUrl}/api/command`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            type: 'project.add',
            payload: { name: 'Campus' }
        })
    })
    assert.equal(commandResponse.status, 500)

    const stateResponse = await fetch(`${baseUrl}/api/state`)
    const state = await stateResponse.json()
    assert.equal(state.projects.length, 0)
    assert.equal(state.revision, 0)
})

test('the server rejects invalid commands and oversized bodies', async (t) => {
    const { server, baseUrl } = await startTestServer()
    t.after(() => stopTestServer(server))

    const invalidJson = await fetch(`${baseUrl}/api/command`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{invalid'
    })
    assert.equal(invalidJson.status, 400)

    const unknownCommand = await fetch(`${baseUrl}/api/command`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'unknown.command' })
    })
    assert.equal(unknownCommand.status, 400)

    const oversized = await fetch(`${baseUrl}/api/command`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'project.add', payload: { name: 'x'.repeat(70_000) } })
    })
    assert.equal(oversized.status, 413)
})

test('the server broadcasts command results to every event client', async (t) => {
    const { server, baseUrl } = await startTestServer()
    t.after(() => stopTestServer(server))

    const firstResponse = await fetch(`${baseUrl}/api/events`)
    const secondResponse = await fetch(`${baseUrl}/api/events`)
    const firstReader = firstResponse.body.getReader()
    const secondReader = secondResponse.body.getReader()
    const decoder = new TextDecoder()

    await firstReader.read()
    await secondReader.read()

    await fetch(`${baseUrl}/api/command`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            type: 'project.add',
            payload: { name: 'Campus' }
        })
    })

    const [firstEvent, secondEvent] = await Promise.all([
        firstReader.read(),
        secondReader.read()
    ])

    assert.match(decoder.decode(firstEvent.value), /"name":"Campus"/)
    assert.match(decoder.decode(secondEvent.value), /"name":"Campus"/)
    await firstReader.cancel()
    await secondReader.cancel()
})

test('the server serves only allowlisted static assets', async (t) => {
    const { server, baseUrl } = await startTestServer()
    t.after(() => stopTestServer(server))

    const indexResponse = await fetch(`${baseUrl}/`)
    assert.equal(indexResponse.status, 200)
    assert.match(indexResponse.headers.get('content-type'), /text\/html/)

    const scriptResponse = await fetch(`${baseUrl}/core.js`)
    assert.equal(scriptResponse.status, 200)
    assert.match(scriptResponse.headers.get('content-type'), /javascript/)

    const privateResponse = await fetch(`${baseUrl}/state.json`)
    assert.equal(privateResponse.status, 404)

    const traversalResponse = await fetch(`${baseUrl}/../package.json`)
    assert.equal(traversalResponse.status, 404)
})

test('the server broadcasts command results through server-sent events', async (t) => {
    const { server, baseUrl } = await startTestServer()
    t.after(() => stopTestServer(server))

    const eventResponse = await fetch(`${baseUrl}/api/events`)
    assert.equal(eventResponse.status, 200)
    assert.match(eventResponse.headers.get('content-type'), /text\/event-stream/)

    const reader = eventResponse.body.getReader()
    const decoder = new TextDecoder()
    const firstEvent = await reader.read()
    const initialText = decoder.decode(firstEvent.value)
    assert.match(initialText, /event: state/)
    assert.match(initialText, /"projects":\[\]/)

    await fetch(`${baseUrl}/api/command`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            type: 'project.add',
            payload: { name: 'Campus' }
        })
    })

    const secondEvent = await reader.read()
    const updateText = decoder.decode(secondEvent.value)
    assert.match(updateText, /"name":"Campus"/)
    await reader.cancel()
})
