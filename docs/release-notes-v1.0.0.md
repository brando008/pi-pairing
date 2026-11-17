## Pi Pairing v1.0.0

The first public release of **Pi Pairing** — a research-first pair-programming
companion for Pi.

### What it does

- Keeps a visible **eight-step engineering loop** per project:
  Problem → Research → Inspection and Explanation → Steps → Changes → Help →
  Review → Recap.
- Adds a dedicated **Research panel** with per-problem research rounds,
  findings, questions, decisions, sources, and confidence.
- **Enforces a research gate**: the loop cannot advance past Research until the
  round is confirmed or explicitly skipped with a recorded reason.
- Makes skipped research **visible** everywhere — dashboard, CLI, and recap.
- Tracks project checklists with items that can be added, completed, renamed,
  reordered, and deleted.
- Lets Pi and you update the same dashboard from the **CLI**, with live
  Server-Sent Events keeping the browser in sync.
- Ships an installable **`pi-pairing` skill** and a detailed session guide that
  teach rather than take over.

### Install

```bash
pi install github:brando008/pi-pairing
```

or clone and install:

```bash
git clone https://github.com/brando008/pi-pairing.git
cd pi-pairing
./scripts/install.sh
```

### Start the dashboard

```bash
npm start
```

Then open <http://127.0.0.1:4173>.

### Use it with Pi

```text
/skill:pi-pairing ~/GitHub/campus Implement the attendance endpoint
```

or simply:

```text
Let's use the Pi Pairing method on ~/GitHub/campus.
```

### Highlights

- No third-party dependencies — Node.js standard library only.
- Local-first storage with atomic writes, owner-only permissions, and a
  single-writer lock.
- Loopback-only server with JSON-only commands and Host/Origin validation.
- Monotonic revisions plus per-server instance identifiers, so stale browser
  or CLI responses can never revert newer work.
- Automatic schema migration, plus `export`, `import`, and `data-path` commands.
- 120 automated tests plus a headless Chrome acceptance suite.

### Documentation

- [README](https://github.com/brando008/pi-pairing#readme)
- [Architecture](https://github.com/brando008/pi-pairing/blob/main/docs/architecture.md)
- [Contributing](https://github.com/brando008/pi-pairing/blob/main/CONTRIBUTING.md)
- [Security policy](https://github.com/brando008/pi-pairing/blob/main/SECURITY.md)

Licensed under the [MIT License](https://github.com/brando008/pi-pairing/blob/main/LICENSE).
