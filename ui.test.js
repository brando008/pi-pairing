const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = __dirname
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8')

function matchAll(source, pattern) {
    return [...source.matchAll(pattern)]
}

test('every element queried by the browser app exists exactly once in the HTML', () => {
    const requestedIds = matchAll(
        app,
        /getElementById\(['"]([^'"]+)['"]\)/g
    ).map((match) => match[1])

    assert.ok(requestedIds.length > 0)

    for (const id of requestedIds) {
        const occurrences = html.match(new RegExp(`id=["']${id}["']`, 'g')) ?? []
        assert.equal(occurrences.length, 1, `expected one element with ID ${id}`)
    }
})

test('the page loads styles and scripts in dependency order', () => {
    const stylesheetIndex = html.indexOf('href="styles.css"')
    const coreIndex = html.indexOf('src="core.js"')
    const appIndex = html.indexOf('src="app.js"')

    assert.ok(stylesheetIndex >= 0)
    assert.ok(coreIndex > stylesheetIndex)
    assert.ok(appIndex > coreIndex)
})

test('interactive controls use explicit button types', () => {
    const buttons = matchAll(html, /<button\b[^>]*>/g).map((match) => match[0])

    assert.ok(buttons.length > 0)

    for (const button of buttons) {
        assert.match(button, /\btype=["'](?:button|submit)["']/)
    }
})

test('the HTML exposes the accessibility relationships required by the interface', () => {
    assert.match(html, /<main\b[^>]*id="main-content"[^>]*tabindex="-1"/)
    assert.match(html, /<div\b[^>]*class="project-controls"[^>]*role="group"/)
    assert.match(html, /<div\b[^>]*class="checklist-controls"[^>]*role="group"/)
    assert.match(html, /<ol\b[^>]*id="loop-steps"[^>]*role="list"/)
    assert.match(html, /<ul\b[^>]*id="checklist-items"[^>]*role="list"/)
    assert.match(html, /<span\b[^>]*id="item-count"[^>]*aria-live="polite"/)
    assert.match(
        html,
        /<div\b[^>]*id="status-message"[^>]*role="status"[^>]*aria-live="polite"/
    )
    assert.doesNotMatch(html, /id="status-message"[^>]*\bhidden\b/)
})

test('the browser uses the shared state API and live event stream', () => {
    assert.match(app, /\/api\/state/)
    assert.match(app, /\/api\/command/)
    assert.match(app, /new EventSource\(/)
    assert.match(app, /state\.replace/)
})

test('the browser ignores stale state and protects migration replacement', () => {
    assert.match(app, /revision/)
    assert.match(app, /nextState\.revision\s*<\s*state\.revision/)
    assert.match(app, /expectedRevision/)
    assert.match(app, /serverInstanceId/)
    assert.match(app, /serverStartedAt/)
})

test('the browser reconnects when the server starts after the page', () => {
    const initializeBlock = app.match(
        /async function initialize\(\)\s*\{([\s\S]*?)\n\s{4}\}/
    )

    assert.ok(initializeBlock)
    assert.ok(
        initializeBlock[1].indexOf('connectEventStream()') <
            initializeBlock[1].indexOf('fetchState()')
    )
    assert.match(app, /setTimeout/)
})

test('the browser exposes the research checkpoint workflow', () => {
    assert.match(app, /'research\.begin'/)
    assert.match(app, /'research\.add'/)
    assert.match(app, /'research\.confirm'/)
    assert.match(app, /'research\.skip'/)
    assert.match(html, /id="research-entries"/)
    assert.match(html, /id="research-confirm-button"/)
    assert.match(html, /id="research-skip-button"/)
    assert.match(html, /id="research-warning"/)
    assert.match(html, /id="loop-gate-hint"/)
})

test('the stylesheet defines an accessible accent contrast color', () => {
    assert.match(styles, /--accent-contrast:\s*#ffffff;/)
    assert.match(styles, /--accent-contrast:\s*#17132d;/)
    assert.doesNotMatch(styles, /color:\s*#ffffff;/)
})
