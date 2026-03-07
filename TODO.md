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
- [ ] `ContinueManeuverApp.js` is entirely commented out (continue-man mode is a stub)
- [ ] Implement the full continue-maneuver flow for multi-step maneuvers

## Medium Priority

### React Modernization
- [ ] Migrate class components to functional components with hooks
- [ ] Replace `contextType` pattern with `useContext`
- [ ] Remove `eval()` usage in `helper.unstringifyFunctions()` (used for proposal serialization)

### Firebase SDK Upgrade
- [ ] Upgrade from Firebase SDK v8 to v10+ (modular SDK)
- [ ] Use tree-shaking-friendly modular imports
- [ ] Update `firebase.js` initialization

### Build Tooling
- [ ] Upgrade from react-scripts 3.4.3 to current version
- [ ] Upgrade from Node 16 to current LTS
- [ ] Evaluate migration from Create React App to Vite

### Testing
- [ ] Add integration tests for full game flows (create game -> play -> game over)
- [ ] Add tests for UI components (currently only backend files are tested)
- [ ] Add tests for `ManeuverPlannerApp` plan-based logic
- [ ] Add tests for `GameOverApp` scoring edge cases

## Low Priority

### UI/UX Improvements
- [ ] Mobile-responsive layout
- [ ] Animated unit movement on the map
- [ ] Sound effects for key actions (your turn, war declared, etc.)
- [ ] Better game lobby (show player count, game status, last activity)
- [ ] In-game chat between players

### Code Cleanup
- [ ] Remove unused functions in `proposalAPI.js`
- [ ] `stateAPI.getCashValue()` is a stub that always returns 5 -- implement properly
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
