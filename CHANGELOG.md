# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-17

### Added

- Eight-step pairing loop with **Research** as the second step.
- Dedicated Research panel with per-project research rounds.
- Research entry kinds: findings, questions, decisions, no-research-needed,
  and skipped rounds.
- Sourced findings: a finding requires at least one URL or local file path.
- Enforced research gate: the loop cannot advance past Research until the round
  is confirmed or explicitly skipped with a recorded reason.
- Visible research-skip warnings in the dashboard, the CLI, and the recap.
- Tool-aware research guidance in the `pi-pairing` skill and session guide.
- CLI commands: `research begin`, `research add`, `research confirm`,
  `research skip`, `research list`, `projects`, `export`, `import`, and
  `data-path`.
- Portable installation: `scripts/install.sh`, `scripts/install.ps1`,
  `scripts/uninstall.sh`, `scripts/ensure-server.sh`,
  `scripts/stop-server.sh`, and `scripts/unlock-server.sh`.
- Platform application-data storage with migration from the previous
  `~/.pi/agent/pi-pairing` location.
- State schema version 3 with automatic migration from versions 1 and 2.
- GitHub Actions CI, issue templates, and a pull-request template.

### Security

- JSON-only command requests, size-limited bodies, and Host/Origin validation.
- Owner-only state file permissions and a single-writer state lock.
- State replacement guarded by an expected revision and an empty-state check.

### Reliability

- Monotonic revisions plus per-server instance identifiers prevent stale
  browser or CLI responses from reverting newer state.
- Failed writes no longer leave the in-memory state mutated.
- The browser reconnects automatically when the server restarts and recovers
  from a deliberate state reset.
