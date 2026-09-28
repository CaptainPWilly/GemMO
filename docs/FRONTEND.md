# geMMO Frontend Architecture

The live browser client is intentionally build-free so GitHub Pages can publish the repository root directly, but the source is separated by responsibility.

## Files

| Path | Owns |
| --- | --- |
| `index.html` | Semantic page/overlay markup and asset loading only |
| `assets/content.js` | Expandable client content: world graph, shops, gems, equipment definitions, board type metadata |
| `shared/encounters.js` | Shared encounter definitions consumed unchanged by browser and Node |
| `assets/combat-core.js` | Pure deterministic combat primitives: seeded RNG, swap, match detection, legal-move discovery |
| `assets/app.js` | Runtime state, UI behavior, world renderer, combat orchestration/presentation, API/session client |
| `assets/styles.css` | Canonical responsive visual system and dungeon theme |
| `tests/abilities.cjs` | Production-client regression harness; executes the real content/runtime files |

The shell loads assets in this order:

```text
assets/styles.css
assets/content.js
shared/encounters.js
assets/combat-core.js
assets/app.js
```

`shared/encounters.js` and `combat-core.js` must both load before `app.js`.

## Expansion rules

### Add or change a gem

1. Update the client gem definition in `assets/content.js`.
2. If the gem affects authoritative combat or persistent validation, update the matching server definition in the same PR.
3. Run `node tests/abilities.cjs` and `cd server && npm test`.
4. Keep the client/server gem parity assertion green.

Do not make the browser authoritative for ownership, rewards, or persistent progression.

### Add an encounter

An encounter normally touches several ownership boundaries:

- client world/content definition in `assets/content.js`
- client presentation/runtime behavior in `assets/app.js`
- server world/match validation in `server/`
- deterministic replay when the encounter awards authoritative progression
- regression tests and architecture documentation

A new encounter starts in `shared/encounters.js`: define HP, reward ranges, match scaling, reservoirs, active abilities, and AI weights there, then place a world node that references its encounter ID. Do not add encounter-ID conditionals to the runtime or copy a second combat engine. Extend the generic interpreter only when a genuinely new rule kind is needed.

### Add a region or world area

Keep geography/content in `assets/content.js`. Keep pathfinding, camera behavior, animation, and interaction logic in `assets/app.js`. Server movement validation remains authoritative.

### Add UI

Markup belongs in `index.html`; behavior belongs in `assets/app.js`; visual rules belong in `assets/styles.css`.

Do not put new inline application CSS or JS back into `index.html`.

## Styling rules

geMMO has one canonical palette root in `assets/styles.css`. Theme tokens belong there.

Prefer:

- existing semantic variables
- component classes
- shared responsive breakpoints

Avoid:

- new competing `:root` palettes
- page-specific copies of the same component
- inline styles for reusable UI
- `!important` unless required to override third-party behavior

The current stylesheet still contains historical component declarations beneath the canonical theme. Future visual work should simplify those sections instead of stacking another theme layer on top.

The same rule now applies to runtime structure: deterministic board/RNG primitives belong in `combat-core.js`; encounter orchestration, animation, UI, and network behavior stay in `app.js`. Continue extracting coherent pure seams instead of introducing a framework rewrite.

## Test philosophy

`tests/abilities.cjs` does not test a copied combat implementation. It loads the actual production `assets/content.js` and `assets/app.js` into a controlled VM and tests that code directly.

Structural assertions also ensure:

- `index.html` remains a thin shell
- content loads before runtime
- CSS remains external
- application JS remains external
- only one canonical palette root exists

## Server boundary

The browser is responsible for presentation, input, and responsive local simulation. The server/database remain authoritative for accounts, inventory, Sack ownership, equipment, world progress, purchases, match identity, and persistent rewards.

Rat and Bandit victories are replay-verified from server-issued seeds and server-owned loadout snapshots. The remaining trust upgrade is architectural rather than encounter-specific: replay is after-the-fact verification, not live server-owned intent processing.
