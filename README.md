# GemMO

GemMO v0.2 is a mobile-first RPG prototype built around turn-based match-3 combat. Players travel an isometric overworld, collect gems and gear, and enter encounters where both fighters share one board.

## Browser playtest

The existing v2 browser prototype is `index.html`. It is self-contained HTML, CSS, and JavaScript with no build step or external assets. It retains the v2 combat rules with a medieval visual theme, animated match pops and column refills, and damage effects that travel to health bars. The five equipment cards show item names above their abilities. Reduced-motion preferences disable the animated effects.

Play: https://CaptainPWilly.github.io/GemMO/

Use **INVENTORY** to equip ordinary armor and accessories, and **SACK** to build your five-gem combat kit. Tap two adjacent gems to swap. Match colors to apply Sack effects and charge abilities. Tap a charged ability to use it in place of a board move. A four-match grants an extra turn; a five-match creates a Wild. Open **GEMOLOGY** from the main menu for the live board rules and tile meanings. Use **View Sacks** for both fighters' equipped abilities. Return to camp to start a new match. Sack choices and settings are saved locally; combat progress is not saved.

For a local playtest, open `index.html` in a modern browser, or serve this directory with a static HTTP server. Portrait phone layout is the intended experience.

## Repository layout

```text
index.html          Browser prototype / Pages entry point
.nojekyll           Serve the static files without Jekyll processing
README.md           Project and publishing guide
godot/
  project.godot     Godot project entry point
  main.tscn         Main scene
  scripts/         Existing game and splash scripts
  README.md        Original Godot prototype notes
```

## Godot source

Import `godot/project.godot` in a compatible Godot editor. The existing project declares Godot 4.7 and GL Compatibility. All Godot files are preserved unchanged; project-relative `res://` paths remain valid after moving the entire project together.

GitHub Pages runs the browser prototype. The Godot directory contains editable source, not a Godot web export. The browser and Godot implementations may differ; neither was rewritten during the repository cleanup.

## GitHub Pages setup

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Choose **main** and **/ (root)**, then **Save**.
4. Wait for GitHub's Pages deployment to complete, then open the published URL shown in Settings.
5. Test on a phone in portrait: confirm the board and five ability buttons fit, open and close View Sacks, make a matching adjacent swap, and confirm the Bandit responds.

GitHub Free requires a public repository for Pages. Private repositories require an eligible paid plan. Do not change repository visibility without the owner's explicit approval. See [GitHub Pages requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

A root-based static deployment also serves files under `godot/`; keeping the repository private does not make published site files private. The repository now includes a Node account authority under server/. GitHub Pages remains static and must be configured to call a separately deployed HTTPS account service for real persistent accounts.


## Accounts, persistence, security and anti-cheat

GemMO now has a separate server authority in server/. Accounts use username/password login. Passwords are salted with scrypt; opaque 256-bit session tokens are stored server-side only as SHA-256 hashes and are revocable/expiring.

The persistent server owns the player's level, XP, gold, item ownership, Sack and physical equipment. A newly created account owns **nothing**: zero gems, zero armor and zero accessories. On the first press of PLAY, the player must permanently choose exactly one starter gem: Iron Dagger (Red), Oak Shield (Blue), Herbal Salve (Green), Worn Boots (Yellow), or Rune Charm (Purple). Only that gem is granted and placed in Sack slot 1; the other four slots remain empty. The browser may request later loadout changes, but ownership, unique-gem rules and gear-slot compatibility are revalidated server-side before saving.

The client has no API that can directly set level, XP, Gold, inventory grants or combat rewards. Attempts to write profile progression or submit a self-declared match settlement are rejected and audited. This means browser devtools/localStorage edits cannot create persistent wealth.

Combat resolution itself is still local. For that reason, local fight XP/Gold deliberately does not sync into the persistent account yet. The next anti-cheat gate is to move the deterministic board engine to the server so the client sends only intents such as swap, activate and target; the server then owns the board state and reward settlement.

The browser account token is kept in sessionStorage rather than long-lived localStorage. The account service also enforces origin allowlisting, prepared SQL, request-size limits, auth rate limits, repeated-password-failure lockouts, session expiry/revocation and security headers.

## Isometric overworld

PLAY no longer jumps directly into combat. After the one-time starter choice, the player enters **Brackenreach: The Old Road**, a rendered isometric overworld with terrain elevation, roads, trees, rocks, landmarks, camera panning/zoom, and tappable destinations.

The initial level-1 route is intentionally small:

