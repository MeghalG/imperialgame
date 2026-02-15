# Imperial Game - Claude Code Context

## What is this?
A multiplayer online strategy board game (based on the board game "Imperial") built with React and Firebase Realtime Database. Players manage countries, buy stocks, make proposals, vote, and maneuver armies/fleets on a map.

## Tech Stack
- **Frontend:** React 16.13.1 (class components, Context API for state)
- **UI:** Ant Design 4.x with a custom dark theme (applied via patch-package)
- **Backend:** Firebase Realtime Database (no server -- all game logic runs client-side)
- **Auth:** Firebase Authentication
- **Email:** emailjs-com for turn notifications
- **Build:** Create React App (react-scripts 3.4.3)
- **Node:** Requires Node 16 (see `.nvmrc`). Use `nvm use` before running commands.

## Project Layout
```
imperialgame/
  CLAUDE.md                  # This file
  firebase.json              # Firebase config (hosting, emulators, rules)
  database.rules.json        # Realtime DB rules (WIDE OPEN - needs fixing)
  .nvmrc                     # Node version (16)
  public/client/             # React app root (run all npm commands here)
    package.json
    .env                     # Local env vars (gitignored)
    .env.example             # Template for .env
    .prettierrc              # Prettier config
    patches/                 # patch-package patches (antd dark theme)
    src/
      index.js               # Entry point
      App.js                 # Root component, wraps everything in UserContext
      UserContext.js          # React Context -- global game state shape
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
      LoginApp.js            # Login + game setup
      ComponentTemplates.js  # Reusable UI components (radio, checkbox, select, etc.)
      ContinueManeuverApp.js # Multi-step maneuver continuation (commented out)
      backendFiles/
        firebase.js          # Firebase init (reads from process.env)
        submitAPI.js          # Turn submission + email notifications + game logic
        turnAPI.js           # Turn setup/validation helpers
        buyAPI.js            # Stock buying logic
        proposalAPI.js       # Proposal creation + territory/army/fleet logic
        stateAPI.js          # Game state reading helpers
        mapAPI.js            # Map data + territory adjacency logic
        miscAPI.js           # Misc helpers (country lists, stock info)
        helper.js            # Shared utilities (stock sorting, tax calc, etc.)
  functions/                 # Firebase Cloud Functions (empty skeleton, unused)
```

## Key Commands
All commands run from `public/client/`:
```bash
npm start          # Dev server at localhost:3000
npm run build      # Production build to build/
npm test           # Jest tests (currently 1 placeholder test)
npm run format     # Format all source with Prettier
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

## Game Flow
The game mode is stored in `gameState.mode`. The `TurnApp` component routes to the right UI:
1. `bid` - Players bid on stocks for the current country
2. `buy-bid` - Highest bidder decides to buy or pass
3. `buy` - Investor card triggers stock buying round
4. `proposal` - Country leader makes a proposal (wheel action)
5. `proposal-opp` - Opposition leader counter-proposes
6. `vote` - Stockholders vote on proposals
7. `continue-man` - Multi-step maneuver (not fully implemented)
8. `game-over` - A country reached 25 points

Wheel actions: Investor, L-Produce, R-Produce, Taxation, Factory, Import, L-Maneuver, R-Maneuver.

## Architecture Notes
- All game state lives in Firebase Realtime Database under `games/{gameID}`
- Game history is stored under `game histories/{gameID}/{turnID}`
- Game logic (state transitions) runs entirely in the browser in `submitAPI.js`
- There is no server-side validation -- database rules are wide open
- `UserContext` provides global state (game ID, player name, game state) to all components
- The antd dark theme is a 40MB patch file -- consider extracting the CSS file directly in the future

## Known Issues / Tech Debt
- All components are class-based React (no hooks)
- `==` used instead of `===` throughout (many ESLint warnings)
- `console.log` calls scattered in submitAPI.js
- `ContinueManeuverApp.js` is entirely commented out
- `proposalAPI.js` has several unused functions (`legalFleetMove`, `allFleetsNoPeace`, etc.)
- No server-side game logic validation
- Firebase SDK is v8 (current is v10+)
- `database.rules.json` allows unrestricted read/write
- Minimal test coverage (1 placeholder test)
- The 40MB antd patch bloats the git history
