# Security Policy

## Supported versions

The latest released version receives security fixes. Please upgrade to the most
recent release before reporting an issue.

## Reporting a vulnerability

Do **not** open a public issue for a security problem.

Email the maintainer or use GitHub's private vulnerability reporting for the
repository. Include:

- A description of the issue and its impact.
- Steps to reproduce.
- The version, operating system, and Node.js version you used.

You can expect an acknowledgement within seven days and a status update as the
issue is investigated.

## Security design

Pi Pairing is a local-first developer tool. The current safeguards are:

- The server binds to `127.0.0.1` and is not exposed to the network.
- Static assets are served from an allowlist; path traversal is denied.
- Command requests must use `Content-Type: application/json` and a size-limited body.
- API requests validate the `Host` header and any `Origin` header, which blocks cross-origin simple requests and DNS rebinding.
- The command layer is allowlisted and every mutation is validated by the core state rules.
- The state file is written atomically with owner-only permissions.
- A single-writer lock prevents two servers from writing the same state file.
- The browser renders user-controlled text with `textContent`, never as HTML.

## Threat model

Pi Pairing stores project names, checklist text, and research notes on the
developer's machine. It does not send data anywhere. The main risks are a
malicious local process, another local user on a shared machine, and a
compromised browser extension.

State is not encrypted. On a shared machine, use a dedicated user account or
set `PI_PAIRING_DATA_DIR` to an encrypted volume.
