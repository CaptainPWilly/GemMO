## What changed

<!-- Short description of the player/developer-visible change. -->

## Source-of-truth files touched

- [ ] Browser client (`index.html`)
- [ ] Browser tests (`tests/abilities.cjs`)
- [ ] Server/API (`server/server.cjs`)
- [ ] Persistence (`server/db.cjs`)
- [ ] Server catalog (`server/catalog.cjs`)
- [ ] Server tests (`server/test.cjs`)
- [ ] Docs / deployment

## Verification

- [ ] `node tests/abilities.cjs`
- [ ] `cd server && npm test`
- [ ] Phone portrait checked (if UI changed)
- [ ] Tablet portrait/landscape checked (if UI changed)
- [ ] Account persistence/login checked (if auth/save changed)
- [ ] Victory/save retry checked (if combat/reward changed)

## Production safety

- [ ] No secrets/tokens committed
- [ ] Client was not made authoritative for persistent state
- [ ] Persistent rules mirrored server-side where needed
- [ ] Architecture/deployment docs updated if behavior changed