- **Ember Camp** — starting safe node
- **Old Crossroads** — road junction
- **Broken Shrine** — landmark branch
- **Bandit Toll** — first combat encounter

Travel follows explicit connected roads. Logged-in movement is validated and persisted by the account server, so the client cannot teleport from Ember Camp directly to Bandit Toll. The route is Camp → Crossroads → Bandit Toll; the Broken Shrine branches from Crossroads.

Selecting the Bandit Toll while standing there exposes **FIGHT BANDIT**, which enters the existing match-3 combat scene. Leaving or finishing combat returns to the world instead of the camp menu.

The current browser map uses an isometric terrain renderer rather than a flat node menu. It is intentionally data-driven so later regions can add towns, dungeons, shops, quests, roaming encounters and larger maps without changing the combat board.

## Level 1 inventory and equipment

Physical gear is separate from gems. The player has eight non-gem equipment slots: **Head, Chest, Hands, Legs, Feet, Necklace, Ring I, and Ring II**. The two ring slots accept ring items independently; one physical item cannot occupy two slots at once.

The first gear tier is intentionally small. Level-1 armor and accessories only modify **Max HP** or **Starting Guard** so the RPG layer does not overwhelm the match board. Base Max HP remains 24. Starting Guard behaves like normal Guard and expires after two Bandit actions.

The following 16 basic level-1 pieces exist in the catalog, but **new players do not own any of them**:

| Slot | Item | Level-1 effect |
|---|---|---|
| Head | Frayed Hood | +1 Max HP |
| Head | Leather Cap | +1 Starting Guard |
| Chest | Padded Tunic | +2 Max HP |
| Chest | Hide Vest | +2 Starting Guard |
| Hands | Cloth Wraps | +1 Max HP |
| Hands | Leather Gloves | +1 Starting Guard |
| Legs | Linen Trousers | +1 Max HP |
| Legs | Hide Leggings | +1 Starting Guard |
| Feet | Scuffed Boots | +1 Max HP |
| Feet | Leather Boots | +1 Starting Guard |
| Necklace | Copper Pendant | +1 Max HP |
| Necklace | Bone Talisman | +1 Starting Guard |
| Ring | Tin Ring | +1 Max HP |
| Ring | Iron Band | +1 Starting Guard |
| Ring | Twine Ring | +1 Max HP |
| Ring | Copper Band | +1 Starting Guard |

Equipment and inventory persist on the account server when logged in. The inventory structure is separate from equipped slots so future drops, shops, rarity, affixes, and item removal can be layered on without changing the combat Sack.

## Sack-building playtest

Start at the splash screen and enter the camp. New accounts begin with an empty inventory and empty five-slot Sack. The first PLAY opens the one-time starter choice; after choosing, only that single gem is owned and equipped. A Sack may contain 1–5 owned gems, with empty slots allowed. Any color mix is allowed, but the same exact gem cannot occupy more than one Sack slot. Multiple different gems of the same color are allowed.

Red matches deal base damage and blue matches grant base Guard for every loadout. Green, Yellow and Purple have no universal combat effect: by default they only charge equipped gems of their color. Gold grants Gold, XP grants XP, Environment hurts both fighters, and Wild substitutes inside legal lines. Each color has one shared charge reservoir whose capacity is the sum of all equipped item costs of that color. A match adds charge once to that pool; activating an item spends only its cost and preserves the remainder for any same-color item. Absent-color charge is lost. Each active replaces a board move. Overdrive cannot stack. The settings page offers reduced animation. Loadouts and settings persist locally when browser storage is available.

These items are provisional sidegrades, not a verified competitive balance. The Godot prototype has not been updated to match the browser's new menu and item system.

