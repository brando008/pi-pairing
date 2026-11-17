const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Core = require('./core.js')

const LEGACY_DATA_DIRECTORY = path.join(
    os.homedir(),
    '.pi',
    'agent',
    'pi-pairing'
)

function defaultDataDirectory() {
    if (process.env.PI_PAIRING_DATA_DIR) {
        return process.env.PI_PAIRING_DATA_DIR
    }

    if (process.platform === 'win32') {
        return path.join(
            process.env.LOCALAPPDATA ||
                path.join(os.homedir(), 'AppData', 'Local'),
            'PiPairing'
        )
    }

    if (process.platform === 'darwin') {
        return path.join(
            os.homedir(),
            'Library',
            'Application Support',
            'PiPairing'
        )
    }

    return path.join(
        process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'),
        'pi-pairing'
    )
}

function defaultStateFile() {
    return path.join(defaultDataDirectory(), 'state.json')
}

const DEFAULT_STATE_FILE = defaultStateFile()

function createOwnedFile(targetPath) {
    const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`

    fs.writeFileSync(temporaryPath, `${process.pid}\n`, {
        encoding: 'utf8',
        mode: 0o600
    })

    try {
        fs.linkSync(temporaryPath, targetPath)
    } finally {
        try {
            fs.unlinkSync(temporaryPath)
        } catch {}
    }
}

class StateStore {
    constructor(
        filePath = process.env.PI_PAIRING_STATE_FILE || DEFAULT_STATE_FILE,
        { legacyFilePath = path.join(LEGACY_DATA_DIRECTORY, 'state.json') } = {}
    ) {
        this.filePath = filePath
        this.legacyFilePath = legacyFilePath
        this.backupPath = `${filePath}.corrupt-backup`
        this.lockPath = `${filePath}.lock`
        this.clearLockPath = `${filePath}.lock.clear`
        this.lastLoadError = null
        this.lockOwned = false
    }

    acquireLock() {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true })

        if (fs.existsSync(this.clearLockPath)) {
            throw new Error(
                'The Pi Pairing state lock is being cleared. Try again shortly.'
            )
        }

        try {
            createOwnedFile(this.lockPath)
            this.lockOwned = true
            return
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error
            }
        }

        let ownerPid = null

        try {
            ownerPid = Number(
                fs.readFileSync(this.lockPath, 'utf8').trim()
            )
        } catch {}

        if (!Number.isInteger(ownerPid) || ownerPid <= 0) {
            throw new Error(
                'Another Pi Pairing server already owns this state file'
            )
        }

        let ownerIsRunning = false

        try {
            process.kill(ownerPid, 0)
            ownerIsRunning = true
        } catch (ownerError) {
            ownerIsRunning = ownerError.code !== 'ESRCH'
        }

        if (ownerIsRunning) {
            throw new Error(
                'Another Pi Pairing server already owns this state file'
            )
        }

        throw new Error(
            'A stale Pi Pairing lock exists. Run stop-server.sh or clear it explicitly before restarting.'
        )
    }

    clearStaleLock() {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true })

        try {
            createOwnedFile(this.clearLockPath)
        } catch (error) {
            if (error.code === 'EEXIST') {
                throw new Error(
                    'A Pi Pairing lock clear is already in progress'
                )
            }

            throw error
        }

        try {
            let ownerPid = null

            try {
                ownerPid = Number(
                    fs.readFileSync(this.lockPath, 'utf8').trim()
                )
            } catch (error) {
                if (error.code === 'ENOENT') {
                    return
                }

                throw error
            }

            if (!Number.isInteger(ownerPid) || ownerPid <= 0) {
                throw new Error('The Pi Pairing lock has no valid owner PID')
            }

            try {
                process.kill(ownerPid, 0)
                throw new Error(
                    `The Pi Pairing lock is still owned by running process ${ownerPid}`
                )
            } catch (error) {
                if (error.code !== 'ESRCH') {
                    throw error
                }
            }

            fs.unlinkSync(this.lockPath)
        } finally {
            try {
                const cleanupOwnerPid = Number(
                    fs.readFileSync(this.clearLockPath, 'utf8').trim()
                )

                if (cleanupOwnerPid === process.pid) {
                    fs.unlinkSync(this.clearLockPath)
                }
            } catch {}
        }
    }

    releaseLock() {
        if (!this.lockOwned) {
            return
        }

        try {
            const ownerPid = Number(
                fs.readFileSync(this.lockPath, 'utf8').trim()
            )

            if (ownerPid === process.pid) {
                fs.unlinkSync(this.lockPath)
            }
        } catch {}

        this.lockOwned = false
    }

    load() {
        this.lastLoadError = null

        try {
            const rawState = fs.readFileSync(this.filePath, 'utf8')
            return Core.parseState(rawState)
        } catch (error) {
            if (error.code === 'ENOENT') {
                return this.seedFromLegacyFile() ?? Core.createInitialState()
            }

            this.lastLoadError = error.message

            try {
                fs.copyFileSync(this.filePath, this.backupPath)
                fs.chmodSync(this.backupPath, 0o600)
            } catch {}

            return Core.createInitialState()
        }
    }

    seedFromLegacyFile() {
        if (!this.legacyFilePath || this.legacyFilePath === this.filePath) {
            return null
        }

        try {
            const legacyState = fs.readFileSync(this.legacyFilePath, 'utf8')
            const parsedState = Core.parseState(legacyState)
            this.save(parsedState)
            return parsedState
        } catch {
            return null
        }
    }

    save(state) {
        const normalizedState = Core.parseState(Core.serializeState(state))
        const directory = path.dirname(this.filePath)
        const temporaryPath = path.join(
            directory,
            `.${path.basename(this.filePath)}.${process.pid}.${Date.now()}.tmp`
        )

        fs.mkdirSync(directory, { recursive: true })

        try {
            fs.writeFileSync(
                temporaryPath,
                `${JSON.stringify(normalizedState, null, 4)}\n`,
                { encoding: 'utf8', mode: 0o600 }
            )
            fs.renameSync(temporaryPath, this.filePath)
        } catch (error) {
            try {
                fs.unlinkSync(temporaryPath)
            } catch {}

            throw error
        }

        return normalizedState
    }
}

module.exports = StateStore
module.exports.StateStore = StateStore
module.exports.DEFAULT_STATE_FILE = DEFAULT_STATE_FILE
module.exports.LEGACY_DATA_DIRECTORY = LEGACY_DATA_DIRECTORY
module.exports.defaultDataDirectory = defaultDataDirectory
module.exports.defaultStateFile = defaultStateFile
