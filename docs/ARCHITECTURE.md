# geMMO Architecture

## Runtime overview

```text
Player browser
  index.html
    └─ semantic UI shell
  assets/
    ├─ content.js       expandable world/catalog/gear content
    ├─ ../shared/encounters.js  browser/server encounter contract
    ├─ ../shared/combat-rules.js cross-runtime board/combo rules
    ├─ ../shared/story.js       cutscene/NPC/dialogue/quest contract
    ├─ combat-core.js   deterministic RNG/matching/legal-move primitives
    ├─ styles.css       responsive dungeon visual system
    └─ app.js
        ├─ UI behavior
        ├─ isometric world renderer
        ├─ combat orchestration/presentation
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
- quest acceptance/completion and quest rewards
- account-level seen-cutscene flags
- shop purchases
- match ticket identity
- idempotent reward settlement

A browser request cannot directly set profile wealth/progression.

### Combat authority

**Rat, Bandit, and Road Sentinel are authoritative by deterministic replay.** Every new current-encounter match snapshots the server-owned Sack/equipment, issues a server RNG seed, and the browser records only player intents (swap, activate, target). On victory the server rebuilds the same board from the seed and replays those intents. Progression and rewards are accepted only when that replay reaches a legal victory.

The browser still renders and simulates the live fight for responsiveness. Its claimed HP, enemy death, Gold, and XP are not trusted at settlement; replay output decides the accepted result.

Cascade-anchor charging is also replay-authoritative. The colored types present in Combo 1 become anchors; each later cascade adds its depth as extra core value (+1 on Combo 2, +2 on Combo 3, etc.). The bonus applies symmetrically to both fighters and does not retrigger one-per-match ability procs such as attunement bonuses.

The server retains a legacy budget fallback only so an already-open historical match ticket without a combat proof can still be settled safely. Newly issued Rat, Bandit, and Sentinel tickets use `replay-v2` regardless of local SQLite, file-backed SQLite, or Turso storage.

Replay verification is an important trust boundary, but it is still after-the-fact verification rather than server-owned live action processing. A future multiplayer/PvP boundary can move intent processing live if latency and operating cost justify it.

## Persistence

Production must have both:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

The server initializes required tables automatically.

If Turso config is absent during local development, geMMO uses local SQLite.

On Render, local SQLite is ephemeral and must never be treated as durable production storage.

## Fresh-sacks reset

The September 26, 2026 fresh-start release keeps user credentials and login sessions but resets game progression exactly once through the `2026-09-26-fresh-sacks-v1` data migration.

The migration clears inventory, Sack slots, equipment, starter choice, world clears, open/settled matches, Gold and XP, then returns every account to Camp with an empty Sack. The migration records itself in `app_migrations`; normal restarts and redeploys do not repeat it.

Current new and reset accounts receive an Iron Dagger in the first Sack slot; starter selection has been removed in a later release.

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
Camp ─ Crossroads ─ Rat ─ Bandit ─ Sentinel
 │
 ├─ Gem Shop
 └─ Item Shop
```

Bandit is hidden/locked until Rat is cleared. The Road Sentinel is hidden/locked until Bandit is cleared.

## Story and quest progression

Story presentation is browser-side, but persistent progression is account-backed. `shared/story.js` defines cutscenes, NPC locations, dialogue trees, quest objectives, and rewards for both browser and server.

- Seen cutscenes are stored in `story_flags` so one-time scenes survive reload/login/device changes.
- Accepted/completed quests are stored in `quest_progress`.
- The client may request quest acceptance or turn-in, but the server verifies the player is physically at the correct NPC node.
- Quest readiness is derived from authoritative state. The first objective type, `encounter-clear`, checks server-owned `world_flags`.
- Quest Gold/XP are awarded transactionally by the server on turn-in; the browser cannot submit reward amounts.
- Repeated acceptance/turn-in cannot duplicate progression or rewards.

## Match settlement

