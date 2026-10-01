# Weapon and support color balance

New combat uses `replay-v4`. `shared/color-balance.js` is the browser/server definition of current gem overrides. The original content and compact server GEM catalog remain available to replay-v1/v2/v3 fights. A resumed fight uses its saved version, inventory, skills, random seed and transcript; balance changes never reinterpret an old fight.

## Color identities

| Color | Support function | Weapon interaction | Color skill (second node) |
| --- | --- | --- | --- |
| Red | Amplification | Bloodstone Whet strengthens the first weapon-color match in each of the next three actions, regardless of weapon color. | Red match primes +1 damage on the next weapon match. |
| Blue | Prevention | Guard, ripostes and reflection protect any weapon build. | Blue match grants 1 Guard. |
| Green | Recovery | Healing, regeneration and cleansing sustain any weapon build. | Green match heals 1 HP. |
| Yellow | Tempo and positioning | Quick shields, chosen gem breaks, swaps and blasts create opportunities without copying Red damage amplification. Powder Bomb adds 2 weapon charge. | Yellow match adds 1 weapon charge. |
| Purple | Board and enemy control | Chaos Orb converts a tile to the weapon color; curses, silence and charge stealing disrupt opponents. | Purple match steals 1 enemy charge into weapon charge when available. |

All second-node skills still grant their original one starting charge. Their new effects require an equipped gem of their color and a match worth at least three. Each triggers once per player action, including across cascades. Red priming holds at most one bonus. Skill and attunement activation flags are part of saved combat state. Combo-anchor bonuses never retrigger these perks.

Support gems have no passive Attack or Defense stat in v4. Weapons alone select match-damage colors. Basic starter weapon damage is 1 per matched gem; larger weapons costing at least 9 charge have 2 Attack. Activated abilities can still deal damage from a supporting color. One weapon per loadout remains enforced by the existing server rules.

## Starter budgets

Every starter costs 7 charge. Different effects carry conditional value rather than identical numerical damage:

| Weapon | Activated ability |
| --- | --- |
| Iron Dagger | 7 direct damage |
| Crystal Wand | 4 damage + 3 Guard |
| Thorn Whip | 4 damage + 3 healing |
| Leather Sling | 4 damage without ending the turn |
| Ritual Dagger | 5 damage through Guard + steal up to 2 enemy charge into weapon charge |

Guard can expire, healing can overheal, a quick hit saves an action, and piercing/charge theft depend on the opponent. These are budget choices, not a claim that every effect always has exactly equal value.

## Verification and balance probe

Run `node tests/abilities.cjs`, `node tests/color-support.cjs`, and `npm test --prefix server`. The suites check current and saved combat rules, cross-color support, active abilities, actual Guard piercing, bounded perks, board and RNG parity, target abilities and resume/cascade continuation for all five starters.

Run `GEMMO_BALANCE_SAMPLES=50 node scripts/balance-colors.cjs` to reproduce the recorded PvE probe in `color-balance-results.json`. It uses seeds 1–50, all three encounters, all five weapons and two profiles: a starter alone, and a weapon plus Bloodstone Whet, Oak Shield, Lifebloom Sigil and Chaos Orb with two weapon-color skill points. Both versions receive the same seeds. Optional `GEMMO_BALANCE_VERSIONS`, `GEMMO_BALANCE_WEAPONS` and `GEMMO_BALANCE_MERGE=1` allow focused reruns; merged results require the same sample count.

The policy understands the player's weapon color, available abilities and tile conversion. It is one heuristic, not an optimal player. Its limited sample, fixed support pack and existing Red-attacking NPCs cannot establish PvP equality or the strength of every mixed-color build. Report win-rate differences honestly; do not count legal combinations as proven competitive builds. Follow-up balance should vary support packs, skill allocations and player policies.

### Recorded mixed-build comparison

Across the Bandit and Sentinel samples (100 fights per weapon/version), the fixed mixed build averaged these win rates:

| Weapon color | Before | Current |
| --- | --- | --- |
| Red | 97% | 87% |
| Blue | 81% | 78% |
| Green | 67% | 74% |
| Yellow | 50% | 69% |
| Purple | 55% | 67% |

The spread narrowed from 47 to 20 percentage points. This remains a measurable balance gap; the budget and identity pass is not proof of competitive equality.
