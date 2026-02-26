# Imperial Game - Claude Code Context

## What is this?
A multiplayer online strategy board game (based on the board game "Imperial") built with React and Firebase Realtime Database. Players manage countries, buy stocks, make proposals, vote, and maneuver armies/fleets on a map.

## Tech Stack
- **Frontend:** React 16.13.1 (class components, Context API for state)
- **UI:** Ant Design 4.x with a custom dark theme (`src/antd-dark-theme.css`)
- **Backend:** Firebase Realtime Database (no server -- all game logic runs client-side)
- **Auth:** Firebase Authentication
- **Email:** emailjs-com for turn notifications
- **Build:** Create React App (react-scripts 3.4.3)
- **Node:** Requires Node 16 (see `.nvmrc`). Use `nvm use` before running commands.
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) - format check, test, build

## Project Layout
```
imperialgame/
  CLAUDE.md                  # This file
  firebase.json              # Firebase config (hosting, emulators, rules)
  database.rules.json        # Realtime DB rules (auth-gated)
  .nvmrc                     # Node version (16)
  docs/
    firebase-schema.md       # Complete Firebase data model reference
    game-logic.md            # Game flow, state machine, and rules documentation
  public/client/             # React app root (run all npm commands here)
    package.json
    .env                     # Local env vars (gitignored)
    .env.example             # Template for .env
    .prettierrc              # Prettier config
    src/
      index.js               # Entry point
      App.js                 # Root component, wraps everything in UserContext
      UserContext.js          # React Context -- global game state shape
      gameConstants.js        # Named constants, enums, and JSDoc typedefs
      antd-dark-theme.css     # Extracted antd dark theme CSS
      EnterApp.js            # Game selection / lobby screen
      GameApp.js             # Main game container (tabs: game, history, rules)
      MainApp.js             # Game layout (map + player info + turn controls)
      MapApp.js              # Interactive game map with zoom/pan
      TurnApp.js             # Turn router (delegates to mode-specific components)
      BidApp.js              # Bidding on stocks
      BuyApp.js              # Buying stocks
      BuyBidApp.js           # Buy-or-pass after bidding
      ProposalApp.js         # Making proposals (leader)
      ProposalAppOpp.js      # Counter-proposals (opposition)
      VoteApp.js             # Voting on proposals
      PlayerApp.js           # Player info display
      StateApp.js            # Game state display (country/player cards)
      StaticTurnApp.js       # Read-only turn summary
      HistoryApp.js          # Game action history log
      RulesApp.js            # Game rules display
      LoginApp.js            # Login + timer + name entry
      ComponentTemplates.js  # Reusable UI components (ActionComponent, OptionComponent, RadioComponent)
      ContinueManeuverApp.js # Multi-step maneuver continuation (commented out)
      backendFiles/
        firebase.js          # Firebase init (reads from process.env)
        submitAPI.js         # Core game engine: turn submission, state transitions, all game logic
        turnAPI.js           # Turn metadata: title, mode, turnID, whose turn
        buyAPI.js            # Stock buying options (country, stock, return stock)
        proposalAPI.js       # Proposal options (wheel, produce, maneuver, import, fleet/army movement)
        stateAPI.js          # Game state readers (countryInfo, playerInfo)
        mapAPI.js            # Map rendering data (units, factories, tax chips, rondel positions)
        miscAPI.js           # Misc readers (game IDs, money, country, bid, vote options)
        helper.js            # Shared pure-ish utilities (stock math, tax calc, scoring, stringify)
        helper.test.js       # 59 tests for helper.js
      App.test.js            # 2 smoke tests for App.js
  functions/                 # Firebase Cloud Functions (empty skeleton, unused)
```

## Key Commands
All commands run from `public/client/`:
```bash
npm start             # Dev server at localhost:3000
npm run build         # Production build to build/ (zero warnings)
npm test              # Jest tests (61 tests across 2 suites)
npm run format        # Format all source with Prettier
npm run format:check  # Check formatting without writing
```

## Environment Variables
Configured via `public/client/.env` (copy from `.env.example`):
- `REACT_APP_FIREBASE_API_KEY` - Firebase API key
- `REACT_APP_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `REACT_APP_FIREBASE_DATABASE_URL` - Realtime Database URL
- `REACT_APP_FIREBASE_STORAGE_BUCKET` - Storage bucket
- `REACT_APP_EMAILJS_USER_ID` - EmailJS user ID
- `REACT_APP_EMAILJS_SERVICE_ID` - EmailJS service (e.g. "gmail")
- `REACT_APP_EMAILJS_TEMPLATE_ID` - EmailJS template ID

## Documentation

- **`docs/firebase-schema.md`** - Complete Firebase Realtime Database schema. Every path, field, type, and when it appears. Start here to understand the data model.
- **`docs/game-logic.md`** - Game flow, state machine diagram, wheel actions, scoring, maneuver system, swiss banking, timer, undo. Start here to understand game rules.
- **`src/gameConstants.js`** - Named constants (MODES, WHEEL_ACTIONS, GOV_TYPES, MANEUVER_ACTIONS) and JSDoc `@typedef` blocks for all data shapes (GameState, PlayerInfo, CountryInfo, StockEntry, ManeuverTuple, etc.).

## Architecture

### Data Flow

```
User Action → Component → UserContext (setState) → submit*() in submitAPI.js
  → mutate gameState in memory → finalizeSubmit() → Firebase write
  → Firebase listener fires → component re-renders with new data
