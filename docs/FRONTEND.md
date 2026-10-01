# geMMO Frontend Architecture

The live browser client is intentionally build-free so GitHub Pages can publish the repository root directly, but the source is separated by responsibility.

## Files

| Path | Owns |
| --- | --- |
| `index.html` | Semantic page/overlay markup and asset loading only |
| `assets/content.js` | Expandable client content: world graph, shops, gems, equipment definitions, board type metadata |
| `shared/encounters.js` | Shared encounter definitions consumed unchanged by browser and Node |
| `shared/combat-rules.js` | Shared deterministic rule helpers used by browser presentation and server replay |
| `shared/story.js` | Shared cutscene, NPC, dialogue-tree, and quest definitions |
| `assets/combat-core.js` | Pure deterministic combat primitives: seeded RNG, swap, match detection, legal-move discovery |
| `assets/app.js` | Runtime state, UI behavior, world renderer, combat orchestration/presentation, API/session client |
| `assets/styles.css` | Canonical responsive visual system and dungeon theme |
| `tests/abilities.cjs` | Production-client regression harness; executes the real content/runtime files |

The Sack screen presents owned gems and equips the five-gem loadout. Inventory presents gear and consumables only; account inventory records still include gems for server ownership and Sack validation.

The shell loads assets in this order:

```text
assets/styles.css
assets/content.js
shared/encounters.js
shared/combat-rules.js
shared/story.js
assets/combat-core.js
assets/app.js
```

`shared/encounters.js`, `shared/combat-rules.js`, `shared/story.js`, and `combat-core.js` must load before `app.js`.

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

### Add story, NPCs, or quests

Define narrative content in `shared/story.js`. The browser owns cinematic/dialogue presentation, but persistent quest state and rewards must flow through the story API. New objective kinds require a server-side verifier in `server/db.cjs`; never trust a client-supplied "objective complete" flag or reward amount.

NPC definitions name their world node, dialogue trees map account quest state to entry nodes, and quest definitions declare giver/return NPCs, objective data, and rewards. Reuse the generic runners before adding NPC-specific runtime code.

### Add a region or world area

Keep geography/content in `assets/content.js`. Keep pathfinding, camera behavior, animation, and interaction logic in `assets/app.js`. Server movement validation remains authoritative.

### Add UI

Markup belongs in `index.html`; behavior belongs in `assets/app.js`; visual rules belong in `assets/styles.css`.

Do not put new inline application CSS or JS back into `index.html`.

## Styling rules

geMMO has one canonical palette root in `assets/styles.css`. Theme tokens belong there.

The stylesheet now also has one canonical **Unified responsive layout system** at the end of the file. It owns shared page geometry, content widths, page heroes, menu composition, utility-card layouts, world chrome geometry, and phone/tablet/landscape composition. Specialized component styling can live with its component, but do not add another generic tablet/page system.

Prefer:

- existing semantic variables
- component classes
- shared responsive breakpoints
- `pageHero`, `pageTopbar`, and the shared content-width tokens for new full-page screens
- board-first/world-first layouts where the gameplay surface stays visually dominant

Avoid:

- new competing `:root` palettes
- page-specific copies of the same component
- inline styles for reusable UI
- generic layout overrides below the canonical responsive system
- `!important` unless required to override third-party behavior

Historical generic tablet rules were removed during the unified layout pass. Continue simplifying older component declarations when touching them rather than rebuilding a second shell.

The same rule now applies to runtime structure: deterministic board/RNG primitives belong in `combat-core.js`; small rules that must be identical in browser and replay belong in `shared/combat-rules.js`; encounter orchestration, animation, UI, and network behavior stay in `app.js`. Continue extracting coherent pure seams instead of introducing a framework rewrite.

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

Rat, Bandit, and Road Sentinel victories are replay-verified from server-issued seeds and server-owned loadout snapshots. The Sentinel's Siphon chooses the fullest player reservoir using the shared combat rule. The intent strip shows ready abilities and the nearest charging ability; the board can change before the enemy acts, so charging text is a threat cue rather than a promised move. The remaining trust upgrade is architectural rather than encounter-specific: replay is after-the-fact verification, not live server-owned intent processing.

## Sack and purchasing controls

Select a collection gem, then activate its destination slot, or drag the gem icon/handle onto the slot (mouse can drag the whole card). Touch scrolling remains available on the rest of each card. Both paths call the same destination-aware equip operation. Moving an equipped gem swaps positions; replacing a weapon places it in the requested slot and moves any displaced regular gem to the former weapon slot where possible. The UI keeps at least one gem equipped and waits for serialized loadout saves before entering the map or starting combat.

Equipment effects stay visible without mobile hiding or clipping in shops and Inventory. Shop activation opens a native confirmation dialog showing effects, price, and balance. Cancel spends nothing; only explicit Buy sends a purchase, with duplicate activation blocked while the request is pending.

Warden Vale offers the initial weapon through the story overlay, with five color choices, full effects/charge costs, and a second confirmation step. Before choosing, travel attempts open the offer and the map objective points to the Warden. The offer scrolls at all text sizes; failed saves retain the selection for retry.
