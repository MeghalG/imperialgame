# E2E Test Debug Status

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

### Files Changed
- `public/client/src/backendFiles/turnAPI.js` — null guards (committed)
- `public/client/src/backendFiles/helper.js` — null guard on getCountries (committed)
- `public/client/src/backendFiles/mapAPI.js` — null guards on all functions (committed)
- `public/client/src/ManeuverPlanProvider.js` — debug logging (uncommitted)
- `public/client/e2e/maneuver-basics.spec.js` — debug logging (uncommitted)
- `public/client/src/TerritoryHotspot.js` — data-territory added (committed, but not used by hotspot layer)
