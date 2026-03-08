# Future Improvements

Tracked improvements, technical debt, and feature ideas for Imperial Game.

## High Priority

### Map-Based Maneuvers
- [ ] Move armies/fleets by clicking on the map instead of using dropdowns
- [ ] Visual movement paths and destination highlighting
- [ ] Drag-and-drop unit movement

### Server-Side Validation
- [ ] Move game logic validation to Firebase Cloud Functions
- [ ] Prevent client-side cheating/state manipulation
- [ ] Validate moves, purchases, and proposals server-side

### Continue Maneuver Mode
- [x] ~~`ContinueManeuverApp.js` is entirely commented out~~ (fully implemented)
- [x] ~~Implement the full continue-maneuver flow~~ (done via `ManeuverPlannerApp` + `ContinueManeuverApp`)

## Medium Priority

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

### Testing
- [ ] Add integration tests for full game flows (create game -> play -> game over)
- [x] ~~Add tests for UI components~~ (smoke tests for BidApp, HistoryApp, GameOverApp, ManeuverPlannerApp)
- [x] ~~Add tests for `ManeuverPlannerApp` plan-based logic~~ (9 tests added)
- [x] ~~Add tests for `GameOverApp` scoring edge cases~~ (7 new tests added)

## Low Priority

### UI/UX Improvements
- [ ] Mobile-responsive layout
- [ ] Animated unit movement on the map
- [ ] Sound effects for key actions (your turn, war declared, etc.)
- [ ] Better game lobby (show player count, game status, last activity)
- [ ] In-game chat between players

### Code Cleanup
- [ ] Clean up antd dark theme (currently a large extracted CSS file)
- [ ] Extract magic numbers and strings into `gameConstants.js`

### Infrastructure
- [ ] Add error monitoring (Sentry or similar)
- [ ] Add analytics for game completion rates, popular strategies
- [ ] Rate limiting on Firebase writes
- [ ] Automated backups of game state data

### Game Features
- [ ] Spectator mode (watch games without playing)
- [ ] Game replays (step through history visually on the map)
- [ ] Multiple game board variants
- [ ] AI players for single-player or filling empty slots
- [ ] Tournament/ladder system
- [ ] Undo request system (request undo, other players approve/deny)
