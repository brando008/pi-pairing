const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')

const ROOT = __dirname
const PORT = Number(process.env.PI_PAIRING_BROWSER_PORT) || 4183
const DEBUG_PORT = Number(process.env.PI_PAIRING_BROWSER_DEBUG_PORT) || 9333
const APP_URL = `http://127.0.0.1:${PORT}/index.html`
const STATE_FILE = path.join(
    os.tmpdir(),
    `pi-pairing-browser-${process.pid}-${Date.now()}.json`
)
const PROFILE_DIRECTORY = fs.mkdtempSync(
    path.join(os.tmpdir(), 'pi-pairing-browser-profile-')
)

let serverProcess = null
let chromeProcess = null

function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function chromeExecutable() {
    const candidates = [
        process.env.CHROME_PATH,
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
    ].filter(Boolean)

    return candidates.find((candidate) => fs.existsSync(candidate))
}

async function waitForServer() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
            const response = await fetch(`http://127.0.0.1:${PORT}/api/state`)
            if (response.ok) {
                return
            }
        } catch {}

        await sleep(100)
    }

    throw new Error('The test server did not start')
}

function startServer() {
    serverProcess = spawn(process.execPath, ['server.js'], {
        cwd: ROOT,
        env: {
            ...process.env,
            PI_PAIRING_STATE_FILE: STATE_FILE,
            PORT: String(PORT)
        },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    serverProcess.stderr.on('data', (chunk) => {
        process.stderr.write(`[server] ${chunk}`)
    })
}

async function stopServer() {
    if (!serverProcess) {
        return
    }

    const processToStop = serverProcess
    serverProcess = null

    if (processToStop.exitCode === null) {
        processToStop.kill('SIGTERM')
        await new Promise((resolve) => processToStop.once('exit', resolve))
    }
}

async function getPageTarget() {
    for (let attempt = 0; attempt < 300; attempt += 1) {
        try {
            const response = await fetch(
                `http://127.0.0.1:${DEBUG_PORT}/json/list`
            )
            const targets = await response.json()
            const target = targets.find(
                (candidate) =>
                    candidate.type === 'page' &&
                    (candidate.url.startsWith(APP_URL) ||
                        candidate.url === 'about:blank')
            )

            if (target) {
                return target
            }
        } catch {}

        await sleep(100)
    }

    throw new Error('Could not find the application page in Chrome')
}

function createClient(socket) {
    const pending = new Map()
    const browserErrors = []
    let messageId = 0

    socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data)

        if (message.id) {
            const request = pending.get(message.id)

            if (!request) {
                return
            }

            pending.delete(message.id)

            if (message.error) {
                request.reject(new Error(message.error.message))
            } else {
                request.resolve(message.result)
            }

            return
        }

        if (message.method === 'Runtime.exceptionThrown') {
            browserErrors.push(
                message.params.exceptionDetails.text || 'Runtime exception'
            )
        }

        if (
            message.method === 'Log.entryAdded' &&
            message.params.entry.level === 'error'
        ) {
            browserErrors.push(message.params.entry.text)
        }
    })

    function send(method, params = {}) {
        messageId += 1
        const id = messageId

        return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject })
            socket.send(JSON.stringify({ id, method, params }))
        })
    }

    async function evaluate(expression) {
        const result = await send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
        })

        if (result.exceptionDetails) {
            throw new Error(
                result.exceptionDetails.exception?.description ||
                    result.exceptionDetails.text
            )
        }

        return result.result.value
    }

    async function waitFor(expression, timeoutMs = 7000) {
        const deadline = Date.now() + timeoutMs

        while (Date.now() < deadline) {
            if (await evaluate(expression)) {
                return
            }

            await sleep(50)
        }

        const statusMessage = await evaluate(
            `document.getElementById('status-message')?.textContent ?? ''`
        )
        throw new Error(
            `Timed out waiting for: ${expression}\nStatus message: ${statusMessage}\nBrowser errors: ${JSON.stringify(browserErrors)}`
        )
    }

    async function capture(filePath, width, height) {
        await send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 1,
            mobile: width < 600
        })
        await sleep(100)

        const result = await send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: true,
            fromSurface: true
        })
        fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'))
    }

    return { send, evaluate, waitFor, capture, browserErrors }
}

