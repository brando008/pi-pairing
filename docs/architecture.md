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
  "version": 3,
  "revision": 12,
  "activeProjectId": "project-1",
  "projects": [
    {
      "id": "project-1",
      "name": "Campus",
      "currentLoopStep": 2,
      "activeChecklistId": "checklist-1",
      "checklists": [],
      "research": {
        "activeRoundId": "research-round-1",
        "rounds": []
      }
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
- `core.js` validates every field on load and migrates versions 1 and 2.

## Research rules (`core.js`)

A project owns research rounds. A round belongs to one problem and holds
entries.

| Entry kind | Source required | Satisfies the gate |
|---|---|---|
| `finding` | Yes | Yes |
| `no-research-needed` | Explanation required | Yes |
| `question` | No | No |
| `decision` | No | No |
| `skipped` | Explanation required | Only as the recorded skip |

The gate is enforced in `setLoopStep`: moving to any step after Research
requires the active round to be `confirmed` or `skipped`.

## Command layer (`commands.js`)

Every mutation, from the browser and from the CLI, passes through the same
allowlisted command layer. It resolves friendly names to IDs, generates IDs,
applies the core rules, and returns a human-readable message.

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

## Browser client (`app.js`)

- Loads state from the API and subscribes to server-sent events.
- Sends every change through the command API.
- Ignores stale revisions and older server instances.
- Restores keyboard focus after re-rendering.
- Migrates a legacy browser `localStorage` state exactly once, and only when the
  shared state is still empty.

## Skill (`skills/pi-pairing`)

The skill is deliberately small. It points at the detailed session guide,
defines the loop vocabulary, and explains the research gate and the CLI
contract. Everything else lives in the guide so the skill stays cheap to load.
