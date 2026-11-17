const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const root = __dirname
const repositorySkillPath = path.join(
    root,
    'skills',
    'pi-pairing',
    'SKILL.md'
)
const repositoryGuidePath = path.join(
    root,
    'skills',
    'pi-pairing',
    'references',
    'SESSION_GUIDE.md'
)
const installedSkillPath = path.join(
    os.homedir(),
    '.pi',
    'agent',
    'skills',
    'pi-pairing',
    'SKILL.md'
)

function assertSkillMetadata(skill) {
    const frontmatterMatch = skill.match(/^---\n([\s\S]*?)\n---/)

    assert.ok(frontmatterMatch, 'skill frontmatter is missing')

    const frontmatter = frontmatterMatch[1]
    const fields = frontmatter
        .split('\n')
        .filter((line) => line.includes(':'))
        .map((line) => line.split(':', 1)[0].trim())

    assert.deepEqual(fields, ['name', 'description'])

    const name = frontmatter.match(/^name:\s*(.+)$/m)[1].trim()
    const description = frontmatter.match(/^description:\s*(.+)$/m)[1].trim()

    assert.match(name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.ok(description.startsWith('Use when'))
    assert.ok(description.length <= 1024)
}

test('the repository skill has valid discovery metadata', () => {
    assertSkillMetadata(fs.readFileSync(repositorySkillPath, 'utf8'))
})

test('the repository skill references the guide and canonical loop', () => {
    const skill = fs.readFileSync(repositorySkillPath, 'utf8')
    const guide = fs.readFileSync(repositoryGuidePath, 'utf8')

    assert.match(skill, /references\/SESSION_GUIDE\.md/)
    assert.match(
        skill,
        /Direction → Pseudocode → Specific guidance → Walkthrough/
    )
    assert.match(skill, /notes file/i)
    assert.match(skill, /understanding set/)
    assert.match(skill, /project depth/i)

    for (const label of [
        'Problem',
        'Understanding',
        'Inspection and Explanation',
        'Steps',
        'Changes',
        'Help',
        'Review',
        'Recap'
    ]) {
        assert.ok(skill.includes(`**${label}**`))
        assert.ok(guide.includes(label))
    }
})

test(
    'the installed global skill matches the repository skill',
    { skip: fs.existsSync(installedSkillPath) ? false : 'skill is not installed' },
    () => {
        const installed = fs.readFileSync(installedSkillPath, 'utf8')
        const repository = fs.readFileSync(repositorySkillPath, 'utf8')

        assertSkillMetadata(installed)
        assert.equal(installed.trim(), repository.trim())
    }
)
