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

- Account = save file. Durable player state lives in Turso.
- Login is remembered on the device until logout or server-session expiry.
- New and reset accounts choose one permanent damage starter: Red Dagger, Yellow Sling, or Blue Crystal Wand.
- The Sack supports 1–5 unique owned gems and uses a compact deck/card collection UI.
- Physical gear is separate from Sack gems.
- Base player HP is **18** plus equipment bonuses.
- Early equipment can modify HP, opening Guard, and color reservoir capacity.
- Overworld movement is server-validated. Tapping a reachable distant node follows the shortest unlocked route and animates every segment.
- Rat is the first encounter; clearing it unlocks the Bandit path.
- Story now supports account-persistent cutscenes, dialogue NPCs, and server-authoritative quests. Warden Vale at Ember Camp offers the first quest, **Trouble on the Road**.
- Combat Gold/XP are settled to the account on victory through match tickets. Every match receives a server-issued loot budget.
- Rat and Bandit victories are **server replay-verified** from a server seed plus a player-intent transcript; combat rewards come from the replay, not from the browser's claimed result.
- The browser still runs the live fight for responsiveness; the server independently reconstructs completed fights before accepting victory/progression. See the architecture document.
- Combat has an always-available menu for Gemology/Surrender, a live **Current Effects** drawer, and a compact visual move history that shows actual gem value. Combo 1's colored gems become cascade anchors: Combo 2 adds +1 value, Combo 3 +2, and so on, with the anchored crystals visibly charging in the history rail.
- Layouts adapt across phone, tablet portrait, and tablet landscape.

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
