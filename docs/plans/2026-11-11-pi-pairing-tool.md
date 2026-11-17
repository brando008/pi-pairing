# Pi Pairing Tool Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Build a standalone browser-based Pairing Loop and per-project checklist tool that persists locally without dependencies.

> **Implementation update:** The shared-state server, CLI, automatic Pi synchronization, and global skill were added by `2026-11-16-pi-pairing-integration.md`.

**Architecture:** `core.js` contains the fixed loop, state model, mutations, and persistence validation as browser/Node-compatible pure logic. `app.js` connects that logic to DOM events and `localStorage`. `index.html` provides semantic structure and `styles.css` provides a responsive two-column interface.

**Tech Stack:** HTML5, CSS Grid/Flexbox, vanilla JavaScript, Node.js built-in `node:test` and `node:assert/strict`.

---

## Task 1: Scaffold the Project and Test the First State Behavior

**Files:**
- Create: `./core.js`
- Create: `./core.test.js`

**Step 1: Create a minimal module shell**

Create `core.js` with only an empty CommonJS export so the test can load without a module-resolution error:

```js
module.exports = {}
```

**Step 2: Write the failing test**

Create `core.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const Core = require('./core.js')

test('adding the first project makes it active', () => {
    const state = Core.createInitialState()
    const result = Core.addProject(state, 'project-1', 'Ignite')

    assert.equal(result.projects.length, 1)
    assert.equal(result.projects[0].name, 'Ignite')
    assert.equal(result.activeProjectId, 'project-1')
})
```

**Step 3: Run the test and verify RED**

Run:

```bash
cd .
node --test core.test.js
```

Expected: FAIL because `createInitialState` or `addProject` is not implemented.

**Step 4: Implement the minimum behavior**

Implement these exports in `core.js`:

```js
const STORAGE_VERSION = 1

function createInitialState() {
    return {
        version: STORAGE_VERSION,
        activeProjectId: null,
        projects: []
    }
}

function addProject(state, id, name) {
    const project = {
        id,
        name: name.trim(),
        currentLoopStep: 0,
        activeChecklistId: null,
        checklists: []
    }

    state.projects.push(project)
    if (state.activeProjectId === null) {
        state.activeProjectId = project.id
    }
    return state
}

module.exports = { createInitialState, addProject }
```

**Step 5: Run the test and verify GREEN**

Run `node --test core.test.js`.

Expected: 1 test passes, 0 fail.

**Step 6: Review checkpoint**

Inspect `core.js` and `core.test.js` for naming clarity and confirm no unrelated behavior was added.

## Task 2: Add Project Operations and Name Validation

**Files:**
- Modify: `./core.js`
- Modify: `./core.test.js`

**Step 1: Write failing tests**

Add tests for:

- A blank or whitespace-only project name throws `Error`.
- Renaming a project trims the new name.
- Selecting a project changes only `activeProjectId`.
- Deleting the active project selects the first remaining project, or `null` if none remain.
- Deleting a non-active project leaves the active selection unchanged.

Use explicit IDs in every test so behavior is deterministic.

**Step 2: Run tests and verify RED**

Run `node --test core.test.js`.

Expected: the new tests fail because the operations are missing.

**Step 3: Implement the minimum operations**

Add `renameProject`, `setActiveProject`, and `deleteProject` to `core.js`. Use the same positional order for project creation and renaming: `addProject(state, id, name)` and `renameProject(state, id, name)`. Use a private lookup helper:

```js
function findProject(state, projectId) {
    const project = state.projects.find((candidate) => candidate.id === projectId)
    if (!project) throw new Error(`Project not found: ${projectId}`)
    return project
}
```

All name-taking operations must trim and reject an empty result with a clear error.

**Step 4: Run tests and verify GREEN**

Run `node --test core.test.js`.

Expected: all current tests pass.

## Task 3: Add Multiple Checklists and Item Operations

**Files:**
- Modify: `./core.js`
- Modify: `./core.test.js`

**Step 1: Write failing checklist tests**

Cover these behaviors independently:

- Adding a checklist to a project.
- Making the first checklist active.
- Adding a second checklist without replacing the active selection.
- Renaming and deleting checklists.
- Selecting a different checklist.
- Deleting the active checklist and selecting the first remaining checklist.
- Rejecting blank checklist and item names.
- Adding, renaming, toggling, and deleting an item.
- Moving an item up and down without losing it.

**Step 2: Run tests and verify RED**

Run `node --test core.test.js`.

Expected: new tests fail because checklist/item operations are missing.

**Step 3: Implement the minimum operations**

Add these exports:

```text
addChecklist
renameChecklist
deleteChecklist
setActiveChecklist
addItem
renameItem
setItemCompleted
deleteItem
moveItem
```

Use a private `findChecklist(state, projectId, checklistId)` helper that first verifies the project and then finds the checklist. `moveItem` should swap adjacent array entries and leave an item in place when it is already at the corresponding boundary.