```

1. **User interacts** with a mode-specific component (BidApp, ProposalApp, etc.)
2. **Component updates** UserContext values via setState callbacks (e.g. `setWheelSpot`, `setBuyCountry`)
3. **User clicks Submit** → component calls a `submit*()` function from `submitAPI.js` passing the full context
4. **submitAPI function** reads current state from Firebase, mutates it in memory, then calls `finalizeSubmit()`
5. **finalizeSubmit** saves old state to history, writes new state to Firebase, increments turnID, sends emails
6. **Firebase listener** on `turnID` fires in components → components re-fetch their data → re-render

### Component Architecture

All components are React class components using `contextType = UserContext`.

**Mode Components** (one per game mode, rendered by TurnApp):
- `BidApp` → mode `bid`
- `BuyBidApp` → mode `buy-bid`
- `BuyApp` → mode `buy`
- `ProposalApp` → mode `proposal`
- `ProposalAppOpp` → mode `proposal-opp`
- `VoteApp` → mode `vote`

Each mode component:
1. In `componentDidMount`: fetches options from the relevant API file (buyAPI, proposalAPI, etc.)
2. Renders form controls using `ComponentTemplates.js` (ActionComponent, OptionComponent, RadioComponent)
3. Has a Submit button that calls the corresponding `submit*()` function from submitAPI.js

**ComponentTemplates.js Pattern:**
- `ActionComponent` — Container with a "Submit" button. Has a `trigger` prop: a function that gets called when Submit is clicked. Child components register their values through context.
- `OptionComponent` — Select dropdown that writes its value to UserContext via a setter.
- `RadioComponent` — Radio group that writes its value to UserContext via a setter.

### The Stringification Pattern

In democracy mode, proposals must be stored in Firebase across turns (leader proposes → opposition proposes → vote). But the context object contains React setState function references that can't be serialized to JSON.

Solution: `helper.stringifyFunctions()` converts any context key starting with `"set"` or `"reset"` to its `.toString()` representation. `helper.unstringifyFunctions()` uses `eval()` to restore them. This is stored in `gameState['proposal 1']` and `gameState['proposal 2']`.

### Backend Files Responsibility

| File | Role | Key Functions |
|------|------|---------------|
| `submitAPI.js` | **Game engine** — all state mutations and mode transitions | `submitBuy`, `submitVote`, `submitProposal`, `bid`, `bidBuy`, `executeProposal`, `newGame`, `undo` |
| `proposalAPI.js` | **Proposal options** — what actions/targets are available | `getWheelOptions`, `getFleetOptions`, `getArmyOptions`, `getImportOptions` |
| `buyAPI.js` | **Buy options** — which stocks can be bought/returned | `getCountryOptions`, `getStockOptions`, `getReturnStockOptions` |
| `turnAPI.js` | **Turn metadata** — title, mode, whose turn | `getTitle`, `getMode`, `getTurnID`, `undoable` |
| `mapAPI.js` | **Map rendering** — unit positions, factories, tax chips | `getUnits`, `getSeaFactories`, `getLandFactories`, `getTaxChips` |
| `stateAPI.js` | **State readers** — raw country/player info | `getCountryInfo`, `getPlayerInfo` |
| `miscAPI.js` | **Misc readers** — game IDs, money, bid, vote options | `getGameIDs`, `getVoteOptions`, `getGameState` |
| `helper.js` | **Pure utilities** — scoring, tax calc, stock math | `computeScore`, `getTaxInfo`, `getOwnedStock`, `getPermSwiss` |

## How To: Add a New Wheel Action

1. Add the action name to `WHEEL_ACTIONS` in `gameConstants.js`
2. Add a `case` in `submitAPI.js` → `executeProposal()` switch to implement the game logic
3. Add a `case` in `submitAPI.js` → `makeHistory()` switch to generate the history string
4. Add option-fetching functions in `proposalAPI.js` (what choices the player has)
5. Add UI in `ProposalApp.js` to render the new action's form controls
6. Update the wheel array in the Firebase setup config (`setups/{name}/wheel`)
7. Update `docs/game-logic.md` with the new action's rules

## How To: Add a New Game Mode

1. Add the mode string to `MODES` in `gameConstants.js`
2. Add a `case` in `TurnApp.js` → `DisplayMode` switch to render the new component
3. Create a new `{Mode}App.js` component (class component, `contextType = UserContext`)
4. Add a `submit{Mode}()` function in `submitAPI.js` that reads state, mutates it, and calls `finalizeSubmit()`
5. Add a `case` in `turnAPI.js` → `getTitle()` switch for the title bar text
6. Set `gameState.mode` to the new mode at the appropriate transition point in submitAPI.js
7. Update `docs/game-logic.md` with the new mode's flow

## How To: Add Tests

Tests use Jest (via react-scripts). Mock Firebase with the pattern from `helper.test.js`:

```js
// Mock Firebase before importing the module under test
jest.mock('./firebase.js', () => ({
  database: {
    ref: jest.fn(() => ({
      once: jest.fn(() => Promise.resolve({ val: () => mockData })),
      on: jest.fn(),
      off: jest.fn(),
      set: jest.fn(),
    })),
  },
}));
```

For pure functions (no Firebase): test directly with mock data objects.
For async functions (with Firebase): mock `database.ref().once()` to return test data.

Run: `npm test -- --watchAll=false --ci`

## Known Issues / Tech Debt
- All components are class-based React (no hooks)
- `ContinueManeuverApp.js` is entirely commented out (continue-man mode is a stub)
- No server-side game logic validation (all logic runs in browser)
- Firebase SDK is v8 (current is v10+)
- `proposalAPI.js` has several unused functions
- `stateAPI.getCashValue()` is a stub that always returns 5
