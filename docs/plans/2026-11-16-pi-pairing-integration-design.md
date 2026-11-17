# Pi Pairing Integration Design

**Date:** 2026-11-16

## Goal

Make the Pi Pairing dashboard a shared local tool that both the visible browser and a Pi coding session can update. Add a reusable global Pi skill and session guide that teach and enforce the junior-driver pair-programming workflow.

## Shared State

The browser-only `localStorage` model is replaced by one JSON state file:

```text
~/.pi/agent/pi-pairing/state.json
```

The location is outside the static web root so state cannot be downloaded as a static asset. `PI_PAIRING_STATE_FILE` can override it for tests and alternate installations.

The server owns the state in memory and writes it atomically after every accepted mutation. A persisted monotonic revision orders updates within a server instance. Each response and SSE frame also carries a per-process instance ID and start time, allowing an open browser to recognize a deliberate state reset or server restart without accepting late events from an older instance.

The browser and CLI both mutate through the same command layer, preventing separate sources of truth.

## Runtime Architecture

```text
Pi session ── CLI ─┐
                    ├── HTTP command API ── local Node server ── JSON state
Visible browser ────┘                    └── Server-Sent Events ── browser
```

`server.js` uses only Node built-ins. It binds to `127.0.0.1:4173`, serves the static tool, exposes a small JSON API, and broadcasts state through Server-Sent Events.

### API

- `GET /api/state` returns the current state.
- `GET /api/events` opens an SSE stream and sends the current state immediately.
- `POST /api/command` accepts `{ type, payload }`, applies one allowlisted command, persists the state, and returns the updated state.

Command requests require `Content-Type: application/json`. API requests validate the Host and optional Origin against the loopback server. The server clones state, applies the command, increments the revision, persists the clone, and only then swaps the in-memory state and broadcasts it.

The browser sends its UI changes through the command API and listens for SSE updates. The CLI uses the same API. One-time migration imports an existing browser `localStorage` value only when the shared state has no projects and the expected revision still matches.

## Commands

The command layer supports project, checklist, item, and loop operations. Names are resolved by exact ID first and then case-insensitive name. Creating or selecting a project also makes it active.

Representative commands:

```bash
node ./cli.js project add Campus
node ./cli.js checklist add Campus "Current Work"
node ./cli.js item add Campus "Current Work" "Inspect the API"
node ./cli.js item complete Campus "Current Work" "Inspect the API"
node ./cli.js loop set Campus "Inspection and Explanation"
```

## Session Guide and Skill

`SESSION_GUIDE.md` is the detailed behavioral contract for pair programming:

- Pi acts as senior developer and guide.
- The junior drives edits and commands unless autonomy is explicitly requested.
- The seven-step loop is Problem, Inspection and Explanation, Steps, Changes, Help, Review, and Recap.
- Pi explains the big picture and works in small slices.
- Help is progressive: direction, pseudocode, specific guidance, then walkthrough.
- Pi reviews and verifies the junior's work.
- Pi recaps the concepts and skills practiced.

The global skill at `~/.pi/agent/skills/pi-pairing/SKILL.md` makes this behavior available in every project. It links to the session guide, tells Pi when to use the CLI, and remains opt-in through `/skill:pi-pairing` or natural-language triggers.

## Safety and Failure Handling

- The server is loopback-only.
- Static path traversal and hidden-file access are denied.
- Request bodies are size-limited and JSON-validated.
- Command types are allowlisted and all entity names are validated by the core layer.
- Content-Type, Host, and Origin checks block cross-origin simple requests and DNS rebinding.
- An owner-only, single-writer lock prevents two servers from writing the same state file.
- CLI failures return a non-zero exit code and actionable message.
- The browser shows API failures without discarding its last valid state.
- Corrupt shared state is preserved as a backup before a safe empty state is used.

## Testing

Node's built-in test runner covers command behavior, CLI parsing, state persistence, HTTP endpoints, SSE updates, security checks, revision ordering, locking, and static UI contracts. The dependency-free headless Chrome acceptance harness verifies cross-client updates, persistence, revision resets, reconnect behavior, focus, responsive layout, and dark mode.
