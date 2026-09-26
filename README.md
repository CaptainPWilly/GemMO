# geMMO

geMMO is a live, web-first match-3 RPG prototype.

**Play:** https://captainpwilly.github.io/GemMO/

The production stack is intentionally small:

```text
GitHub Pages (index.html)
        ↓ HTTPS
Render Node account/game API
        ↓
Turso/libSQL persistent database
```

The browser is the current game. The `godot/` project is an older prototype and is **not** the source of truth for live gameplay.

## Start here if you are developing

Read **[CONTRIBUTING.md](CONTRIBUTING.md)** before changing production behavior. It explains the local setup, source-of-truth files, test commands, PR flow, and deployment pipeline.

For architecture and trust boundaries, read **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

For production infrastructure, secrets, and recovery, read **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Repository map

| Path | Purpose |
|---|---|
| `index.html` | Live browser client, UI, match-3 engine, world renderer, responsive layouts |
| `tests/abilities.cjs` | Browser/gameplay regression harness |
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
- New accounts choose one permanent starter gem.
- The Sack supports 1–5 unique owned gems.
- Physical gear is separate from Sack gems.
- Base player HP is **18** plus equipment bonuses.
- Early equipment can modify HP, opening Guard, and color reservoir capacity.
- Overworld movement is server-validated. Tapping a reachable distant node follows the shortest unlocked route and animates every segment.
- Rat is the first encounter; clearing it unlocks the Bandit path.
- Combat Gold/XP are settled to the account on victory through match tickets.
- Combat still runs primarily in the browser. The current settlement layer prevents duplicate/fake match IDs but is **not full server-authoritative anti-cheat**. See the architecture document.
- Combat has an always-available menu for Gemology/Surrender and an Equip drawer for inspecting the current loadout.
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
