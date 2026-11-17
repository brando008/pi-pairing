# Architecture

Pi Pairing is a local-first companion with four cooperating parts.

```text
Pi session ── CLI ─┐
                    ├── command layer ── state store ── JSON state file
Browser ───────────┘        ▲
                             │
                      HTTP + Server-Sent Events
```

## State model (`core.js`)

The state file is the single source of truth:

```json
{
  "version": 4,
  "revision": 12,
  "activeProjectId": "project-1",
  "projects": [
    {
      "id": "project-1",
      "name": "Campus",
      "currentLoopStep": 2,
      "depth": "standard",
      "understanding": {
        "summary": "The endpoint rejects a missing student ID and keeps valid records unchanged.",
        "status": "confirmed",
        "updatedAt": "2026-11-17T12:00:00.000Z",
        "confirmedAt": "2026-11-17T12:01:00.000Z"
      },
      "activeChecklistId": "checklist-1",
      "checklists": []
    }
  ]
}
```

- `revision` increases with every accepted mutation. Clients ignore states that
  are older than the newest state they have seen.
- Each server process also reports a `serverInstanceId` and
  `serverStartedAt`. When those change, the browser accepts the new state even
  if its revision restarted at zero, which is what makes a deliberate state
  reset recoverable.
- `depth` is `concise`, `standard`, or `deep`. It shapes both the understanding
  summary and the teaching Pi gives during the session.
- `core.js` validates every field on load and migrates versions 1, 2, and 3.

## Understanding rules (`core.js`)

A project owns one current understanding summary, replaced whenever a new task
starts.

| Field | Meaning |
|---|---|
| `summary` | Pi's short statement of the goal and proposed approach |
| `status` | `empty`, `pending`, or `confirmed` |
| `updatedAt` | When the summary last changed |
| `confirmedAt` | When the user (or autonomous Pi) confirmed it |

The checkpoint is enforced in `setLoopStep`: moving to any step after
Understanding requires the summary to be `confirmed`.

## Command layer (`commands.js`)

Every mutation, from the browser and from the CLI, passes through the same
allowlisted command layer. It resolves friendly names to IDs, generates IDs,
applies the core rules, and returns a human-readable message.

Research commands from v1.0.0 return a clear migration message instead of
failing cryptically.

## Server (`server.js`)

- Serves an allowlist of static assets.
- Exposes `GET /api/state`, `GET /api/events`, and `POST /api/command`.
- Validates `Host`, `Origin`, and `Content-Type`.
- Applies commands to a clone, persists the clone, and only then swaps the
  in-memory state and broadcasts it.

## Persistence (`state-store.js`)

- Writes atomically through a temporary file and a rename.
- Uses owner-only permissions.
- Takes a single-writer lock so two servers cannot write the same file.
- Preserves corrupt state as a backup instead of silently discarding it.
- Stores data in the platform application-data directory and migrates the
  original `~/.pi/agent/pi-pairing` location on first use.

## Browser client (`app.js`)

- Loads state from the API and subscribes to server-sent events.
- Sends every change through the command API.
- Ignores stale revisions and older server instances.
- Restores keyboard focus after re-rendering.
- Lets you edit the understanding summary and choose the teaching depth
  directly in the dashboard.
- Migrates a legacy browser `localStorage` state exactly once, and only when the
  shared state is still empty.

## Skill (`skills/pi-pairing`)

The skill is deliberately small. It points at the detailed session guide,
defines the loop vocabulary, explains the understanding checkpoint and depth
preference, and documents the CLI contract. Everything else lives in the guide
so the skill stays cheap to load.
