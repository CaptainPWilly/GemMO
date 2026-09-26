# geMMO Architecture

## Runtime overview

```text
Player browser
  index.html
    ├─ UI / responsive layout
    ├─ isometric world renderer
    ├─ local match-3 combat engine
    └─ authenticated API client
          ↓
Render Node service
  server/server.cjs
    ├─ auth / sessions / Turnstile
    ├─ world movement
    ├─ shops / equipment / Sack validation
    ├─ match tickets + victory settlement
    └─ account snapshots
          ↓
server/db.cjs
    ├─ Turso/libSQL in production
    └─ node:sqlite for local tests/dev
```

## Trust boundary

### Server-authoritative

The server/database own:

- users and password hashes
- login sessions
- level / XP / Gold
- inventory ownership
- Sack slots
- physical equipment slots
- starter choice
- current world node
- cleared encounter flags
- shop purchases
- match ticket identity
- idempotent reward settlement

A browser request cannot directly set profile wealth/progression.

### Still client-authoritative

The live browser currently owns most combat simulation:

- board RNG/state
- swaps and match resolution
- cascades and Wild creation
- HP/Guard/buffs during the fight
- enemy move selection
- local Gold/XP tallies submitted at victory

The server binds settlement to a real match ticket/current encounter and prevents duplicate settlement, but a modified client can still fabricate a valid `won:true` result/tallies within server caps.

**Do not describe the current combat system as fully anti-cheat.**

The next major trust upgrade is a server-owned deterministic match engine where the client sends intents (swap, activate, target) and receives authoritative state.

## Persistence

Production must have both:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

The server initializes required tables automatically.

If Turso config is absent during local development, geMMO uses local SQLite.

On Render, local SQLite is ephemeral and must never be treated as durable production storage.

## Authentication

- username/password
- passwords: scrypt with random salt
- session tokens: random opaque 256-bit values
- only SHA-256 token hashes are stored server-side
- browser remembers the raw session token in localStorage
- logout revokes the server session and clears local token storage
- sessions expire server-side after 7 days
- Turnstile protects register/login in production when configured

## World model

The world is a server-validated graph.

The browser may pathfind across multiple visible/unlocked nodes, but it submits each edge individually to `POST /v1/world/move`. This means long-distance tap-to-travel does not bypass server adjacency/lock rules.

Current progression:

```text
                 Shrine
                   |
Camp ─ Crossroads ─ Rat ─ Bandit
 │
 ├─ Gem Shop
 └─ Item Shop
```

Bandit is hidden/locked until Rat is cleared.

## Match settlement

1. Client reaches an encounter node.
2. Fight start requests `POST /v1/matches/start`.
3. Server verifies the player is physically at that encounter and creates a unique match ID.
4. On victory, client calls `POST /v1/matches/settle` with `won:true`; on defeat/surrender it settles `won:false` with zero rewards.
5. Victory settlement verifies match ownership, encounter location, reward shape/caps, and unsettled status.
6. Rewards + encounter unlock are committed transactionally only for victories.
7. Loss settlement closes the ticket without rewards or encounter progress.
8. Retrying any settled match is idempotent and cannot double-award.
9. Unsettled tickets older than 24 hours are automatically closed as abandoned losses by server maintenance.

The client retries transient victory-settlement failures and exposes a manual **RETRY SAVE** action. Defeat settlement is best-effort because abandoned tickets are safely closed server-side.

## Data/catalog duplication

Some live presentation/combat definitions remain in `index.html`, while persistent validation definitions live in `server/catalog.cjs`.

If a persistent rule exists on both sides, treat server values as authoritative and update both in the same PR.

Longer term, extracting shared data generation is desirable, but do not weaken server validation just to remove duplication.
