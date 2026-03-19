# E2E Test Debug Status

## Key Reference Files
- `docs/game-logic.md` — Rules spec (sections 1-10 under "Maneuver System")
- `docs/maneuver-ui-spec.md` — UI interaction spec (map-first interaction model, plan list, action picker, peace votes, submit state machine, edge cases)
- `TODOS.md` — Remaining work items and completed phases
- `CLAUDE.md` — Project overview, tech stack, architecture

## Current State: 2/14 E2E tests pass

### Root Cause Found
The `TerritoryHotspotLayer` renders `TerritoryBoundaryLayer` (SVG polygons), NOT `TerritoryHotspot` divs. The `data-territory` attribute was added to `TerritoryHotspot.js` but that component is NOT used by the hotspot layer anymore — it was replaced by `TerritoryBoundaryLayer.js`.

### What Works
- Firebase emulator seeds data correctly (correct namespace + auth token)
- App renders the maneuver planner (plan list with Fleet/Army rows)
- Unit markers render with correct titles ("fleet at Trieste", "army at Vienna")
- Clicking unit markers activates them (confirmed via CSS class change)
- `loadData` completes successfully, destOptions are populated (Fleet: 2 opts, Army: 13 opts each)
- `mapInteraction.setInteraction('select-territory', selectables, ...)` IS called with correct selectables
- No more runtime errors (null guards added)

### What Doesn't Work
- `TerritoryBoundaryLayer` renders SVG polygons for territory selection, not `TerritoryHotspot` div elements
- The E2E selectors query for `.imp-hotspot--selectable` and `[data-territory]` — these CSS classes/attributes exist on `TerritoryHotspot.js` but NOT on `TerritoryBoundaryLayer.js`
- The boundary layer uses different CSS classes for its SVG elements

### Fix Required
Update the E2E selectors to match what `TerritoryBoundaryLayer` actually renders. Check:
1. What CSS classes does `TerritoryBoundaryLayer` use for selectable territories?
2. Does it have any data attributes for territory names?
3. Update `e2e/helpers/selectors.js` to match the actual DOM structure

Alternatively, add `data-territory` attributes to the SVG elements in `TerritoryBoundaryLayer.js`.

### Debug Logging Added (remove after fix)
- `ManeuverPlanProvider.js`: console.log in loadData (dest options count), map effect (activeUnit, selectables count)
- `maneuver-basics.spec.js`: browser console capture, marker state debug

### Remaining Null-Safety Issues
The error context snapshot still shows runtime errors:
- `helper.getPlayersInOrder` — reads `gameState.playerInfo` without null check
- `mapAPI.getRondel` — reads `gameState.countryInfo` without null check
These need null guards like the others.

### Files Changed
- `public/client/src/backendFiles/turnAPI.js` — null guards (committed)
- `public/client/src/backendFiles/helper.js` — null guard on getCountries (committed), getPlayersInOrder still needs one
- `public/client/src/backendFiles/mapAPI.js` — null guards on most functions (committed), getRondel still needs one
- `public/client/src/ManeuverPlanProvider.js` — debug logging (uncommitted, remove after fix)
- `public/client/e2e/maneuver-basics.spec.js` — debug logging (uncommitted, remove after fix)
- `public/client/src/TerritoryHotspot.js` — data-territory added (committed, but not used by hotspot layer)

### Session Summary
This session completed 4 phases of maneuver system work:
1. **Rules spec** — Full rewrite of game-logic.md maneuver section (10 sections)
2. **UI spec** — docs/maneuver-ui-spec.md (interaction model, edge cases, state machine)
3. **Bug fixes** — 8 bugs fixed (peace voter pool, neutral/sea peace, BFS over-expansion, coexisting rules, blow-up consumption, etc.)
4. **Code changes** — Deprecated step-by-step path (-1997 lines), unified unit layer, destruction viz, cascade extraction, convoy cleanup, multi-country peace votes
5. **Tests** — 666 → 710 Jest tests, 14 Playwright E2E skeletons (2 passing)
