# geMMO Deployment

## Production services

### Frontend

GitHub Pages publishes repository root:

```text
https://captainpwilly.github.io/GemMO/
```

The live entry point is `index.html`.

### Backend

Render:

```text
https://gemmo.onrender.com
```

Health check:

```text
https://gemmo.onrender.com/health
```

### Durable database

Turso/libSQL.

Render's local filesystem is not used as the production save database.

## Required Render environment

Non-secret:

```text
NODE_ENV=production
HOST=0.0.0.0
GEMMO_ORIGIN=https://captainpwilly.github.io
TRUST_PROXY=1
TURNSTILE_EXPECTED_HOSTNAME=captainpwilly.github.io
```

Secrets:

```text
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
```

GitHub Actions secret:

```text
RENDER_DEPLOY_HOOK_URL
```

Never commit or paste secret values into repository files.

## Automatic release pipeline

`.github/workflows/tests.yml` runs on PRs and main.

After **geMMO Tests** succeeds on `main`, `.github/workflows/render-deploy.yml`:

1. reads the exact tested SHA,
2. calls the Render deploy hook with that SHA,
3. polls production `/health`,
4. requires production `release` to equal the tested SHA prefix,
5. reports the storage provider/persistence state.

GitHub Pages publishes the same main commit independently.

## Healthy production response

Expected shape:

```json
{
  "ok": true,
  "service": "gemmo-account",
  "brand": "geMMO",
  "captcha": true,
  "release": "<12-char tested SHA>",
  "storage": {
    "provider": "turso",
    "persistent": true
  }
}
```

If `storage.provider` is `sqlite` or `persistent` is false, account durability is broken even if the server responds.

## Recovery checklist

### Frontend works, login/server fails

1. Check Render deployment status/logs.
2. Open `/health`.
3. Confirm the release matches current tested main.
4. Confirm Turso storage is persistent.
5. Check Turnstile/Turso environment variables exist.
6. Never solve persistence by moving account state into browser storage.

### Account data disappears

Immediately check `/health`.

Production should be Turso. Render local SQLite is ephemeral.

### Turso startup failure

Common mistakes already guarded by the adapter:

- URL/token reversed
- `libsql://` URL requiring normalization
- missing one of the two Turso values

Regenerate any token that was exposed in logs/chat and replace it in Render.

### Deploy workflow never triggers

Check:

- main **geMMO Tests** succeeded
- GitHub secret `RENDER_DEPLOY_HOOK_URL` exists
- deploy-hook URL is current
- workflow permissions have not been changed

The deploy workflow intentionally fails if the hook secret is absent; a green deployment must mean a deploy was actually attempted and verified.
