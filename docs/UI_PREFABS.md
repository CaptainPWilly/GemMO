# geMMO UI Prefab Contract

The UI is intentionally split into **universal prefabs** plus a few **specialized shells**.

## Rule

New screens must compose from the prefabs below. Do not create a new one-off topbar, hero, section header, toolbar, card geometry, empty state, sheet, overlay, or modal unless the existing prefab cannot represent the behavior.

Visual identity can vary by feature (gem color, map art, combat state), but **screen geometry and interaction hierarchy stay universal**.

## Standard screen composition

Use this order where applicable:

1. `uiScreen` — full-screen safe-area/content-width shell
2. `uiTopbar` — back/menu + eyebrow/action
3. `uiHero` — kicker, screen title, short description, optional stat summary
4. `uiSectionHead` — section title + concise status/action
5. `uiToolbar` — search/filter/sort controls
6. `uiCard` / `uiPanel` — content
7. `uiEmpty` — reserved empty state; do not collapse geometry

## Prefabs

- **uiScreen**: safe-area padding, responsive max width, horizontal rhythm.
- **uiTopbar**: 46px canonical navigation row, separator, shared control alignment.
- **uiHero**: canonical title block and vertical spacing.
- **uiSectionHead**: repeated section heading/status line.
- **uiToolbar**: canonical 40px control row.
- **uiCard**: interactive or list card material/radius/focus treatment.
- **uiPanel**: non-list raised surface.
- **uiEmpty**: stable empty-state footprint.
- **uiSheet**: bottom/floating secondary surface.
- **uiOverlay**: full-screen task overlay.
- **uiModal**: centered blocking dialog.

## Specialized shells

These are allowed to own layout because gameplay requires it:

- **World**: map viewport + persistent hub HUD.
- **Combat**: board-first arena + five-gem dock.
- **Splash/Menu**: entry/navigation presentation.
- **Story**: cinematic sheet.

Even specialized shells should use universal controls, cards, typography, spacing tokens, sheets, and modals where appropriate.

## Device universality

A prefab must work at:
- narrow phones (<=390px),
- standard phones,
- tablets / portrait,
- desktop / landscape,
- Extra Large text.

Avoid fixed heights for text-bearing containers unless a dedicated breakpoint handles XL text. Prefer reserved footprints for live widgets (history, status, empty states) so content appearing does not cause layout jumps.

## Symbol language

Use symbols for repeated game-state concepts and accessible text labels for meaning:
- ♥ HP
- ◈ Guard
- ◌ Evade
- ◆ Gold
- ✦ progression / skill points
- ◇ Sack / equipped gem context
- ▣ Inventory / equipment
- ⚔ combat
- ✓ owned/equipped

Icon-only controls require `aria-label` (and `title` where useful).

## Expansion gate

Before adding a new screen:
1. Identify which prefab each region uses.
2. If a new prefab is genuinely required, add it here first.
3. Add a regression assertion in `tests/abilities.cjs`.
4. Verify phone + XL text behavior.
