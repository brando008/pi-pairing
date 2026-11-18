## Pi Pairing v1.1.1

A small teaching-behavior patch: Pi now learns **forward** instead of opening
rabbit holes.

### What changed

The `pi-pairing` skill and session guide now state an explicit rule:

> **Teach forward, not sideways.**
>
> Rephrase a concept once. Give one concrete example from the code being
> changed. If it still does not land, say so briefly, keep the task moving, and
> carry the concept forward as a `Revisit:` checklist item.

That item stays visible on the dashboard, is mentioned in the final recap, and
can be picked up naturally the next time the same concept shows up. Repetition
across sessions teaches more durably than a long detour in one session.

Pi still pauses to teach something deeply when:

- you ask to understand it now,
- the misunderstanding would lead to incorrect or unsafe code, or
- it is a data-loss, migration, or security risk.

The recap now also mentions any concept that was carried forward and whether it
came up again during the session.

### Install or update

```bash
pi install github:brando008/pi-pairing
```

Existing clones:

```bash
git pull
./scripts/install.sh
```

### Documentation

- [README](https://github.com/brando008/pi-pairing#readme)
- [Session guide](https://github.com/brando008/pi-pairing/blob/main/skills/pi-pairing/references/SESSION_GUIDE.md)

Licensed under the [MIT License](https://github.com/brando008/pi-pairing/blob/main/LICENSE).
