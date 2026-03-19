# Maneuver System — Session Handoff

## Key Reference Files
- `docs/game-logic.md` — Rules spec (sections 1-10 under "Maneuver System")
- `docs/maneuver-ui-spec.md` — UI interaction spec (map-first interaction model, plan list, action picker, peace votes, submit state machine, edge cases)
- `TODOS.md` — All completed phases and remaining work
- `CLAUDE.md` — Project overview, tech stack, architecture

## Phased Plan Status

| Phase | What | Status | Tests |
|-------|------|--------|-------|
| Pre | Rules spec rewrite (game-logic.md §1-10) | ✅ Done | — |
| Pre | UI interaction spec (maneuver-ui-spec.md) | ✅ Done | — |
| P0 | Playwright E2E infrastructure | ✅ Done | 5/14 E2E pass |
| P1 | Game logic correctness (8 bugs fixed) | ✅ Done | 675→710 Jest |
| P2 | Peace system + convoy (2/3) | ✅ Done | 710 Jest |
| P2 | Deprecate step-by-step path (-1997 lines) | ✅ Done | — |
| P3 | Visualization (unified layer, destruction viz, convoy) | ✅ Done | — |
| — | Null-safety fixes for E2E | ✅ Done | 5 E2E basics pass |

## What's Next

### Immediate: Get remaining 9 E2E tests passing
5/14 E2E tests pass (the basics suite). The remaining 9 tests across 4 spec files need:
- `maneuver-submit.spec.js` — submit flow tests
- `maneuver-peace.spec.js` — peace action flow
- `maneuver-multi-unit.spec.js` — multi-unit war with virtual state
- `maneuver-war-cascade.spec.js` — cancel/cascade edge cases

These tests may need selector fixes similar to what was done for the basics suite, or may need more game state in the seed data.

### After E2E: Write MORE E2E tests
The UI spec (`docs/maneuver-ui-spec.md`) documents many edge cases that don't have E2E coverage yet:
- §8.1: Unit selection and deselection
- §8.2: Visualization of unit stacking
- §8.3: War vs peace choice during movement
- §8.4: Cancel cascade (war→hostile invalidation)
- §8.5: Fleet removal cascade (convoy invalidation)
- §8.6: Blow-up with army consumption
- §8.7: Multi-unit interactions at same territory

### Deferred Items (from TODOS.md)
- Democracy rejection unit-type vote (rare scenario, auto-picks fleet)
- Timer behavior during maneuver
- Keyboard navigation / screen reader support
- Drag-to-reorder army execution order

## Bugs Fixed This Session
1. Peace vote voter pool — all stockholders, not just leadership
2. Peace votes on neutral/sea territories — not just foreign home
3. Army BFS over-expansion — no recursive getD0 from one-hop territories
4. Coexisting unit rules — war allowed, hostile unblocked, auto-accept peace
5. Virtual state blow-up consumption — forward order, not backward
6. Fleet tax chips on seas — reverted, they're valid
7. Convoy 1:1 cleanup — uses fixed getAdjacentLands
8. Multi-country sequential peace votes

## Code Changes This Session
- **New files:** UnifiedUnitLayer.js, e2e/ test infrastructure
- **Deleted:** ContinueManeuverApp.js, step-by-step functions (-1997 lines)
- **Major edits:** submitAPI.js (peace votes, execution), proposalAPI.js (BFS, action options, virtual state), ManeuverPlanProvider.js (cascade extraction)
- **Null guards:** turnAPI.js, helper.js, mapAPI.js, stateAPI.js
- **Tests:** 666 → 710 Jest, 14 Playwright E2E skeletons (5 passing)
