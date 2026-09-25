# GemMO

GemMO v0.2 is a mobile-first, turn-based match-3 combat prototype. Both fighters share one random board; each fighter's Sack determines what matching each color does.

## Browser playtest

The existing v2 browser prototype is `index.html`. It is self-contained HTML, CSS, and JavaScript with no build step or external assets. It retains the v2 combat rules with a medieval visual theme, animated match pops and column refills, and damage effects that travel to health bars. The five equipment cards show item names above their abilities. Reduced-motion preferences disable the animated effects.

Play: https://CaptainPWilly.github.io/GemMO/

Tap two adjacent gems to swap. Match colors to apply Sack effects and charge abilities. Tap a charged ability to use it in place of a board move. A four-match grants an extra turn; a five-match creates a Wild. Use **View Sacks** for both fighters' color effects. Return to camp to start a new match. Sack choices and settings are saved locally; combat progress is not saved.

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

A root-based static deployment also serves files under `godot/`; keeping the repository private does not make published site files private. This prototype has no backend, multiplayer service, or persistent save system.

## Sack-building playtest

Start at the splash screen, tap to enter the camp menu, and choose **SACK** to equip five items. All 15 items are unlocked. Select a slot, then select an item to replace it; the selection advances to the next slot. Any color mix and duplicate items are allowed. PLAY requires all five slots to be filled and starts a fresh Bandit fight.

Red matches deal base damage and blue matches grant base Guard for every loadout. Charge from a matched color is divided equally between equipped items of that color, including full items; absent-color charge is lost. This preserves the total charge budget when stacking duplicate colors. Each active replaces a board move. Overdrive cannot stack. The settings page offers reduced animation. Loadouts and settings persist locally when browser storage is available.

These items are provisional sidegrades, not a verified competitive balance. The Godot prototype has not been updated to match the browser's new menu and item system.

| Color | Item | Ability | Charge | Effect |
|---|---|---|---:|---|
| red | Iron Dagger | Heavy Slash | 7 | Deal 6 damage. |
| red | Notched Axe | Cleave | 9 | Deal 8 damage. Slower to charge. |
| red | Ash Spear | Jab & Brace | 7 | Deal 3 damage and gain 3 Guard. |
| blue | Oak Shield | Brace | 7 | Gain 6 Guard. |
| blue | Iron Buckler | Riposte | 7 | Gain 3 Guard and deal 3 damage. |
| blue | Ward Stone | Shelter | 7 | Gain 3 Guard and heal 2 HP. |
| green | Herbal Salve | Mend | 6 | Heal 5 HP, up to 24. |
| green | Field Poultice | Patch Up | 4 | Heal 3 HP. Quick, smaller healing. |
| green | Briar Ring | Thorn Balm | 6 | Heal 2 HP and deal 3 damage. |
| yellow | Worn Boots | Quickstep | 6 | Make one adjacent swap, even without a match. |
| yellow | Travel Cloak | Take Cover | 6 | Gain 5 Guard. |
| yellow | Throwing Knife | Quick Throw | 6 | Deal 5 damage. |
| purple | Rune Charm | Overdrive | 10 | Double your next colored match once. |
| purple | Ember Seal | Rune Strike | 10 | Deal 8 damage. |
| purple | Moon Relic | Renewal | 10 | Heal 4 HP and gain 4 Guard. |
