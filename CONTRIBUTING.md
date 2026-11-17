# Contributing to Pi Pairing

Thanks for helping improve Pi Pairing. The project is small, dependency-free, and designed to stay that way.

## Getting started

```bash
git clone https://github.com/brando008/pi-pairing.git
cd pi-pairing
npm test
npm run test:browser
```

Node.js 18 or newer is required. There is nothing to install.

## Ground rules

- **No runtime dependencies.** The tool ships with the Node.js standard library only. Dev-only tooling is also avoided unless it earns its place.
- **Tests come with the change.** Every behavior change needs a test that fails before the fix.
- **Keep the loop vocabulary stable.** The eight step labels are part of the public contract:
  Problem, Research, Inspection and Explanation, Steps, Changes, Help, Review, Recap.
- **The research gate stays enforced.** Skipping research is allowed, but only through the recorded skip path so the warning is always visible.
- **Never commit user state.** The state file lives in the platform data directory, never in the repository.

## Workflow

1. Open an issue first for anything larger than a small fix, so the design can be discussed before the code is written.
2. Create a branch: `git checkout -b feature/short-description`.
3. Write a failing test that describes the new behavior.
4. Implement the smallest change that makes the test pass.
5. Run `npm test` and `npm run test:browser`.
6. Update the README and `docs/` when behavior or commands change.
7. Open a pull request that explains the problem, the approach, and the evidence.

## Commit messages

Use imperative, scoped messages:

```text
feat: add research round CLI commands
fix: keep stale browser responses from reverting state
docs: document the research gate
```

## Reporting bugs

Include the operating system, Node.js version, the command you ran, what you expected, and what happened. A failing test case is the most useful bug report.

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
