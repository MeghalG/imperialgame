# TODOs

## ~~P1: Rewrite Maneuver Rules Spec~~ ✅ DONE
Completed 2026-03-18. Commits: `4ae4fa7a`, `e4a6a532`. Full 10-section spec now in `docs/game-logic.md`.

## ~~P1: Write Maneuver UI Interaction Spec~~ ✅ DONE
Completed 2026-03-18. Commit: `6a87016f`. Full spec in `docs/maneuver-ui-spec.md`. Covers: map-first interaction model, plan list layout, destination/action selection, peace vote flows, submit state machine, 13 edge cases, mobile/accessibility, 11 implementation gaps identified.

## P0: Playwright E2E Test Infrastructure + Spec-Targeted Tests
**What:** Set up Playwright, write E2E tests targeting the maneuver UI spec (ideal behavior, not current implementation). Tests will initially fail and go green as phases ship.
**Why:** Zero E2E tests exist. The maneuver planner is the most interaction-heavy feature. Jest unit tests can't verify map clicks, highlighting, cascade visualization, or mode transitions. The specific edge cases in the UI spec (cancel cascade, convoy reassignment, multi-unit war) can only be verified with a real browser.
**Context:** Needs: Playwright config, Firebase emulator or mock for test state, page objects for map/plan-list/picker. Target ~15 E2E test scenarios from `docs/maneuver-ui-spec.md` §8 walkthroughs. Tests target SPEC behavior, not current broken implementation.
**Effort:** M-L
**Priority:** P0 (before any gap implementation)
**Depends on:** Nothing.
**Added:** 2026-03-18

## P1: Phase 1 — Game Logic Correctness Gaps
**What:** Fix 3 gaps from `docs/maneuver-ui-spec.md`: (1) hostile rule enforcement, (2) auto-accept coexisting units, (3) cascade warnings + shared cascade function.
**Why:** These are incorrect game behavior. Hostile is offered when it shouldn't be. Peace votes trigger for coexisting units. Cancel cascade leaves invalid actions silently.
**Context:**
1. **Hostile rule** (existing P2 TODO, promoted to P1): Fix `getUnitActionOptionsFromPlans` in proposalAPI.js to check virtual state for enemies before offering hostile. Also fix `getArmyPeaceOptions`.
2. **Auto-accept**: Modify peace trigger check in `submitBatchManeuver` to skip coexisting-only territories (check `hostile` flag on enemy units).
3. **Cascade fix**: Extract `recomputeAllOptions()` from assignMove/removeMove/reorderMove in ManeuverPlanProvider.js. When action becomes invalid, auto-select sensible default (first war if available, otherwise peace). Show inline warning on cascade-cleared rows.
**Effort:** M
**Priority:** P1
**Depends on:** P0 (Playwright tests for regression)
**Added:** 2026-03-18

## P1: Phase 2 — Peace System + Convoy Gaps
**What:** Fix 3 gaps: (1) convoy 1:1 limit with constraint-satisfaction, (2) multi-country peace vote order, (3) democracy rejection unit-type vote.
**Why:** Missing game mechanics. Multiple armies can illegally cross via one fleet. Multi-country peace doesn't trigger correctly. Democracy can't vote on unit type after rejection.
**Context:**
1. **Convoy limit**: Add bipartite matching to `getUnitOptionsFromPlans` — check if ANY valid fleet-to-army assignment exists (not first-come-first-served). Export matching solver as pure function for testing. Both pure function tests AND integration tests.
2. **Multi-country peace**: Modify `submitBatchManeuver` to detect multiple enemy countries at peace destination, trigger sequential votes. Form UI for choosing order (arbitrary default is fine).
3. **Democracy rejection vote**: Modify `submitPeaceVote` to add unit-type selection step after rejection when both armies + fleets present. Add to PeaceVoteApp UI.
**Effort:** M-L
**Priority:** P1
**Depends on:** Phase 1
**Added:** 2026-03-18

## P2: Phase 3 — Visualization Gaps
**What:** Fix 3 gaps: (1) unified unit layer (new UnifiedUnitLayer component), (2) destruction visualization on arrows, (3) convoy route visualization.
**Why:** Two overlapping unit layers confuse players. War/peace/hostile moves all look the same on the map. Convoy routes invisible.
**Context:**
1. **Unified unit layer** (decision: 1C — new component): Create UnifiedUnitLayer that renders circles/triangles in both normal and maneuver modes. Normal: fetch from mapAPI, non-interactive. Maneuver: read from mapInteraction, interactive (click, active/planned/idle states). Delete unit section from MapApp's formatGameMap() and delete old UnitMarkerLayer.
2. **Destruction viz**: Modify MovementArrow to differentiate by action type (red for war, green for peace, orange for hostile). Consumed units not rendered at destination.
3. **Convoy viz**: Add dotted transport lines through sea territories when army crosses via fleet convoy.
**Effort:** L
**Priority:** P2
**Depends on:** Phase 1 + Phase 2
**Added:** 2026-03-18

## P1: Comprehensive Maneuver Test Suite (Jest)
**What:** Write Jest unit tests that verify each rule in the corrected spec. Every rule gets at least one positive and one negative test.
**Why:** Current 666 tests cover basic flows but miss critical edge cases.
**Context:** Priority gaps: hostile enforcement, auto-accept, convoy limit matching, multi-country peace, democracy rejection vote, blow-up consumption, peace 50% threshold. Many of these tests will be written alongside Phase 1/2 implementation. This TODO tracks the comprehensive pass to ensure full coverage.
**Effort:** L
**Priority:** P1 (ongoing, alongside phases)
**Depends on:** Rules spec (done)
**Added:** 2026-03-18

## ~~P2: Deprecate Step-by-Step Maneuver Path~~ ✅ DONE
Completed 2026-03-18. Commit: `08903e55`. Deleted ContinueManeuverApp, submitManeuver, _submitManeuverLocal, getVirtualState, getCurrentUnitOptions, getCurrentUnitActionOptions. Removed army charCode sort. Fixed charCodeAt typo. -1997 lines, 666 tests pass.

## Deferred
- **Timer behavior during maneuver** — needs game design decision (auto-submit vs skip)
- **Keyboard navigation** — accessibility, not blocking gameplay
- **Screen reader support** — accessibility, not blocking gameplay
- **Drag-to-reorder** — cosmetic UX, arrow buttons work for now
