# Pi Pairing Integration Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Add shared Pi/browser state synchronization, a reusable teaching guide, and an installable global Pi Pairing skill.

**Architecture:** A pure command module applies allowlisted state mutations. A dependency-free Node server persists state and exposes HTTP/SSE APIs. A CLI and the browser both use that API. A global Pi skill loads the session guide and teaches Pi to drive the junior through the seven-step loop.

**Tech Stack:** Node.js built-ins (`node:http`, `node:fs`, `node:test`), browser EventSource/fetch, Markdown Pi skill.

---

### Task 1: Shared Command Layer

**Files:**
- Create: `commands.js`
- Create: `commands.test.js`

Write failing tests for project/checklist/item/loop commands, name resolution, active selections, and unknown-entity errors. Run them before implementation and verify RED. Implement the minimum command API and run them to GREEN.

### Task 2: State Store and HTTP/SSE Server

**Files:**
- Create: `state-store.js`
- Create: `state-store.test.js`
- Create: `server.js`
- Create: `server.test.js`

Write failing tests for atomic persistence, corrupt-state recovery, owner-only single-writer locking, static file serving, traversal denial, JSON/Host/Origin validation, revision ordering, failed-write isolation, command responses, and SSE broadcasts. Implement the store and loopback-only server, then run to GREEN.

### Task 3: CLI

**Files:**
- Create: `cli.js`
- Create: `cli.test.js`

Write failing parser tests for all supported commands. Implement argument parsing and HTTP calls. Verify human-readable success output and actionable non-zero failures.

### Task 4: Browser Shared-State Client

**Files:**
- Modify: `app.js`
- Modify: `ui.test.js`
- Modify: `package.json`

Refactor browser mutations to use `POST /api/command`, load state through `GET /api/state`, and subscribe to `/api/events`. Add one-time, revision-guarded migration from legacy localStorage. Ignore stale revisions within a server instance, recognize new server instances after reset/restart, and reconnect automatically. Keep validation, focus restoration, accessibility, and responsive behavior.

### Task 5: Session Guide

**Files:**
- Create: `SESSION_GUIDE.md`

Document the senior/junior roles, seven-step loop, teaching progression, autonomy boundary, dashboard CLI workflow, review expectations, and recap format.

### Task 6: Global Skill RED Baseline

Create three combined-pressure scenarios and run them with fresh-context agents before installing the skill. Record whether agents take over edits, skip the loop, omit explanations, fail to teach progressively, skip verification, or omit the recap.

### Task 7: Global Skill GREEN and Refactor

Write `~/.pi/agent/skills/pi-pairing/SKILL.md` with valid frontmatter and only discovery-focused description metadata. Address every baseline failure, link the guide and CLI, include a realistic example and quick reference, then rerun the scenarios. Refactor until compliant.

### Task 8: End-to-End Verification

Run all Node tests, syntax checks, the self-contained headless browser acceptance harness, a CLI-to-browser synchronization test, revision-reset/reconnect checks, and skill discovery validation. Confirm the Ignite repository remains unchanged and the local server remains reachable.
