# GemMO v0.2 — Sack Model

Godot 4.7.x mobile-first combat prototype.

## Locked core rule
The board is random. The Sack does **not** contain tile counts or alter spawn rates.
Each fighter equips one gem per universal color; when that fighter matches a color, their equipped gem defines what that color does.

### Player Sack
- Red: Slash — matching deals damage; charged active Heavy Slash.
- Blue: Guard — matching grants Guard; charged active Brace.
- Green: Mend — matching charges; active heals.
- Yellow: Quickstep — matching charges; active allows one free adjacent swap.
- Purple: Overdrive — matching charges; active doubles the next colored match.

### Bandit Sack
- Red: Bolt
- Blue: Evade
- Green: Bandage
- Yellow: Reload
- Purple: Deadeye

Both combatants use the same board but interpret its colors through different Sacks.

### Board families
Five universal colors + Gold + XP + Environment. Wild does not spawn naturally; a 5-match creates it. A 4-match grants the player an extra turn in this prototype.
