# Contributing to geMMO

This repository ships directly to the live game. Keep changes small, tested, and easy to review.

## 1. Source of truth

The **browser implementation is live**.

- Gameplay/UI/world: `index.html`
- Browser regression tests: `tests/abilities.cjs`
- API/auth: `server/server.cjs`
- Persistence/database behavior: `server/db.cjs`
- Server-owned catalog and world rules: `server/catalog.cjs`
- API/security tests: `server/test.cjs`

The `godot/` directory is historical/experimental. Do not update it for browser work unless the task explicitly calls for Godot parity.

## 2. Local setup

Requirements:

- Node.js **22.18+**
- Python 3 or any static HTTP server

Install the server dependency once:

```bash
cd server
npm install
cd ..
```

Terminal 1 — API:

```bash
cd server
GEMMO_ORIGIN=http://127.0.0.1:8000 node server.cjs
```

Terminal 2 — client:

```bash
python3 -m http.server 8000
```

Open:

```text
http://127.0.0.1:8000/
```

When the browser is running on localhost/127.0.0.1, geMMO automatically uses `http://127.0.0.1:8787` for the API. Production uses `https://gemmo.onrender.com`.

Local development defaults to `server/data/gemmo.db`. That directory is gitignored.

Turnstile is optional locally. If no Turnstile keys are set, local auth works without CAPTCHA.

## 3. Run the same checks as CI

From repository root:

```bash
node tests/abilities.cjs
cd server
npm test
```

If you change Turso integration, also ensure dependencies are installed and the serverless driver still exposes the APIs used by `db.cjs`.

Before opening a PR, test the actual UI at minimum on:

- phone-sized portrait viewport
- tablet portrait viewport (~768–1024 px wide)
- tablet landscape viewport
- account create/login/logout
- world travel
- one combat victory and saved rewards

## 4. Change discipline

### Client-only gameplay/UI change

Usually edit:

- `index.html`
- `tests/abilities.cjs`

### Persistent rule/catalog change

If the browser and server both know the rule, update both sides in the same PR.

Examples:

- shop stock/prices
- gear IDs/slots
- world graph/encounter IDs
- persistent equipment validation

Relevant server definitions live in `server/catalog.cjs`.

### Database/API change

Update:

- `server/db.cjs`
- `server/server.cjs` if the route changes
- `server/test.cjs`
- `docs/ARCHITECTURE.md` if the trust boundary changes

Schema creation is intentionally idempotent. Production runs on Turso; tests/dev can use local SQLite.

## 5. Pull request → production flow

Do not push untested behavior directly to `main`.

Normal flow:

1. Create a focused branch.
2. Make the change.
3. Add/update regression tests.
4. Open a PR into `main`.
5. Wait for **geMMO Tests** to pass.
6. Merge.
7. Main runs **geMMO Tests** again.
8. GitHub Pages publishes the client.
9. **Deploy geMMO Backend** triggers Render with the exact SHA that passed tests.
10. The workflow polls `/health` until that exact release is serving.
11. The deployment is successful only when the live backend reports the tested release.

This avoids deploying a newer untested SHA by accident.

## 6. Production safety rules

- Never commit secrets.
- Never paste production auth tokens into source, issues, PR descriptions, or logs.
- Do not make browser/localStorage data authoritative for Gold, XP, ownership, world progress, or equipment.
- Keep server-side ownership/slot/world/shop validation.
- Preserve idempotent reward settlement.
- Do not claim combat is fully anti-cheat yet; the board/action engine is still client-side.
- Production storage must report `provider: turso` and `persistent: true`.
- If `/health` reports local SQLite on Render, persistence is misconfigured.

## 7. Definition of done

A change is not done just because code merged.

For production-affecting work, verify:

- PR tests pass.
- Main tests pass.
- Pages deploy succeeds.
- Backend deploy verifier succeeds when server code/config changed.
- The live game behaves correctly after a hard refresh.
- Documentation is updated if architecture, controls, persistence, setup, or deployment changed.
