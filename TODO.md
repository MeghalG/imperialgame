# Future Improvements

Tracked improvements, technical debt, and feature ideas for Imperial Game.

Vision: Build Imperial Game into the definitive way to play Imperial online — a community platform with server-validated moves, spectating, and growth features.

## Phase 1: Server Migration & Foundations (High Priority)

### Cloud Functions Migration
- [x] ~~Split `submitAPI.js` into focused modules~~ (submitBid.js, submitBuy.js, submitProposal.js, submitManeuver.js, submitHelpers.js in functions/logic/)
- [x] ~~Move all game logic to Firebase Cloud Functions with server-only writes~~ (5 Cloud Functions deployed, client calls CFs via httpsCallable, database rules locked down)
- [x] ~~Validate all moves server-side~~ (functions/validation.js — bids, stock purchases, proposals, maneuvers)
- [ ] Implement bid secrecy: server collects bids in a write-only collection, reveals them all at once when the last bid arrives. Required for competitive integrity. *(Deferred from CF migration — separate PR after CFs are stable. See `docs/cloud-functions-migration-plan.md`.)*
- [ ] Use Firebase transactions for turn submissions to prevent race conditions (concurrent vote merging, undo collision detection).

### E2E Tests
- [ ] Add Playwright E2E tests: login, create game, play through bid round, submit a proposal, verify board state. Establish baseline before CF migration to verify server produces identical results to client.

### CI/CD Auto-Deploy
- [x] ~~Add Firebase deploy to GitHub Actions~~ (CI workflow updated with CF deploy step)

### Bug Fixes
- [x] ~~Fix `newGame()` shared `templatePlayer` reference~~ (deep clone in functions/logic/gameAdmin.js)
- [ ] Fix `newGame()` `startingMoney` operator precedence: `parseFloat(61.0 / count.toFixed(2))` should be `parseFloat((61.0 / count).toFixed(2))`.
- [ ] Fix `helper.getStockBelow()` — may return stocks that are already purchased (annotated with `@bug`).
- [ ] `submitAPI.js:1290-1291` — `taxInfo.money` is raw floating point, producing history entries like `"$-0.04999999999999982 into its treasury"`. Round to 2 decimal places before interpolation. Also seen: `"$0 into its treasury"` (should show `$0.00` or be omitted).
- [ ] `submitAPI.js:1320-1323` — Units that stay in place show "Denmark to Denmark" which reads like a bug. Units moving to the same destination from different origins show as separate entries ("Berlin to Holland, Berlin to Holland") rather than being combined. Improve by: (a) showing "stays in Denmark" for self-movements, and (b) grouping by destination.

### Resilience
- [ ] Add React Error Boundary wrapping the main app — catches component crashes and shows "Something went wrong — click to reload" instead of a white screen.
- [ ] `MapApp.js:41-56` — `mapWidth` state has no fallback if `ResizeObserver` doesn't fire. Add an immediate `el.clientWidth` measurement on mount before relying on the observer.

### Map-Based Maneuvers
- [x] ~~Move armies/fleets by clicking on the map instead of using dropdowns~~ (TerritoryHotspot + MapInteractionContext + ManeuverPlannerApp)
- [x] ~~Visual movement paths and destination highlighting~~ (MovementArrowLayer with SVG arrows, TerritoryBoundaryLayer highlighting)
- [ ] Drag-and-drop unit movement

### Accessibility
- [ ] Several topbar icon buttons (pause, low-vision, collapse) have no `aria-label` or `title`, making them inaccessible to screen readers and showing no hover tooltip for sighted users.

### Continue Maneuver Mode
- [x] ~~`ContinueManeuverApp.js` is entirely commented out~~ (fully implemented)
- [x] ~~Implement the full continue-maneuver flow~~ (done via `ManeuverPlannerApp` + `ContinueManeuverApp`)

## Phase 2: Discovery & Retention (Medium Priority)

### Spectator Mode
- [ ] Let users watch games in progress without participating. The architecture already supports this — read-only Firebase listeners on game state, map renders from state, floating panels show player info. Main work: (1) 'Spectate' entry point in lobby, (2) hide action UI for spectators, (3) spectator count indicator.

### Lobby Enhancements
- [ ] Rich game status in lobby: 'Your turn!', 'Waiting for Alice', 'Game over — you won!', time-since-last-move.
- [ ] Browser push notifications for 'Your turn' via Notification API (instant, in addition to email).

### Testing
- [ ] Add integration tests for full game flows (create game -> play -> game over)
- [ ] Expand component tests beyond smoke tests — add interaction tests for ProposalApp (wheel selection → action options → submit), VoteApp (vote casting → tally), BuyApp (country selection → stock selection → purchase), and ContinueManeuverApp (step-by-step unit movement flow)
- [x] ~~Add tests for UI components~~ (smoke tests for BidApp, HistoryApp, GameOverApp, ManeuverPlannerApp)
- [x] ~~Add tests for `ManeuverPlannerApp` plan-based logic~~ (9 tests added)
- [x] ~~Add tests for `GameOverApp` scoring edge cases~~ (7 new tests added)

### Code Cleanup
- [ ] Extract shared `useTurnListener` hook — the `database.ref(games/+game+/turnID).on('value', callback)` pattern with cleanup is duplicated across ~6 components
- [ ] Clean up antd dark theme (currently a large extracted CSS file)
- [ ] Extract magic numbers and strings into `gameConstants.js`

### UI/UX Improvements
- [ ] Mobile-responsive layout
- [ ] Animated unit movement on the map
- [x] ~~Sound effects for key actions (your turn, war declared, etc.)~~ (SoundManager.js with Web Audio API synthesized sounds)
- [x] ~~Better game lobby (show player count, game status, last activity)~~ (EnterApp.js redesigned with atmospheric dark cartography theme)

## Completed

### React Modernization
- [x] ~~Migrate class components to functional components with hooks~~ (all 28 class components converted)
- [x] ~~Replace `contextType` pattern with `useContext`~~ (all components use `useContext`)
- [x] ~~Remove `eval()` usage in `helper.unstringifyFunctions()`~~ (replaced with no-op stubs)

### Firebase SDK Upgrade
- [x] ~~Upgrade from Firebase SDK v8 to v10+ (modular SDK)~~ (upgraded to v11, modular API with v8-compat wrapper)
- [x] ~~Use tree-shaking-friendly modular imports~~ (firebase.js uses modular imports internally)
- [x] ~~Update `firebase.js` initialization~~ (rewritten with v10+ modular API)

### Build Tooling
- [x] ~~Upgrade from react-scripts 3.4.3 to current version~~ (upgraded to react-scripts 5.0.1, webpack 5)
- [x] ~~Upgrade from Node 16 to current LTS~~ (upgraded to Node 20)
- [x] ~~Evaluate migration from Create React App to Vite~~ (decided to skip: Vite requires Jest→Vitest migration of all 12 test suites, low ROI)

## Future Vision (Low Priority)

### Infrastructure
- [ ] Add error monitoring (Sentry or similar)
- [ ] Add analytics for game completion rates, popular strategies
- [ ] Rate limiting on Firebase writes
- [ ] Automated backups of game state data

### Game Features
- [ ] Game replays (step through history visually on the map)
- [ ] In-game chat between players
- [ ] Multiple game board variants
- [ ] AI players for single-player or filling empty slots
- [ ] Matchmaking ("Play now" button that pairs available players)
- [ ] ELO rankings + leaderboard
- [ ] Tournament/ladder system
- [ ] Undo request system (request undo, other players approve/deny)
