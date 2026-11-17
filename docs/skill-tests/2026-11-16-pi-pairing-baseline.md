# Pi Pairing Skill Baseline

**Date:** 2026-11-16

Three fresh-context agents were given the same behavioral objective without the future `pi-pairing` skill installed. Each scenario combined time pressure, authority pressure, sunk-cost pressure, and a request to reduce or omit teaching. The runner marked the response-only simulations as failed implementation lanes, but their complete outputs were preserved and reviewed.

## Scenario 1 — Deadline pressure

The agent preserved the junior-driver role, used a visible seven-step loop, explained the big picture, left the meaningful implementation slice with the user, offered progressive help, required fresh verification, and ended with a learning recap.

It did not need a skill to infer the desired behavior in this scenario. This establishes that the skill must preserve an already-good pattern rather than add ceremony.

## Scenario 2 — Exhausted incident debugging

The agent explicitly took over implementation and stated:

> Mode: I run it, patch it, verify it, hand you the diff. No teaching, no recap, no questions unless I'm blocked.

It preserved fresh verification and refused to weaken tests, but omitted or deferred:

- Big-picture explanation in the conversation.
- User implementation.
- The progressive help ladder.
- The in-chat learning recap.
- Interactive teaching and decision-making.

Its exact rationale was that the user was exhausted, explicitly delegated, had already attempted three fixes, and asked for no explanation or recap. It considered coaching a fourth attempt to be “malpractice at that fatigue level.” The recap was moved to a hypothetical `PAIRING-NOTES.md` file rather than delivered conversationally.

This is the clearest baseline failure: a generic coding-agent response can honor the immediate request while silently abandoning the learning objective of the pairing session.

## Scenario 3 — Urgent review and approval

The agent mostly preserved the pairing method. It kept the user in the driving seat, used progressive help, required raw evidence, and refused to grant approval on the user's behalf.

It still rationalized these omissions:

- Compressing the recap instead of treating it as a required learning step.
- Skipping the first rung of diagnosis after pressure to “paste the whole thing.”
- Writing the triage table and evidence-brief scaffolding instead of having the user produce them.
- Accepting user-pasted transcripts as a weaker substitute for independently running verification.
- Not challenging whether the deadline was for review completion or fix completion.

## Cross-Cutting Rationalizations

The baseline exposed recurring escape hatches:

1. **“The user delegated, so teaching no longer matters.”**
2. **“The user is tired, so explanations can be deferred forever.”**
3. **“Green tests and approval are the deliverable; learning is optional.”**
4. **“Sunk cost makes reopening a settled decision forbidden, even when evidence requires it.”**
5. **“No time for questions means the agent may skip diagnosis and write more of the artifact.”**
6. **“A visible seven-step checklist is enough even if the steps are only labels.”**
7. **“A pasted transcript is evidence, so independent verification can be weakened.”**

## Skill Requirements Derived From RED

The skill must therefore require:

- An explicit mode declaration when the user asks for autonomous work.
- A visible canonical loop with the exact labels Problem, Inspection and Explanation, Steps, Changes, Help, Review, and Recap.
- A concise big-picture explanation before implementation unless the user explicitly opts out.
- The user to drive by default, with autonomy treated as an announced mode switch rather than a silent role inversion.
- A progressive help ladder during pairing mode.
- A minimum learning recap or an explicit offer to deliver it later after an autonomy session.
- Fresh verification run by Pi against the final tree, not merely pasted output.
- Human ownership of release and approval verdicts.
- Explicit disclosure when a settled decision cannot be preserved safely.
- Dashboard synchronization at each loop transition.
