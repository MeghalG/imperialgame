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

## ~~P1: E2E Test Infrastructure — Fix App Null Safety + Selectors~~ ✅ DONE
Completed 2026-03-18. **13/14 E2E passing, 1 fixme** (fleet convoy cascade — `recomputeAllOptions` doesn't invalidate army destinations when fleet providing convoy is removed). Null guards: `helper.getPlayersInOrder`, `helper.getTimer`, `helper.computeScore`, `mapAPI.getRondel`, `mapAPI.getUnits`. Selector fixes: `data-territory` on boundary polygons, `.imp-boundary--selectable` + `.imp-hotspot--selectable` for territory queries, `.imp-movement-arrow` for arrows, `.imp-action-picker` for action picker, `.imp-submit-fab` for submit button, `.anticon-check-circle` / `.anticon-close` for row interactions, `dispatchEvent('click')` for SVG polygons behind map image. Test fixes: unreachable territories (Rome→Budapest), correct action labels ("Declare war on...", "Enter peacefully", "Enter as hostile occupier"), explicit unit marker clicks instead of auto-advance. 710 Jest tests.

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

## ~~P2: Consolidate turnID Firebase Listeners~~ → Superseded
Superseded by "Local State Store + Bulletproof Turn Flow" design (2026-04-06). The new design replaces all 9 Firebase listeners with a local state store + single Firebase sync listener. See `~/.gstack/projects/MeghalG-imperialgame/aok-main-design-20260406-155200.md`.

## P1: Firebase Auth Token Expiry Handling
**What:** Detect and handle Firebase auth token expiry during gameplay. Tokens expire after ~1 hour. A long game session silently loses the Firebase connection.
**Why:** Silent failure. Players in a long game will see the UI freeze with no error message. Identified as CRITICAL GAP in CEO review.
**Context:** Firebase Auth tokens auto-refresh in most cases, but the Realtime Database listener may silently stop receiving updates if the token refresh fails (network blip during refresh window). Need to: (1) detect when the onValue listener stops firing (heartbeat check), (2) detect auth state changes via `firebase.auth().onAuthStateChanged()`, (3) re-authenticate or prompt the user.
**Effort:** S (human: ~2 hours / CC: ~15 min)
**Priority:** P1
**Depends on:** None
**Added:** 2026-04-07

## Deferred
- **Democracy rejection unit-type vote** — when democracy rejects peace and has both armies+fleets at destination, stockholders should vote on which to sacrifice. Currently auto-picks fleet. Very rare scenario. Spec §5.4.
- **Timer behavior during maneuver** — needs game design decision (auto-submit vs skip)
- **Keyboard navigation** — accessibility, not blocking gameplay
- **Screen reader support** — accessibility, not blocking gameplay
- **Drag-to-reorder** — cosmetic UX, arrow buttons work for now
- **Territory hover infrastructure (TerritoryHoverLayer)** — Build hover detection for map territories. `hoverSignal.js` already tracks mouse position; need a component that does point-in-polygon hit testing against territory boundaries and fires hover callbacks. Enables: factory build preview icon on hover, unit info tooltips, territory name tooltips. ~150 lines. Depends on map interaction for Factory/Produce/Import being complete. P3.
