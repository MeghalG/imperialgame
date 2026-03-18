# TODOs

## ~~P1: Rewrite Maneuver Rules Spec~~ ✅ DONE
Completed 2026-03-18. Commits: `4ae4fa7a`, `e4a6a532`. Full 10-section spec now in `docs/game-logic.md`.

## P1: Write Maneuver UI Interaction Spec
**What:** Document what the player sees at each step of the maneuver planner UI.
**Why:** The UI must enforce the rules (e.g., hostile only after enemies cleared in plan). Without a spec, the UI and code will drift apart.
**Context:** Should cover: what options appear for each unit, when actions become available/unavailable, how peace vote interruptions work, how remaining plans are pre-populated after a peace vote, and validation rules before submit is enabled. Must account for: batch planning (current primary path), peace vote interruption/resumption, dictatorship vs. democracy peace handling.
**Effort:** M
**Priority:** P1 (after rules spec)
**Depends on:** Rewrite Maneuver Rules Spec
**Added:** 2026-03-18

## P1: Comprehensive Maneuver Test Suite
**What:** Write tests that verify each rule in the corrected spec. Every rule gets at least one positive and one negative test.
**Why:** Current 165 maneuver tests cover basic flows but miss critical edge cases.
**Context:** Priority gaps identified in CEO review:
1. Hostile only available after enemies cleared (rule currently not enforced in code)
2. Hostile units can't be peaced (rule currently not enforced)
3. Peace vote exact 50% threshold behavior
4. Multiple peace votes in same batch plan
5. Batch resumption re-validation after peace rejection
6. War with multiple same-type enemies at same territory
7. Blow-up consumption when fewer than 3 armies available
8. Fleet hostility always true — verify this is correct behavior
**Effort:** L
**Priority:** P1 (after rules spec)
**Depends on:** Rewrite Maneuver Rules Spec
**Added:** 2026-03-18

## P2: Deprecate Step-by-Step Maneuver Path
**What:** Remove `_submitManeuverLocal`, `submitManeuver`, `ContinueManeuverApp`, `getCurrentUnitActionOptions`, and ~30 step-by-step tests. Also: remove army execution sort in `executeProposal()` (line 1649) and fix `charCodeAt(1)` typo in `makeHistory()` (line 1457). Add 1 new test verifying player-chosen execution order.
**Why:** Two parallel code paths with duplicated peace detection logic. ContinueManeuverApp is already dead code (zero imports). Army sort contradicts new spec ("player-chosen order"). Batch path is the primary UI.
**Context:** Eng review (2026-03-18) confirmed: ContinueManeuverApp has zero imports. submitManeuver only called by it. getCurrentUnitActionOptions only called by it. All ~30 step-by-step test behaviors already covered by batch tests. Sort removal is safe because UI constrains ordering.
**Effort:** S (mostly deletion)
**Priority:** P2 (after spec, before UI)
**Depends on:** ~~Rewrite Maneuver Rules Spec~~ ✅
**Added:** 2026-03-18

## P2: Fix getArmyPeaceOptions — Hostile Rule Enforcement
**What:** Only offer "hostile" action when no enemy units remain at that territory (accounting for other units' war actions in the current plan).
**Why:** Current code offers hostile regardless of enemy presence. Per game rules, you cannot be hostile at a territory with enemy units — must war them first.
**Context:** Fix in `proposalAPI.js` `getArmyPeaceOptions()` (line ~549). Need to check virtual state (accounting for war actions in fleetMan and armyMan) before offering hostile. Also need equivalent fix in `getUnitActionOptionsFromPlans`. (`getCurrentUnitActionOptions` will be deleted with step-by-step path.)
**Effort:** S
**Priority:** P2 (after spec confirms rule)
**Depends on:** Rewrite Maneuver Rules Spec
**Added:** 2026-03-18

## P3: Drag-to-Reorder in Plan List
**What:** Replace up/down arrow buttons with drag handles and drag-to-reorder behavior in ManeuverPlanList.
**Why:** More intuitive UX for reordering unit moves, especially on mobile (long-press + drag).
**Context:** Currently uses `ArrowUpOutlined`/`ArrowDownOutlined` buttons. Would need a drag library (react-beautiful-dnd, @dnd-kit/sortable). The codebase doesn't currently use any drag libraries.
**Depends on:** Maneuver redesign integration complete.
**Added:** 2026-03-17
