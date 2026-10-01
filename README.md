# geMMO

geMMO is a live, web-first match-3 RPG prototype.

**Play:** https://captainpwilly.github.io/GemMO/

The production stack is intentionally small:

```text
GitHub Pages
  index.html + assets/
        ↓ HTTPS
Render Node account/game API
        ↓
Turso/libSQL persistent database
```

The browser is the current game. The `godot/` project is an older prototype and is **not** the source of truth for live gameplay.

## Start here if you are developing

Read **[CONTRIBUTING.md](CONTRIBUTING.md)** before changing production behavior. It explains the local setup, source-of-truth files, test commands, PR flow, and deployment pipeline.

For architecture and trust boundaries, read **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

For browser-client ownership and expansion rules, read **[docs/FRONTEND.md](docs/FRONTEND.md)**.

For production infrastructure, secrets, and recovery, read **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Repository map

| Path | Purpose |
|---|---|
| `index.html` | Thin live browser shell and semantic UI markup |
| `assets/content.js` | Client world, shops, gem catalog, gear, and other expandable content |
| `shared/encounters.js` | Shared browser/server encounter contract: HP, rewards, match rules, enemy reservoirs, abilities, AI weights |
| `shared/combat-rules.js` | Shared cross-runtime combat rules such as cascade-anchor charging |
| `shared/story.js` | Shared cutscene, NPC, dialogue-tree, and quest definitions |
| `assets/combat-core.js` | Pure deterministic browser combat primitives: seeded RNG, matching, swaps, legal-move discovery |
| `assets/app.js` | Live runtime, UI behavior, combat orchestration, world renderer, authenticated API client |
| `assets/styles.css` | Canonical responsive dungeon visual system |
| `tests/abilities.cjs` | Production-client/gameplay regression harness |
| `server/server.cjs` | HTTP API and auth endpoints |
| `server/db.cjs` | Local SQLite + Turso database adapter and persistence logic |
| `server/catalog.cjs` | Server-authoritative shop/gear/world catalog |
| `server/security.cjs` | Password/session security helpers |
| `server/test.cjs` | API, persistence, security, reward, and Turso-adapter tests |
| `.github/workflows/tests.yml` | Required client + server CI |
| `.github/workflows/render-deploy.yml` | Deploy exact tested main SHA to Render and verify `/health` |
| `render.yaml` | Render service configuration |
| `godot/` | Legacy Godot prototype; do not assume parity with the browser game |

## Current gameplay snapshot

- New unfinished fights persist to the account and offer Resume or Surrender on return. A server-verified intent checkpoint restores the board, bonuses, charges, effects, pending targets, consumables, and exact RNG position. The device also journals intents to recover an interrupted upload on that same device. Resumable fights do not expire after 24 hours.

- Every account must register a unique character name before entering gameplay. Existing accounts keep their saves and choose a name on their next entry. Names are permanent and separate from login usernames.
- The map crown opens a top-100 leaderboards for level, win rate, matches won, longest cascade, and gems popped; your rank is shown even outside the top 100. Win rate uses settled matches and includes surrenders as losses. Cascade and gem statistics are replay-derived from matches settled after the statistics update.

- Account = save file. Durable player state lives in Turso.
- Login is remembered on the device until logout or server-session expiry. A valid remembered session opens the map after account refresh; fresh login and registration do the same.
- New and reset accounts choose one free weapon from Warden Vale at camp. The Gem Shop sells only non-weapon support gems across all five colors: Bloodstone Whet, Oak Shield, Verdant Rune, Locksmith’s Pick, Powder Bomb, and Chaos Orb.
- The Sack supports 1–5 unique owned gems and uses a compact deck/card collection UI.
- Board gems can naturally spawn with a visible +1 value (1 in 20 by default). The extra value follows that gem through swaps and falls, and adds to match rewards, combat power, and charge. The spawn rate is defined by `BONUS_SPAWN_DENOMINATOR` in `shared/combat-rules.js`; changing it requires a new replay version to preserve unfinished fights.
- The Sack owns the gem collection; Inventory shows only physical gear and one-shot consumables. Server ownership records still cover all three item kinds.
- Base player HP is **18** plus equipment bonuses.
- Early equipment can modify HP, opening Guard, and color reservoir capacity.
- Overworld movement is server-validated. Tapping a reachable distant node follows the shortest unlocked route and animates every segment.
- Rat is the first encounter; clearing it unlocks Bandit, whose defeat opens the Road Sentinel.
- Story now supports account-persistent cutscenes, dialogue NPCs, and server-authoritative quests. Warden Vale at Ember Camp offers the first quest, **Trouble on the Road**.
- Combat Gold/XP are settled to the account on victory through match tickets. Every match receives a server-issued loot budget.
- Rat, Bandit, and Road Sentinel victories are **server replay-verified** from a server seed plus a player-intent transcript; combat rewards come from the replay, not from the browser's claimed result.
- Combat shows the enemy's current ability threat or the ability nearest to full charge. The Sentinel can drain charge from your fullest reservoir; the same rule runs in the server replay.
- The browser still runs the live fight for responsiveness; the server independently reconstructs completed fights before accepting victory/progression. See the architecture document.
- Combat has an always-available menu for Gemology/Surrender, a live **Current Effects** drawer, and a compact visual move history that shows actual gem value. Combo 1's colored gems become cascade anchors—including colored gems destroyed directly by gem-breaking abilities: Combo 2 adds +1 value, Combo 3 +2, and so on, with the anchored crystals visibly charging in the history rail.
- The UI uses one responsive dungeon layout system across splash/menu, world, loadouts, shops, account/settings, story, and combat; layouts adapt across phone, tablet portrait, and tablet landscape.

## Production health

The backend exposes:

```text
GET https://gemmo.onrender.com/health
```

A healthy persistent production deployment reports the tested release plus:

```json
{
  "ok": true,
  "brand": "geMMO",
  "storage": {
    "provider": "turso",
    "persistent": true
  }
}
```

Do **not** commit production tokens, deploy hooks, Turnstile secrets, or Turso auth tokens.

Weapon gems are explicitly marked ⚔ in the Sack and span all five colors. Equip one weapon gem by default alongside regular gems. Choosing another weapon replaces it without consuming regular gem slots. Additional slots require an explicit `weaponGemSlots` effect, shared by client and server. Existing multi-weapon Sacks keep their first weapon; other weapons remain owned.
