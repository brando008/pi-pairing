## Pi Pairing v1.1.0

A simpler, faster Pi Pairing: the mandatory research phase is replaced by a
short **understanding checkpoint**, and each project can choose how much
teaching detail it wants.

### What changed

- The loop is now:

  ```text
  Problem → Understanding → Inspection and Explanation → Steps
          → Changes → Help → Review → Recap
  ```

- **Understanding** is one editable summary of what Pi thinks the problem is
  and how it proposes to approach it.
- Pi asks “Does this match your understanding?” and waits for your answer
  before planning code. In autonomous mode, Pi records and confirms it
  automatically.
- The **Research panel** is now the **Understanding panel**: a summary editor,
  a confirm button, and a teaching-depth selector.
- Each project has a **teaching depth**:
  - **Concise** — minimal summary and explanations.
  - **Standard** — balanced teaching (default).
  - **Deep** — full reasoning, alternatives, and trade-offs.
- The `research *` commands were replaced by:
  - `pi-pairing understanding set "<project>" "<summary>"`
  - `pi-pairing understanding confirm "<project>"`
  - `pi-pairing understanding show "<project>"`
  - `pi-pairing project depth "<project>" <concise|standard|deep>`

State schema version 4 migrates automatically. Existing v1.0.0 research rounds
become understanding summaries, and confirmed rounds stay confirmed.

### Why

The goal of Pi Pairing is learning efficiency, not research ceremony. The old
phase asked for rounds, sources, entry kinds, and confidence levels before any
code could happen. The new checkpoint keeps the part that mattered—catching a
misunderstanding before implementation—and drops the ceremony.

### Install

```bash
pi install github:brando008/pi-pairing
```

or update an existing clone:

```bash
git pull
./scripts/install.sh
```

### Documentation

- [README](https://github.com/brando008/pi-pairing#readme)
- [Architecture](https://github.com/brando008/pi-pairing/blob/main/docs/architecture.md)
- [Session guide](https://github.com/brando008/pi-pairing/blob/main/skills/pi-pairing/references/SESSION_GUIDE.md)

Licensed under the [MIT License](https://github.com/brando008/pi-pairing/blob/main/LICENSE).
