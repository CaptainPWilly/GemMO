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

### Combat authority

**Rat is authoritative by deterministic replay.** Match start snapshots the server-owned Sack/equipment, issues a server RNG seed, and the browser records only player intents (swap, activate, target). On victory the server rebuilds the same board from the seed and replays those intents. The Rat clear and its Gold/XP are accepted only if that replay reaches a legal victory.

The browser still renders and simulates the live Rat fight for responsiveness, but its claimed HP, enemy death, Gold, and XP are not trusted at settlement.

**Bandit is still on the bounded legacy path.** The browser owns its combat simulation and submits the result. The server binds it to a real match ticket and server-issued reward budget, so the client cannot exceed that match's economic ceiling, but it can still fabricate a Bandit victory.

**Do not describe all combat as fully anti-cheat yet.** Rat victory is replay-verified; Bandit victory is not.

The next major trust upgrade is extending the deterministic verifier to the Bandit's active enemy abilities, then moving from after-the-fact replay toward server-owned live intent processing if latency/cost justify it.

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
5. Match start also creates a server-owned randomized reward budget appropriate to the encounter.
6. Rat match start additionally snapshots Sack/equipment and issues a deterministic replay seed.
7. Rat victory submits a compact player-intent transcript. The server rebuilds the board, replays swaps/abilities/targets, enemy turns, cascades, buffs, HP, and loot, and rejects any transcript that does not end in a legal Rat victory.
8. Rat Gold/XP come from the replay result, not the browser's claimed totals.
9. Bandit remains budget-bounded: Gold/XP are capped to the issued budget and attempted overclaims are audited.
10. Rewards + encounter unlock are committed transactionally only for accepted victories.
11. Loss settlement closes the ticket without rewards or encounter progress.
12. Retrying any settled match is idempotent and cannot double-award.
13. Unsettled tickets older than 24 hours are automatically closed as abandoned losses by server maintenance.

The client retries transient victory-settlement failures and exposes a manual **RETRY SAVE** action. Defeat settlement is best-effort because abandoned tickets are safely closed server-side.

## Data/catalog duplication

Some live presentation/combat definitions remain in `index.html`, while persistent validation definitions live in `server/catalog.cjs`.

If a persistent rule exists on both sides, treat server values as authoritative and update both in the same PR.

Longer term, extracting shared data generation is desirable, but do not weaken server validation just to remove duplication.