1. Client reaches an encounter node.
2. Fight start requests `POST /v1/matches/start`.
3. Server verifies the player is physically at that encounter and creates a unique match ID.
4. Match start snapshots server-owned Sack/equipment, creates a server-owned reward budget, and issues a deterministic `replay-v2` seed.
5. The browser seeds its local fight from that value and records player intents only.
6. On victory, client calls `POST /v1/matches/settle` with `won:true`, its displayed Gold/XP, and the compact transcript. On defeat/surrender it settles `won:false` with zero rewards.
7. The server rebuilds the fight from the snapshot and seed, replays swaps, abilities, targets, enemy actions, cascades, buffs, HP, and loot, and rejects any transcript that does not end in a legal victory.
8. Accepted Gold/XP come from replay output, not from the browser's claimed totals. Mismatches are audited.
9. Rewards and encounter unlocks are committed transactionally only for accepted victories.
10. Retrying any settled match is idempotent and cannot double-award.
11. Historical tickets without resumable checkpoints older than 24 hours are closed as abandoned losses. Resumable tickets remain open until finished or surrendered.
12. Historical proof-less tickets retain a bounded legacy settlement path solely for compatibility; every new supported encounter match carries replay authority.
13. A verified victory writes the generic `encounter:<id>` clear flag, so future world locks can depend on any encounter without new settlement code.

The client retries transient victory-settlement failures and exposes a manual **RETRY SAVE** action. Defeat settlement is best-effort because abandoned tickets are safely closed server-side.

## Data/catalog boundaries

Expandable client world/gem/gear definitions live in `assets/content.js`; runtime behavior lives in `assets/app.js`. Encounter definitions are deliberately different: `shared/encounters.js` is one browser/server source of truth for encounter HP, reward ranges, enemy match scaling, reservoirs, active abilities, AI weights, and first-clear UI text. Cross-runtime board rules such as cascade-anchor charge live in `shared/combat-rules.js`. Story definitions follow the same pattern in `shared/story.js`, while mutable quest/cutscene progress remains server-owned.

Persistent gem/equipment validation still lives in `server/catalog.cjs`, and deterministic combat execution lives in `server/combat.cjs`. If another persistent rule exists on both sides, treat server values as authoritative and update both in the same PR. The regression suite checks the important parity boundaries.

Longer term, a generated shared catalog is desirable, but do not weaken server validation or introduce runtime network dependency just to remove duplication.

`replay-v2` adds deterministic +1 gem value rolls. Existing `replay-v1` match proofs still replay under their original board and scoring rules so a fight opened before deployment can settle. The 1-in-20 spawn rate lives at `BONUS_SPAWN_DENOMINATOR` in `shared/combat-rules.js`. A future rate change must issue a new replay version and retain this v2 rate for unfinished fights.

## Character identity and rankings

`characters` stores one immutable, case-insensitively unique name per account. The table is added idempotently without resetting progression. `POST /v1/account/character` registers a name; account snapshots expose `character` and `needsCharacterName`. Gameplay mutation routes require a registered character; historical match settlement remains available to preserve in-flight rewards. `GET /v1/leaderboard` requires a session and exposes only character names, server-owned XP/derived level, rank, and a self marker. Rankings use XP descending, then account ID ascending, with the top 100 and the caller’s rank returned.

## Match recovery and combat statistics

New matches create an empty `match_checkpoints` journal. Player intents are journaled immediately on the device and uploaded serially to `/v1/matches/checkpoint`. The server accepts only legal replay transcripts extending the stored prefix. `/v1/matches/open` reconstructs the fight from immutable seed/loadout/skill/consumable proofs and saved intents, including completed enemy responses. Recovery returns a stable input boundary, rather than replaying an interrupted visual animation. The client restores all combat fields and advances its seeded RNG by the replay's draw count. Same-device recovery can upload an interrupted journal; another device resumes the last server checkpoint.

Consumable debit and its consume intent are recorded together in one transaction. On resume, paid targeting effects continue without a second debit. Only one new resumable match can be open per account; movement, purchases, skills, and loadout changes are blocked until it is resolved. Surrender settles a loss idempotently. Historical pre-update fights lack journals and cannot reconstruct earlier unsaved intents.

`match_stats` stores replay-derived player gem removals and the longest player cascade once per settled match. Enhanced gems count as one actual removal, and enemy removals are excluded. These metrics include verified actions from surrendered/defeated fights. Historical victories and settled losses contribute to win totals and win rate; old fights lack historical cascade/gem transcripts, so those records start with this release. Pending matches never enter win rate. All ranking metrics are selected from a whitelist, show the top 100 plus the caller's rank, and use account order for final ties; win-rate ties first compare wins.