| Color | Item | Ability | Charge | Effect |
|---|---|---|---:|---|
| red | Iron Dagger | Heavy Slash | 7 | Deal 6 damage. |
| red | Notched Axe | Cleave | 9 | Deal 8 damage. Slower to charge. |
| red | Ash Spear | Jab & Brace | 7 | Deal 3 damage and gain 3 Guard. |
| red | Arming Sword | Measured Cut | 8 | Deal 7 damage. |
| red | Warhammer | Crushing Blow | 11 | Deal 10 damage. Slow to charge. |
| red | Longbow | Aimed Shot | 6 | Deal 5 damage. |
| red | Rapier | Parry & Thrust | 7 | Deal 3 damage and gain 3 Guard. |
| red | Halberd | Sweeping Edge | 10 | Deal 9 damage. |
| red | Hand Crossbow | Snap Shot | 4 | Deal 3 damage. Quick, smaller attack. |
| red | Spiked Flail | Chain Strike | 9 | Deal 8 damage. |
| blue | Oak Shield | Brace | 7 | Gain 6 Guard. |
| blue | Iron Buckler | Riposte | 7 | Gain 3 Guard and deal 3 damage. |
| blue | Ward Stone | Shelter | 7 | Gain 3 Guard and heal 2 HP. |
| blue | Tower Shield | Hold the Line | 11 | Gain 10 Guard. Slow to charge. |
| blue | Swordbreaker | Catch & Cut | 7 | Gain 3 Guard and deal 3 damage. |
| blue | Quarterstaff | Defensive Stance | 5 | Gain 4 Guard. |
| blue | Pavise | Fortify | 9 | Gain 8 Guard. |
| blue | War Pick | Driving Point | 8 | Deal 7 damage. |
| blue | Kite Shield | Sheltering Wing | 7 | Gain 3 Guard and heal 2 HP. |
| blue | Hook Spear | Keep at Bay | 8 | Gain 7 Guard. |
| green | Herbal Salve | Mend | 6 | Heal 5 HP, up to 24. |
| green | Field Poultice | Patch Up | 4 | Heal 3 HP. Quick, smaller healing. |
| green | Briar Ring | Thorn Balm | 6 | Heal 2 HP and deal 3 damage. |
| green | Briar Sickle | Harvest Balm | 6 | Heal 2 HP and deal 3 damage. |
| green | Druid Staff | Verdant Renewal | 9 | Heal 8 HP, up to 24. |
| green | Hunting Bow | Hunter’s Mark | 7 | Deal 6 damage. |
| green | Thorn Whip | Briar Lash | 5 | Deal 4 damage. |
| green | Grove Spear | Rooted Stance | 7 | Gain 3 Guard and heal 2 HP. |
| green | Woodland Club | Barkguard | 7 | Gain 6 Guard. |
| green | Willow Wand | Little Mending | 3 | Heal 2 HP. Very quick, small healing. |
| yellow | Worn Boots | Quickstep | 6 | Make one adjacent swap, even without a match. |
| yellow | Travel Cloak | Take Cover | 6 | Gain 5 Guard. |
| yellow | Throwing Knife | Quick Throw | 6 | Deal 5 damage. |
| yellow | Twin Knives | Double Cut | 8 | Deal 7 damage. |
| yellow | Light Crossbow | Loose Bolt | 7 | Deal 6 damage. |
| yellow | Leather Sling | Stone Shot | 3 | Deal 2 damage. Very quick, small attack. |
| yellow | Duelist Sabre | Countercut | 7 | Deal 3 damage and gain 3 Guard. |
| yellow | Scout’s Glaive | Reach | 9 | Deal 8 damage. |
| yellow | Parrying Dagger | Deflect | 4 | Gain 3 Guard. |
| yellow | Javelin | Committed Throw | 10 | Deal 9 damage. |
| purple | Rune Charm | Overdrive | 10 | Double your next colored match once. |
| purple | Ember Seal | Rune Strike | 10 | Deal 8 damage. |
| purple | Moon Relic | Renewal | 10 | Heal 4 HP and gain 4 Guard. |
| purple | Rune Blade | Etched Strike | 8 | Deal 7 damage. |
| purple | Hex Staff | Arcane Bolt | 6 | Deal 5 damage. |
| purple | Relic Mace | Sanctuary | 10 | Heal 4 HP and gain 4 Guard. |
| purple | Moon Scythe | Reap & Restore | 6 | Heal 2 HP and deal 3 damage. |
| purple | Crystal Wand | Prism Ward | 5 | Gain 4 Guard. |
| purple | Spell Tome | Runic Shelter | 7 | Gain 3 Guard and heal 2 HP. |
| purple | Ritual Dagger | Warding Cut | 7 | Deal 3 damage and gain 3 Guard. |

## Combat feedback and Wild rules

The combat chronicle retains the latest 100 events for the current fight. Both fighters' abilities have a prominent last-ability banner and highlighted history entries. The reservoir strip shows each color's shared current charge and capacity. Environment tiles are stone octagons and XP tiles are cyan starbursts.

Wilds substitute for any of the eight normal tile types in horizontal or vertical matches of three or more. A line must contain at least one normal tile; Wild-only lines do not match. Every matched cell is removed and credited at most once. At intersections, a Wild is credited to the first detected qualifying run (horizontal before vertical, normal type order). Four- and five-match rewards still apply. Swapping a Wild must make a legal match unless Quickstep is active; Wilds no longer erase colors or the whole board.