async function main() {
    const chrome = chromeExecutable()

    if (!chrome) {
        throw new Error(
            'Chrome or Chromium was not found. Set CHROME_PATH to its executable.'
        )
    }

    startServer()
    await waitForServer()

    chromeProcess = spawn(
        chrome,
        [
            '--headless=new',
            '--disable-gpu',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-default-browser-check',
            `--user-data-dir=${PROFILE_DIRECTORY}`,
            `--remote-debugging-port=${DEBUG_PORT}`,
            APP_URL
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] }
    )

    chromeProcess.stderr.on('data', (chunk) => {
        const message = chunk.toString()

        if (/error|failed/i.test(message)) {
            console.warn(`[chrome] ${message.trim()}`)
        }
    })

    const target = await getPageTarget()
    const socket = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true })
        socket.addEventListener('error', reject, { once: true })
    })

    const client = createClient(socket)
    const { send, evaluate, waitFor, capture, browserErrors } = client

    await send('Page.enable')
    await send('Runtime.enable')
    await send('Log.enable')
    await send('Page.navigate', { url: APP_URL })
    await waitFor(
        `Boolean(document.getElementById('project-select') && window.PairingCore)`
    )

    await evaluate(`(async () => {
        const current = await fetch('/api/state').then((response) => response.json());
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                type: 'state.replace',
                payload: {
                    state: {
                        version: 3,
                        revision: 0,
                        activeProjectId: null,
                        projects: []
                    },
                    expectedRevision: current.revision,
                    force: true
                }
            })
        });
        location.reload();
        return true;
    })()`)
    await sleep(500)
    await waitFor(
        `Boolean(document.getElementById('project-select') && window.PairingCore)`
    )

    await evaluate(`(() => {
        window.__promptValue = 'Ignite';
        window.prompt = () => window.__promptValue;
        window.confirm = () => true;
        document.getElementById('add-project-button').click();
        return true;
    })()`)
    await waitFor(
        `document.getElementById('project-select').options[0]?.textContent === 'Ignite'`
    )

    await evaluate(`(() => {
        const loopButton = document.querySelector('#loop-steps button[data-step-index="3"]');
        loopButton.click();
        return true;
    })()`)
    await waitFor(
        `document.getElementById('status-message').textContent.includes('Research must be confirmed')`
    )

    await evaluate(`(() => {
        document.getElementById('research-problem-input').value = 'How should attendance corrections be recorded?';
        document.getElementById('research-begin-form').requestSubmit();
        return true;
    })()`)
    await waitFor(
        `document.getElementById('research-status').textContent === 'open'`
    )

    await evaluate(`(() => {
        document.getElementById('research-kind').value = 'finding';
        document.getElementById('research-title-input').value = 'Corrections are append-only';
        document.getElementById('research-explanation-input').value = 'The audit specification forbids mutating closed records.';
        document.getElementById('research-source-label').value = 'Audit specification';
        document.getElementById('research-source-location').value = 'docs/audit.md';
        document.getElementById('research-add-form').requestSubmit();
        return true;
    })()`)
    await waitFor(
        `document.querySelectorAll('#research-entries > li').length === 1`
    )

    await evaluate(`(() => {
        document.getElementById('research-confirm-button').click();
        return true;
    })()`)
    await waitFor(
        `document.getElementById('research-status').textContent === 'confirmed'`
    )
    await waitFor(`document.getElementById('loop-gate-hint').hidden === true`)

    await evaluate(`(() => {
        window.__promptValue = 'Backend';
        document.getElementById('add-checklist-button').click();
        return true;
    })()`)
    await waitFor(
        `document.getElementById('checklist-select').options[0]?.textContent === 'Backend'`
    )

    await evaluate(`(() => {
        const input = document.getElementById('add-item-input');
        input.value = 'Write endpoint';
        document.getElementById('add-item-form').requestSubmit();
        return true;
    })()`)
    await waitFor(
        `document.querySelectorAll('#checklist-items li').length === 1`
    )

    await evaluate(`(() => {
        const checkbox = document.querySelector('#checklist-items input[type="checkbox"]');
        checkbox.focus();
        checkbox.click();
        return true;
    })()`)
    await waitFor(
        `document.activeElement.matches('#checklist-items input[type="checkbox"]')`
    )

    await evaluate(`(() => {
        const button = document.querySelector('#loop-steps button[data-step-index="3"]');
        button.focus();
        button.click();
        return true;
    })()`)
    await waitFor(`document.activeElement.dataset.stepIndex === '3'`)

    const cliResult = spawnSync(
        process.execPath,
        [path.join(ROOT, 'cli.js'), 'project', 'add', 'Campus'],
        {
            cwd: ROOT,
            env: {
                ...process.env,
                PI_PAIRING_URL: `http://127.0.0.1:${PORT}`
            },
            encoding: 'utf8'
        }
    )
    assert.equal(cliResult.status, 0, cliResult.stderr)
    await waitFor(
        `document.querySelectorAll('#project-select option').length === 2`
    )

    await send('Page.reload', { ignoreCache: true })
    await sleep(500)
    await waitFor(
        `document.querySelectorAll('#project-select option').length === 2`
    )

    await evaluate(`(() => {
        const select = document.getElementById('project-select');
        select.value = select.options[0].value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    })()`)
    await waitFor(
        `document.querySelectorAll('#checklist-items li').length === 1`
    )

    const skipCli = spawnSync(
        process.execPath,
        [
            path.join(ROOT, 'cli.js'),
            'research',
            'begin',
            'Campus',
            'Migration research'
        ],
        {
            cwd: ROOT,
            env: {
                ...process.env,
                PI_PAIRING_URL: `http://127.0.0.1:${PORT}`
            },
            encoding: 'utf8'
        }
    )
    assert.equal(skipCli.status, 0, skipCli.stderr)

    const skipResult = spawnSync(
        process.execPath,
        [
            path.join(ROOT, 'cli.js'),
            'research',
            'skip',
            'Campus',
            'Existing incident review covered this area'
        ],
        {
            cwd: ROOT,
            env: {
                ...process.env,
                PI_PAIRING_URL: `http://127.0.0.1:${PORT}`
            },
            encoding: 'utf8'
        }
    )
    assert.equal(skipResult.status, 0, skipResult.stderr)
    assert.match(skipResult.stdout, /Research was skipped/i)

    await evaluate(`(() => {
        const select = document.getElementById('project-select');
        select.value = select.options[1].value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    })()`)
    await waitFor(
        `document.getElementById('research-warning').hidden === false`
    )
    await waitFor(
        `document.getElementById('research-warning').textContent.includes('Existing incident review')`
    )

    await capture('/tmp/pi-pairing-wide.png', 1440, 1000)
    await capture('/tmp/pi-pairing-narrow.png', 390, 844)

    await stopServer()
    await waitFor(
        `document.getElementById('add-project-button').disabled === true`
    )
    fs.rmSync(STATE_FILE, { force: true })
    fs.rmSync(`${STATE_FILE}.corrupt-backup`, { force: true })
    startServer()
    await waitForServer()
    await waitFor(
        `document.getElementById('add-project-button').disabled === false`
    )
    await waitFor(
        `document.getElementById('project-select').options[0]?.textContent === 'No projects yet'`
    )

    const unexpectedErrors = browserErrors.filter(
        (message) =>
            !message.includes('ERR_INCOMPLETE_CHUNKED_ENCODING') &&
            !message.includes('status of 400')
    )
    assert.deepEqual(unexpectedErrors, [])

    socket.close()
    console.log('Browser acceptance checks passed')
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        if (chromeProcess) {
            const processToStop = chromeProcess
            chromeProcess = null

            if (processToStop.exitCode === null) {
                processToStop.kill('SIGTERM')

                await new Promise((resolve) => {
                    const forceKill = setTimeout(() => {
                        processToStop.kill('SIGKILL')
                        resolve()
                    }, 2000)

                    processToStop.once('exit', () => {
                        clearTimeout(forceKill)
                        resolve()
                    })
                })
            }
        }

        await stopServer()

        try {
            fs.rmSync(PROFILE_DIRECTORY, {
                recursive: true,
                force: true,
                maxRetries: 10,
                retryDelay: 300
            })
        } catch (error) {
            console.warn(
                `Could not remove the temporary browser profile: ${error.message}`
            )
        }

        fs.rmSync(STATE_FILE, { force: true })
        fs.rmSync(`${STATE_FILE}.corrupt-backup`, { force: true })
    })
