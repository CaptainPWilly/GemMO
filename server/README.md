# geMMO account authority

The Node service under `server/` is the persistent trust boundary for the live browser game.

For the full system diagram and authoritative/non-authoritative split, see **../docs/ARCHITECTURE.md**.

## Run locally

Requires Node 22.18+.

```bash
npm install
GEMMO_ORIGIN=http://127.0.0.1:8000 npm start
```

Default API address:

```text
http://127.0.0.1:8787
```

The browser automatically targets that API when served from localhost/127.0.0.1.

Local storage defaults to `server/data/gemmo.db` (gitignored). Override with `GEMMO_DB` when needed.

## Tests

```bash
npm test
```

The server suite covers registration/login, sessions, persistent account snapshots, starter selection, Sack/equipment validation, world movement, shops, match tickets, idempotent rewards, Turso adapter behavior, CORS/security boundaries, and Turnstile behavior.

## Production database

Set both:

```text
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
```

When configured, the service uses Turso/libSQL and initializes the schema automatically.

Production Render storage is ephemeral; do not rely on a local SQLite file there.

## Security

- scrypt password hashing
- opaque 256-bit sessions; only SHA-256 token hashes are stored
- 7-day session TTL
- login/register rate limiting
- repeated-password lockout
- 16 KiB request-body limit
- origin allowlist
- security headers
- Turnstile verification when configured
- server validation for inventory, Sack, equipment, world movement, shops, and match settlement

The browser remembers its session token in localStorage for login continuity. The token is a credential only; character/save state stays server-side.

## Important anti-cheat limitation

Persistent account state is server-owned, but the board/action combat engine is still client-side. Match tickets and reward caps prevent several classes of abuse and make settlement idempotent, but they do not make combat fully authoritative.

See **../docs/ARCHITECTURE.md** before changing settlement or combat trust boundaries.
