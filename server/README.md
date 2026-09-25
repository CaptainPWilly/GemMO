# GemMO account authority

This service is the first server-side trust boundary for GemMO.

## What it owns

- usernames and password hashes
- opaque login sessions
- level, XP and gold
- owned gems and physical gear
- five unique Sack slots
- armor/accessory equipment slots
- security audit events

The browser may request loadout changes, but the server validates ownership, slot compatibility and uniqueness before saving them.

The browser is not allowed to write level, XP, gold, inventory grants or match rewards. Those routes are explicitly blocked. Persistent combat rewards remain disabled until the combat engine itself is moved behind the same server-authoritative boundary.

## Security model

Passwords use Node's built-in scrypt with a unique random salt. Session tokens are 256-bit random opaque values; only SHA-256 token hashes are stored in SQLite. Browser tokens belong in sessionStorage, not URLs, logs or Git.

Controls in the prototype service include prepared SQL statements, a 16 KiB body limit, login and registration rate limits, temporary lockouts after repeated bad passwords, a strict origin allowlist, security headers, session expiry/revocation, immutable client boundaries around progression, and audit events for denied progression/match-settlement attempts.

## Run locally

Requires Node 22.18 or newer.

Set GEMMO_ORIGIN to the exact browser origin and run node server/server.cjs. The default API address is http://127.0.0.1:8787.

For public deployment, terminate HTTPS in front of this process, store GEMMO_DB on persistent storage, configure GEMMO_ORIGIN exactly, and only set TRUST_PROXY=1 behind a reverse proxy you control.

## Current anti-cheat boundary

Account and loadout tampering is already server-validated. Combat itself is still local in this branch. Local combat gold/XP therefore cannot be promoted to the persistent profile. The next anti-cheat gate is a deterministic server match engine where clients submit only intent and receive authoritative state and rewards.

SQLite is appropriate for this single-node prototype. Node 22's built-in node:sqlite is still active development, so a public multi-instance service should migrate the same schema and constraints to a production database before scale-out.