**Step 4: Run tests and verify GREEN**

Run `node --test core.test.js`.

Expected: all tests pass.

## Task 4: Add the Fixed Loop and Persistence Validation

**Files:**
- Modify: `./core.js`
- Modify: `./core.test.js`

**Step 1: Write failing tests**

Cover:

- `LOOP_STEPS` contains exactly the seven approved labels in order.
- `setLoopStep` stores a valid step index on only the selected project.
- Invalid loop indexes throw an error.
- `serializeState` returns JSON that `parseState` can restore.
- `parseState` rejects malformed JSON, an unsupported version, and invalid entity references.

**Step 2: Run tests and verify RED**

Run `node --test core.test.js`.

Expected: the new tests fail because loop and persistence functions are missing.

**Step 3: Implement the minimum behavior**

Add:

```js
const LOOP_STEPS = [
    { label: 'Problem', prompt: 'What are we trying to accomplish?' },
    { label: 'Inspection and Explanation', prompt: 'What should we understand first?' },
    { label: 'Steps', prompt: 'What is the smallest useful next step?' },
    { label: 'Changes', prompt: 'What change are we making, and why?' },
    { label: 'Help', prompt: 'What kind of help would unblock the next step?' },
    { label: 'Review', prompt: 'Does the result satisfy the goal?' },
    { label: 'Recap', prompt: 'What did we learn and what comes next?' }
]
```

Add `setLoopStep`, `serializeState`, and `parseState`. `parseState` should validate the shape and return a normalized state; it should throw a useful error for invalid saved data.

**Step 4: Run tests and verify GREEN**

Run `node --test core.test.js`.

Expected: all tests pass.

## Task 5: Build the Semantic HTML Interface

**Files:**
- Create: `./index.html`

**Step 1: Write the HTML structure**

Create these landmarks and IDs:

```text
header
  project-select
  add-project-button
  rename-project-button
  delete-project-button
aside
  loop-steps
main
  checklist-select
  add-checklist-button
  rename-checklist-button
  delete-checklist-button
  checklist-items
  add-item-form
  add-item-input
  status-message
```

Use semantic `header`, `aside`, `main`, `nav` or `section`, `form`, `button`, `select`, and `ol` elements. Load `styles.css` and the two JavaScript files in that order.

**Step 2: Perform a static review**

Open `index.html` and verify every required ID appears exactly once and every button has an explicit `type`.

## Task 6: Add Responsive Styling

**Files:**
- Create: `./styles.css`

**Step 1: Add layout and visual rules**

Implement:

- A wide-screen CSS Grid with a fixed-width loop panel and flexible checklist panel.
- A narrow-screen single-column layout using a media query.
- Visible keyboard focus styles.
- A distinct style for the active loop step and completed checklist items.
- System fonts, readable spacing, and no external assets.

**Step 2: Perform a static review**

Check for balanced braces, valid CSS custom properties, and sufficient color contrast.

## Task 7: Connect Browser Events, Rendering, and localStorage

**Files:**
- Modify: `./app.js`

**Step 1: Implement loading and saving**

Use the key `pi-pairing-tool:v1`. Load with `localStorage.getItem`, parse through `Core.parseState`, and save with `Core.serializeState` after every successful mutation. If loading fails, show a non-blocking warning and use `Core.createInitialState()`.

**Step 2: Implement rendering**

Render the project selector, loop steps, checklist selector, and current checklist items from state. Use `textContent` for user-provided names and item text rather than injecting them as HTML.

**Step 3: Implement events**

Connect controls for adding, renaming, and deleting projects and checklists; selecting projects/checklists/loop steps; adding, renaming, toggling, reordering, and deleting items. Use `confirm()` before destructive project and checklist deletion. Trim names and show validation errors in `status-message`.

**Step 4: Run automated tests again**

Run `node --test core.test.js`.

Expected: all tests pass.

## Task 8: Browser Acceptance Test and Final Verification

**Files:**
- Inspect all files in `./`

**Step 1: Serve the directory locally**

Run:

```bash
cd .
python3 -m http.server 4173
```

Open `http://localhost:4173` in a browser.

**Step 2: Exercise the workflow**

Verify manually that:

- Two projects can be created and selected.
- Each project has independent checklist data and loop position.
- Multiple checklists can exist within one project.
- Items can be added, completed, renamed, reordered, and deleted.
- A refresh preserves all data.
- Blank names are rejected.
- Destructive actions request confirmation.
- Corrupt localStorage data displays a warning and does not crash the page.
- The page is usable in both wide and narrow browser panels.

**Step 3: Run the complete automated verification**

Run:

```bash
cd .
npm test
```

Expected: all core and static UI contract tests pass with exit code 0.

**Step 4: Review the final files**

Inspect the final directory for accidental artifacts, verify that all referenced files exist, and confirm that there are no external dependencies.
