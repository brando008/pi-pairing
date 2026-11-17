# Pi Pairing Skill GREEN and Refactor

**Date:** 2026-11-16

The three baseline scenarios were rerun with the installed `pi-pairing` skill and required guide loaded by fresh read-only reviewer agents.

## GREEN Result

All three scenarios now:

- Announce the exact autonomous-mode transition when delegation is requested.
- Use the canonical seven labels.
- Explain the problem-tied big picture in compressed form.
- Change or preserve the driving boundary explicitly.
- Keep the progressive-help ladder visible.
- Require Pi to run final-tree verification.
- Keep the recap visible rather than silently dropping it.
- Leave approval and release verdicts with the human.
- Synchronize the dashboard with real CLI commands.
- Preserve diagnosis, scope control, test integrity, and settled decisions under deadline or authority pressure.

## Refactor Findings and Fixes

### Recap substitution

The first green run exposed that “offer a recap later” could still drift into indefinite deferral or replacement with a notes file.

**Fix applied:** Autonomous mode requires a brief three-to-five-bullet recap. If the user explicitly declines it, the visible loop must mark Recap as deferred and offer a concrete later slot. A notes file is forbidden as a substitute.

### Help-ladder vocabulary

The skill and guide used different names for the same four help rungs.

**Fix applied:** Both now use:

```text
Direction → Pseudocode → Specific guidance → Walkthrough
```

Autonomous turns must name the rung used and disclose skipped rungs.

### Canonical loop label

The guide used the `Inspection` alias while the fixed label is `Inspection and Explanation`.

**Fix applied:** The guide now uses the canonical label. The CLI retains the alias for convenience.

### Missing project path

Neither contract explicitly addressed a named path that does not exist.

**Fix applied:** Pi must state that the path is missing, ask for the correct path once, continue any unblocked work, and never invent file contents.

### Relayed authority

A lead’s relayed request could have been interpreted as authorization to change mode.

**Fix applied:** Relayed authority may compress ceremony only. It cannot change mode by itself or waive diagnosis, verification, scope control, test integrity, or human approval.

## Refactor Retest

After the fixes, all three pressure scenarios were rerun with fresh reviewer agents and the installed skill explicitly loaded.

Each scenario passed all ten checks:

1. Announced mode switch
2. Exact canonical seven labels
3. Problem-tied big picture
4. Explicit driving boundary
5. Canonical help rungs and skipped-rung disclosure
6. Final-tree verification
7. Brief recap or explicit deferral without a substitute
8. Human-owned approval
9. Dashboard synchronization
10. Missing-path handling

No new contract defects were found. The simulated paths were absent, and every reviewer correctly disclosed that fact instead of inventing repository contents.

## Remaining Non-Contract Notes

The simulated repositories `/tmp/calendar`, `/tmp/payments`, and `/tmp/inventory` do not exist in the test environment. The reviewers correctly labeled repository-specific details as placeholders and did not fabricate inspection results. A live session must derive all repository claims from the actual tree.
