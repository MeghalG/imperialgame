# TODOs

## ~~P1: Rewrite Maneuver Rules Spec~~ ✅ DONE
Completed 2026-03-18. Commits: `4ae4fa7a`, `e4a6a532`. Full 10-section spec now in `docs/game-logic.md`.

## ~~P1: Write Maneuver UI Interaction Spec~~ ✅ DONE
Completed 2026-03-18. Commit: `6a87016f`. Full spec in `docs/maneuver-ui-spec.md`.

## ~~P0: Playwright E2E Test Infrastructure~~ ✅ DONE
Completed 2026-03-18. Playwright config, Firebase emulator seeding with correct namespace/auth, 12 E2E test skeletons.

## ~~P1: Phase 1 — Game Logic Correctness~~ ✅ DONE
Completed 2026-03-18. Hostile rule enforcement, auto-accept coexisting units, shared cascade function, plus 5 additional bugs from spec audit (peace voter pool, peace on neutral/sea, army BFS over-expansion, coexisting unit rules, blow-up consumption order). 675→710 tests.

## ~~P1: Phase 2 — Peace System + Convoy~~ ✅ DONE (2 of 3)
Completed 2026-03-18. Convoy 1:1 limit cleaned up, multi-country sequential peace votes implemented. Democracy rejection unit-type vote deferred. 710 tests.

## ~~P2: Deprecate Step-by-Step Maneuver Path~~ ✅ DONE
Completed 2026-03-18. Commit: `08903e55`. -1997 lines, 666 tests pass.

## ~~P2: Phase 3 — Visualization Gaps~~ ✅ DONE
Completed 2026-03-18. UnifiedUnitLayer replaces dual rendering, destruction X markers on war arrows, convoy viz already existed.

## P1: E2E Test Infrastructure — Fix App Null Safety
**What:** Fix null-safety in Firebase read paths (turnAPI.getTitle, helper.getCountries, mapAPI, stateAPI) so the app doesn't crash when game state is partially loaded. Required for E2E tests to work.
**Why:** 12/14 E2E tests fail because the seeded game state triggers null reference errors in components that read before data is fully available. ManeuverPlanProvider's loadData succeeds but other components crash, leaving the app in a broken interaction state.
**Context:** The errors are `Cannot read properties of null (reading 'mode')`, `null (reading 'setup')`, `null (reading 'playerInfo')`, `null (reading 'countryInfo')`. Each read function needs a null guard returning a safe default.
**Effort:** S
**Priority:** P1 (blocks all E2E testing)
**Depends on:** Nothing
**Added:** 2026-03-18

## ~~P2 (old): Phase 3 — Visualization Gaps~~
**What:** Fix 3 gaps: (1) unified unit layer (new UnifiedUnitLayer component), (2) destruction visualization on arrows, (3) convoy route visualization.
**Why:** Two overlapping unit layers confuse players. War/peace/hostile moves all look the same on the map. Convoy routes invisible.
**Context:**
1. **Unified unit layer**: Create UnifiedUnitLayer that renders circles/triangles in both normal and maneuver modes. Normal: fetch from mapAPI, non-interactive. Maneuver: read from mapInteraction, interactive (click, active/planned/idle states). Delete unit section from MapApp's formatGameMap() and delete old UnitMarkerLayer.
2. **Destruction viz**: Modify MovementArrow to differentiate by action type (red for war, green for peace, orange for hostile). Consumed units not rendered at destination.
3. **Convoy viz**: Add dotted transport lines through sea territories when army crosses via fleet convoy.
**Effort:** L
**Priority:** P2
**Depends on:** Phase 1 + Phase 2
**Added:** 2026-03-18

## Deferred
- **Democracy rejection unit-type vote** — when democracy rejects peace and has both armies+fleets at destination, stockholders should vote on which to sacrifice. Currently auto-picks fleet. Very rare scenario. Spec §5.4.
- **Timer behavior during maneuver** — needs game design decision (auto-submit vs skip)
- **Keyboard navigation** — accessibility, not blocking gameplay
- **Screen reader support** — accessibility, not blocking gameplay
- **Drag-to-reorder** — cosmetic UX, arrow buttons work for now