When no legal swaps remain, the game explicitly logs a reshuffle, deals a fresh board, and preserves HP and reservoirs. Cascades, extra turns, and Wild creation are also logged.

## Controls and original specialist builds

Swipe one cell horizontally or vertically, or tap adjacent cells. Settings → Automatic hints offers 15 seconds, 30 seconds (default), or Off. After the selected idle time on your turn, a legal pair glows. Off disables the hint timer. The preference persists in browser storage. When no legal swaps remain, an animated wipe and refill preserves HP and reservoirs. The turn badge counts each completed action, including extra actions. Status chips have hover descriptions and can be tapped to put the explanation in the combat log.

Guard expires after 2 Bandit actions; Bandit Evade expires after 2 player actions. Gaining more refreshes the duration. Veilstep halves damage (round up) through the next 2 Bandit actions. Venom, regeneration and Resonance tick at the end of a Bandit action. Reactivating a timed effect refreshes its duration rather than stacking. Timed healing cannot revive a defeated fighter.

Earthbind pins the selected column through the next Bandit action: matched gaps refill in place while surviving tiles stay in their cells. It does not prevent swapping or matching. Kindle changes one chosen tile to red, Wildcraft creates one Wild, and Row Current wraps one chosen row one cell right. These effects resolve any resulting matches for the player. Borrowed Beat spends charge to grant another action. Siphon steals up to 3 charge from the Bandit's fullest color, subject to the player's purple capacity.

The Sack screen offers six optional original starting builds: Vanguard, Shade, Warden, Spellweaver, Minstrel and Tinkerer. These are editable loadouts, not fixed classes. Item names, descriptions and build text are original genre material. Balance is provisional and requires playtesting.

### Specialist items

| Color | Item | Ability | Cost | Effect |
|---|---|---|---:|---|
| blue | Anchor Maul | Earthbind | 7 | Choose a column. It refills in place without falling through the next Bandit action. |
| yellow | Mist Mantle | Veilstep | 7 | Halve incoming damage, rounded up, for the next 2 Bandit actions. |
| green | Venom Needle | Lingering Venom | 7 | Deal 2 damage after each of the next 2 Bandit actions. |
| green | Wayfarer Lyre | Restoring Verse | 7 | Heal 2 HP after each of the next 3 Bandit actions. |
| purple | Prism Orb | Resonance | 9 | After each of the next 2 Bandit actions, add 1 charge to every equipped color. |
| yellow | Clockwork Spur | Borrowed Beat | 8 | Spend charge to act again immediately. |
| red | Ember Rod | Kindle | 7 | Choose a tile and turn it red. Any resulting matches resolve for you. |
| purple | Star Lens | Wildcraft | 11 | Choose a tile and make it Wild. Any resulting matches resolve for you. |
| blue | Tide Chain | Row Current | 8 | Choose a row. Rotate it one cell right; resulting matches resolve for you. |
| purple | Echo Knife | Siphon | 7 | Deal 2 damage and steal up to 3 charge from the Bandit’s fullest color into your purple reservoir. |


## Attunement prototype

Attunements are the first explicitly match-reactive duration gems. Activating one spends a normal action and refreshes a three-player-action window; reactivation does not stack. Every qualifying match resolution can trigger an Attunement while its three-action window is active, including cascades. A cascade chain can therefore trigger the same Attunement more than once in one action.

| Color | Item | Ability | Cost | Effect |
|---|---|---|---:|---|
| red | Bloodstone Whet | Redwake | 7 | Next 3 actions: every Red match resolution deals +2 flat bonus damage; cascades included. |
| blue | Bastion Sigil | Holdfast | 7 | Next 3 actions: every Blue match resolution grants +2 bonus Guard; cascades included. |
| green | Heartseed | Aftergrowth | 7 | Next 3 actions: every Green match resolution heals 2 HP; cascades included. |
| yellow | Gambler’s Thread | Momentum | 7 | Next 3 actions: every Yellow match resolution sends +2 charge to the most depleted other equipped reservoir; cascades included. |

These are deliberately conditional sidegrades to immediate 7-charge effects. Their value is delayed and board-dependent, but cascade construction can raise their ceiling. Unless an ability explicitly says otherwise, cascades count as real match resolutions for match-reactive effects. They are a prototype mechanic family, not final balance.
