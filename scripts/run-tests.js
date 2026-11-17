const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const testFiles = fs
    .readdirSync(root)
    .filter((name) => name.endsWith('.test.js'))
    .sort()
    .map((name) => path.join(root, name))

if (testFiles.length === 0) {
    console.error('No test files were found.')
    process.exit(1)
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
    stdio: 'inherit',
    cwd: root
})

process.exit(result.status ?? 1)
