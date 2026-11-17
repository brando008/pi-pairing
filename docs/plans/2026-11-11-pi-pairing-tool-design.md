# Pi Pairing Tool Design

**Date:** 2026-11-11

> **Storage update:** The browser-only `localStorage` design below was superseded by `2026-11-16-pi-pairing-integration-design.md`. The current tool uses a shared, locked JSON state file, an HTTP/SSE server, and the Pi Pairing CLI.

## Purpose

Build a dependency-free, local-first web tool that can remain open beside an editor while Pi guides the developer through a pair-programming session. The tool has two distinct areas:

1. A fixed seven-step Pairing Loop that guides Pi's behavior.
2. Arbitrary project checklists that the developer can use for project-specific work.

## Location and Technology

The tool lives outside any application repository:

```text
./
├── index.html
├── styles.css
├── core.js
├── core.test.js
├── ui.test.js
├── app.js
├── package.json
└── README.md
```

It uses semantic HTML, modern CSS, and plain JavaScript. Node's built-in test runner verifies the pure state logic. There are no third-party packages, installation step, or build process.

## Interface

The page has a responsive two-column layout on wide screens and a single-column layout in narrow editor side panels.

- The header contains the active project selector plus add, rename, and delete controls.
- The fixed Pairing Loop panel displays all seven steps in order: Problem; Inspection and Explanation; Steps; Changes; Help; Review; Recap. The current step is highlighted and saved independently for each project.
- The project area contains a checklist selector, add/rename/delete checklist controls, and editable checklist items.
- Items can be added, renamed, completed, reordered, and deleted.

## Data Model

A single state object is persisted in browser `localStorage`:

```text
{
  version: 1,
  activeProjectId: string|null,
  projects: [
    {
      id: string,
      name: string,
      currentLoopStep: number,
      activeChecklistId: string|null,
      checklists: [
        {
          id: string,
          name: string,
          items: [
            { id: string, text: string, completed: boolean }
          ]
        }
      ]
    }
  ]
}
```

Names are trimmed and blank names are rejected. Stable IDs prevent similarly named entities from becoming confused. Deleting the active project or checklist selects a sensible remaining entity, or leaves the corresponding selection empty.

## State and Persistence Flow

Every mutation follows the same path:

```text
User action -> update state -> save to localStorage -> render interface
```

The state and mutation functions live in `core.js` so they can be tested without a browser. `app.js` owns DOM rendering, browser events, confirmation prompts, and localStorage access. Saved JSON is validated before use. Invalid saved data produces a visible warning and a safe empty state rather than crashing the application.

## Testing

Automated tests use `npm test` (`node --test core.test.js ui.test.js`) and cover:

- The fixed seven-step loop.
- Project creation, selection, renaming, isolation, and deletion.
- Multiple checklists per project.
- Item creation, renaming, completion, ordering, and deletion.
- Serialization and validation of saved state.
- Rejection of blank names and invalid references.
- Static contracts between the browser code and HTML, including required element IDs, script order, button types, and accessibility relationships.

Manual browser checks cover responsive layout, refresh persistence, confirmation prompts, focus restoration, malformed-data recovery, and separation of the Pairing Loop from project checklists.

## Deferred Features

JSON export/import, templates shared between projects, filesystem discovery, team synchronization, and a local backend are intentionally deferred until the core workflow has been tested in real sessions.
