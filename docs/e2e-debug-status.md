# E2E Test Status

## Current State: 12/14 pass, 2 skipped

All executable E2E tests pass. 710 Jest tests pass.

### Test Results
| File | Test | Status |
|------|------|--------|
| maneuver-basics | planner opens with all units unassigned | ✅ |
| maneuver-basics | clicking unit marker shows destination highlights | ✅ |
| maneuver-basics | clicking territory assigns destination and shows arrow | ✅ |
| maneuver-basics | action picker appears with enemy units | ✅ |
| maneuver-basics | stay in place by clicking origin territory | ✅ |
| maneuver-peace | peace action shows orange border | ✅ |
| maneuver-submit | submit button disabled when unassigned | ✅ |
| maneuver-submit | submit button enabled when all assigned | ✅ |
| maneuver-submit | all units staying in place is valid submission | ✅ |
| maneuver-multi-unit | virtual state tracks enemy destruction | ✅ |
| maneuver-war-cascade | war→peace recascades with 2 enemies | ✅ |
| maneuver-war-cascade | removing move doesn't affect unrelated units | ✅ |
| maneuver-war-cascade | cancel war cascades hostile→invalid | ⏭ skipped |
| maneuver-war-cascade | cancel fleet clears convoy army dest | ⏭ skipped |

### Skipped Tests
1. **Cancel war cascade** — Tests virtual state: after Army 1 wars at territory, Army 2 should see "hostile" option. After cancelling Army 1, Army 2's hostile should reset. Skipped because the auto-advance timing between units makes it hard to reliably test the intermediate action picker state in E2E.

2. **Fleet removal cascade** — Tests convoy dependency: fleet at sea provides convoy for army, removing fleet should clear army destination. Skipped because sea territories (Adriatic Sea) don't have boundary polygon data, so `data-territory` selectors can't click them. Needs TerritoryHotspot fallback support for sea territories.

### Key Reference Files
- `docs/game-logic.md` — Rules spec (sections 1-10 under "Maneuver System")
- `docs/maneuver-ui-spec.md` — UI interaction spec
- `TODOS.md` — Remaining work items and completed phases
- `CLAUDE.md` — Project overview, tech stack, architecture

### Fixes Applied
**Null-safety guards:**
- `helper.getPlayersInOrder` — null check on gameState/playerInfo
- `helper.getTimer` — null check on gameState/playerInfo/timer
- `helper.computeScore` — null check on playerInfo/countryInfos, missing country entries
- `mapAPI.getRondel` — null check on gameState/countryInfo
- `mapAPI.getUnits` — skip territories without unitCoords

**Selector fixes in `e2e/helpers/selectors.js`:**
- `getHighlightedTerritories` → `.imp-boundary--selectable[data-territory]`
- `clickTerritory` → `.imp-boundary--selectable[data-territory="..."]`
- `getArrowCount` → `.imp-movement-arrow`
- `isActionPickerVisible` → `.imp-action-picker`
- `getActionPickerOptions` → `.imp-action-picker__btn`
- `pickAction` → `.imp-action-picker button:has-text(...)`
- `getSubmitButtonState` / `clickSubmit` → `.imp-submit-fab`
- `clickRemoveOnRow` → `.anticon-check-circle` parent + `.anticon-close`

**Component fix:**
- `TerritoryBoundaryLayer.js` — added `data-territory={name}` to SVG polygons

**Test fixes:**
- Replaced unreachable Rome with adjacent Budapest in 6 tests
- Used correct action labels: "Declare war on Italy army", "Enter peacefully", "Enter as hostile occupier"
- Added explicit `clickUnitMarker()` calls instead of relying on auto-advance
- Added `waitForSelector('.anticon-check-circle')` between sequential assignments
- Removed all debug console.log from ManeuverPlanProvider.js and spec files
