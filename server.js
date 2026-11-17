const { randomUUID } = require('node:crypto')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const Core = require('./core.js')
const { applyCommand } = require('./commands.js')
const StateStore = require('./state-store.js')

const MAX_REQUEST_BYTES = 64 * 1024

const STATIC_FILES = new Map([
    ['/', 'index.html'],
    ['/index.html', 'index.html'],
    ['/styles.css', 'styles.css'],
    ['/core.js', 'core.js'],
    ['/app.js', 'app.js']
])

const CONTENT_TYPES = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8']
])

function sendJson(response, statusCode, body) {
    const payload = JSON.stringify(body)

    response.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(payload),
        'cache-control': 'no-store'
    })
    response.end(payload)
}

async function readJsonBody(request) {
    const chunks = []
    let size = 0

    for await (const chunk of request) {
        size += chunk.length

        if (size > MAX_REQUEST_BYTES) {
            const error = new Error('Request body is too large')
            error.statusCode = 413
            throw error
        }

        chunks.push(chunk)
    }

    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch (error) {
        const parseError = new Error(`Invalid JSON body: ${error.message}`)
        parseError.statusCode = 400
        throw parseError
    }
}

function cloneState(state) {
    return Core.parseState(Core.serializeState(state))
}

function createPairingServer({
    stateStore = new StateStore(),
    rootDirectory = __dirname
} = {}) {
    let state = stateStore.load()
    const eventClients = new Set()
    const serverInstanceId = randomUUID()
    const serverStartedAt = Date.now()

    if (stateStore.lastLoadError) {
        console.error(
            `Pi Pairing could not load saved state: ${stateStore.lastLoadError}`
        )
    }

    function publicState() {
        return {
            ...state,
            serverInstanceId,
            serverStartedAt
        }
    }

    function stateEvent() {
        return `event: state\ndata: ${JSON.stringify(publicState())}\n\n`
    }

    function broadcastState() {
        for (const client of eventClients) {
            try {
                client.write(stateEvent())
            } catch {
                eventClients.delete(client)
            }
        }
    }

    function allowedApiHosts() {
        const address = server.address()

        if (!address) {
            return new Set()
        }

        return new Set([
            `127.0.0.1:${address.port}`,
            `localhost:${address.port}`
        ])
    }

    function validateApiRequest(request, response) {
        const allowedHosts = allowedApiHosts()
        const host = request.headers.host

        if (!host || !allowedHosts.has(host)) {
            sendJson(response, 403, { error: 'Host is not allowed' })
            return false
        }

        const origin = request.headers.origin

        if (origin) {
            const allowedOrigins = new Set(
                [...allowedHosts].map((allowedHost) => `http://${allowedHost}`)
            )

            if (!allowedOrigins.has(origin)) {
                sendJson(response, 403, { error: 'Origin is not allowed' })
                return false
            }
        }

        return true
    }

    function serveStaticFile(pathname, response) {
        const relativePath = STATIC_FILES.get(pathname)

        if (!relativePath) {
            sendJson(response, 404, { error: 'Not found' })
            return
        }

        const absolutePath = path.resolve(rootDirectory, relativePath)

        if (!absolutePath.startsWith(`${path.resolve(rootDirectory)}${path.sep}`)) {
            sendJson(response, 404, { error: 'Not found' })
            return
        }

        fs.readFile(absolutePath, (error, content) => {
            if (error) {
                sendJson(response, 500, { error: 'Could not read static file' })
                return
            }

            response.writeHead(200, {
                'content-type':
                    CONTENT_TYPES.get(path.extname(absolutePath)) ||
                    'application/octet-stream',
                'content-length': content.length,
                'cache-control': 'no-cache'
            })
            response.end(content)
        })
    }

    const server = http.createServer(async (request, response) => {
        const requestUrl = new URL(request.url, 'http://127.0.0.1')
        const pathname = requestUrl.pathname

        if (pathname.startsWith('/api/') && !validateApiRequest(request, response)) {
            return
        }

        if (request.method === 'GET' && pathname === '/api/state') {
            sendJson(response, 200, publicState())
            return
        }

        if (request.method === 'GET' && pathname === '/api/events') {
            response.writeHead(200, {
                'content-type': 'text/event-stream; charset=utf-8',
                'cache-control': 'no-store',
                connection: 'keep-alive'
            })
            response.write(stateEvent())
            eventClients.add(response)
            response.on('close', () => eventClients.delete(response))
            return
        }

        if (request.method === 'POST' && pathname === '/api/command') {
            const contentType = String(request.headers['content-type'] ?? '')
                .split(';')[0]
                .trim()
                .toLowerCase()

            if (contentType !== 'application/json') {
                request.resume()
                sendJson(response, 415, {
                    error: 'Content-Type must be application/json'
                })
                return
            }

            let command

            try {
                command = await readJsonBody(request)
            } catch (error) {
                sendJson(response, error.statusCode ?? 400, {
                    error: error.message
                })
                return
            }

            let result
            let candidateState

            try {
                candidateState = cloneState(state)
                result = applyCommand(candidateState, command)
            } catch (error) {
                sendJson(response, 400, { error: error.message })
                return
            }

            candidateState.revision = state.revision + 1

            try {
                state = stateStore.save(candidateState)
            } catch (error) {
                sendJson(response, 500, {
                    error: `Could not save shared state: ${error.message}`
                })
                return
            }

            broadcastState()

            sendJson(response, 200, {
                state: publicState(),
                result: result.result,
                message: result.message,
                warning: result.result?.warning ?? null
            })
            return
        }

        if (request.method === 'GET') {
            serveStaticFile(pathname, response)
            return
        }

        sendJson(response, 405, { error: 'Method not allowed' })
    })

    server.on('close', () => {
        for (const client of eventClients) {
            client.end()
        }
        eventClients.clear()
    })

    return server
}

async function startPairingServer({
    host = '127.0.0.1',
    port = Number(process.env.PORT) || 4173,
    stateStore = new StateStore()
} = {}) {
    stateStore.acquireLock()

    let server

    try {
        server = createPairingServer({ stateStore })
        server.once('close', () => stateStore.releaseLock())

        await new Promise((resolve, reject) => {
            server.once('error', reject)
            server.listen(port, host, resolve)
        })

        let shuttingDown = false
        const shutdown = () => {
            if (shuttingDown) {
                return
            }

            shuttingDown = true
            stateStore.releaseLock()
            server.close(() => process.exit(0))
            setTimeout(() => process.exit(0), 1000).unref()
        }

        process.once('SIGINT', shutdown)
        process.once('SIGTERM', shutdown)
        server.once('close', () => {
            stateStore.releaseLock()
            process.removeListener('SIGINT', shutdown)
            process.removeListener('SIGTERM', shutdown)
        })
    } catch (error) {
        stateStore.releaseLock()
        throw error
    }

    return server
}

if (require.main === module) {
    startPairingServer()
        .then((server) => {
            const address = server.address()
            console.log(
                `Pi Pairing is running at http://${address.address}:${address.port}`
            )
        })
        .catch((error) => {
            console.error(`Could not start Pi Pairing: ${error.message}`)
            process.exitCode = 1
        })
}

module.exports = {
    createPairingServer,
    startPairingServer
}
