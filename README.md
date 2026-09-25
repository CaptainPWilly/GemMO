# GemMO

GemMO v0.2 is a mobile-first, turn-based match-3 combat prototype. Both fighters share one random board; each fighter's Sack determines what matching each color does.

## Browser playtest

The existing v2 browser prototype is `index.html`. It is self-contained HTML, CSS, and JavaScript with no build step or external assets. Its contents are unchanged from `GemMO_v2_sack_model.html`.

Expected GitHub Pages address once publishing is enabled: https://CaptainPWilly.github.io/GemMO/

Tap two adjacent gems to swap. Match colors to apply Sack effects and charge abilities. Tap a charged ability to use it in place of a board move. A four-match grants an extra turn; a five-match creates a Wild. Use **View Sacks** for both fighters' color effects. Refresh to start a new match; progress is not saved.

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
