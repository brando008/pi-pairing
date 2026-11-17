const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Core = require('./core.js')
const StateStore = require('./state-store.js')

function createTemporaryDirectory() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'pi-pairing-state-'))
}

test('a missing state file loads an empty state', () => {
    const directory = createTemporaryDirectory()
    const store = new StateStore(path.join(directory, 'state.json'))

    const state = store.load()

    assert.deepEqual(state, Core.createInitialState())
})

test('saved state persists and loads again', () => {
    const directory = createTemporaryDirectory()
    const filePath = path.join(directory, 'state.json')
    const store = new StateStore(filePath)
    const state = Core.createInitialState()

    Core.addProject(state, 'project-1', 'Campus')
    store.save(state)

    const restored = store.load()
    assert.equal(restored.projects[0].name, 'Campus')
    assert.equal(restored.activeProjectId, 'project-1')
})

test('saved state uses owner-only permissions and leaves no temporary file', () => {
    const directory = createTemporaryDirectory()
    const filePath = path.join(directory, 'state.json')
    const store = new StateStore(filePath)
    const state = Core.createInitialState()

    store.save(state)

    assert.equal(fs.statSync(filePath).mode & 0o777, 0o600)
    assert.deepEqual(
        fs.readdirSync(directory).filter((name) => name.endsWith('.tmp')),
        []
    )
})

test('corrupt state is backed up and replaced by a safe empty state', () => {
    const directory = createTemporaryDirectory()
    const filePath = path.join(directory, 'state.json')
    const backupPath = `${filePath}.corrupt-backup`
    fs.writeFileSync(filePath, '{invalid json')

    const store = new StateStore(filePath)
    const state = store.load()

    assert.deepEqual(state, Core.createInitialState())
    assert.equal(fs.readFileSync(backupPath, 'utf8'), '{invalid json')
    assert.match(store.lastLoadError, /parse saved data/i)
})

test('a state file permits only one active server owner', () => {
    const directory = createTemporaryDirectory()
    const filePath = path.join(directory, 'state.json')
    const firstStore = new StateStore(filePath)
    const secondStore = new StateStore(filePath)

    firstStore.acquireLock()

    assert.throws(
        () => secondStore.acquireLock(),
        /another Pi Pairing server/i
    )

    firstStore.releaseLock()
    secondStore.acquireLock()
    secondStore.releaseLock()
})

test('an incomplete lock is treated as active rather than stolen', () => {
    const directory = createTemporaryDirectory()
    const filePath = path.join(directory, 'state.json')
    const lockPath = `${filePath}.lock`
    fs.writeFileSync(lockPath, '')

    const store = new StateStore(filePath)

    assert.throws(
        () => store.acquireLock(),
        /another Pi Pairing server/i
    )
})

test('a lock owned by a dead process is not stolen automatically', () => {
    const directory = createTemporaryDirectory()
    const filePath = path.join(directory, 'state.json')
    const lockPath = `${filePath}.lock`
    fs.writeFileSync(lockPath, '99999999\n')

    const store = new StateStore(filePath)

    assert.throws(
        () => store.acquireLock(),
        /stale.*lock/i
    )
    assert.equal(fs.readFileSync(lockPath, 'utf8').trim(), '99999999')
})

test('a stale lock can be cleared explicitly after its owner is dead', () => {
    const directory = createTemporaryDirectory()
    const filePath = path.join(directory, 'state.json')
    const lockPath = `${filePath}.lock`
    fs.writeFileSync(lockPath, '99999999\n')

    const store = new StateStore(filePath)
    store.clearStaleLock()

    assert.equal(fs.existsSync(lockPath), false)
    store.acquireLock()
    store.releaseLock()
})

test('a stale lock is not cleared while another cleanup is in progress', () => {
    const directory = createTemporaryDirectory()
    const filePath = path.join(directory, 'state.json')
    const lockPath = `${filePath}.lock`
    fs.writeFileSync(lockPath, '99999999\n')
    fs.writeFileSync(`${lockPath}.clear`, `${process.pid}\n`)

    const store = new StateStore(filePath)

    assert.throws(
        () => store.clearStaleLock(),
        /clear.*progress/i
    )
    assert.equal(fs.existsSync(lockPath), true)
})

test('the default data directory honors the environment override', () => {
    const previous = process.env.PI_PAIRING_DATA_DIR
    process.env.PI_PAIRING_DATA_DIR = '/tmp/pi-pairing-override'

    try {
        assert.equal(
            StateStore.defaultDataDirectory(),
            '/tmp/pi-pairing-override'
        )
    } finally {
        if (previous === undefined) {
            delete process.env.PI_PAIRING_DATA_DIR
        } else {
            process.env.PI_PAIRING_DATA_DIR = previous
        }
    }
})

test('a missing state file is seeded from the legacy Pi pairing location', () => {
    const directory = createTemporaryDirectory()
    const legacyPath = path.join(directory, 'legacy-state.json')
    const newPath = path.join(directory, 'new', 'state.json')
    const legacyState = Core.createInitialState()
    Core.addProject(legacyState, 'project-1', 'Campus')
    fs.writeFileSync(legacyPath, JSON.stringify(legacyState))

    const store = new StateStore(newPath, { legacyFilePath: legacyPath })
    const state = store.load()

    assert.equal(state.projects[0].name, 'Campus')
    assert.equal(fs.existsSync(newPath), true)
})

test('saving invalid state is rejected', () => {
    const directory = createTemporaryDirectory()
    const store = new StateStore(path.join(directory, 'state.json'))

    assert.throws(
        () => store.save({ version: 1, projects: 'invalid' }),
        /projects must be a list/i
    )
})
