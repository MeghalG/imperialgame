# Imperial Game

A multiplayer online strategy board game (based on the board game *Imperial*) built with React and Firebase Realtime Database. Players manage countries, buy stocks, make proposals, vote, and maneuver armies/fleets on an interactive map.

## Prerequisites

- [Node.js](https://nodejs.org/) v16 (see `.nvmrc`)
- Use [nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows) to manage Node versions

## Getting Started

```bash
# Switch to the required Node version
nvm use

# Navigate to the client directory
cd public/client

# Copy the environment template and fill in your credentials
cp .env.example .env

# Install dependencies
npm install

# Start the dev server
npm start
```

The app will be available at http://localhost:3000.

## Environment Variables

Configured via `public/client/.env` (copy from `.env.example`):

| Variable | Description |
|----------|-------------|
| `REACT_APP_FIREBASE_API_KEY` | Firebase API key |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `REACT_APP_FIREBASE_DATABASE_URL` | Realtime Database URL |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `REACT_APP_EMAILJS_USER_ID` | EmailJS user ID |
| `REACT_APP_EMAILJS_SERVICE_ID` | EmailJS service (e.g. "gmail") |
| `REACT_APP_EMAILJS_TEMPLATE_ID` | EmailJS template ID |

## Project Structure

```
imperialgame/
  CLAUDE.md                  # AI assistant context file
  firebase.json              # Firebase config (hosting, emulators, rules)
  database.rules.json        # Realtime DB rules (auth-gated)
  .nvmrc                     # Node version (16)
  .github/workflows/ci.yml   # CI/CD pipeline (format, test, build, deploy)
  docs/
    firebase-schema.md       # Complete Firebase data model reference
    game-logic.md            # Game flow, state machine, and rules
  public/client/             # React frontend (Create React App)
    package.json
    verify.sh                # Local pre-push verification script
    src/
      index.js               # Entry point
      App.js                 # Root component
      UserContext.js          # React Context for global game state
      gameConstants.js        # Named constants, enums, and JSDoc typedefs
      antd-dark-theme.css     # Antd dark theme CSS
      EnterApp.js            # Game selection / lobby
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
      PeaceVoteApp.js        # Peace voting
      ManeuverPlannerApp.js  # Maneuver planning UI (fleet/army moves)
      PlayerApp.js           # Player info display
      StateApp.js            # Game state display (country/player cards)
      StaticTurnApp.js       # Read-only turn summary
      GameOverApp.js         # Game over screen
      HistoryApp.js          # Game action history log
      RulesApp.js            # Game rules display
      LoginApp.js            # Login + timer + name entry
      ComponentTemplates.js  # Reusable UI components
      backendFiles/
        firebase.js          # Firebase init
        submitAPI.js         # Core game engine: state mutations and transitions
        turnAPI.js           # Turn metadata: title, mode, whose turn
        buyAPI.js            # Stock buying options
        proposalAPI.js       # Proposal options (wheel actions, movement, import)
        stateAPI.js          # Game state readers (country/player info)
        stateCache.js        # Firebase state caching layer
        mapAPI.js            # Map rendering data (units, factories, tax chips)
        miscAPI.js           # Misc readers (game IDs, money, vote options)
        helper.js            # Shared pure utilities (scoring, tax calc, stock math)
```

## Available Commands

All commands run from `public/client/`:

| Command | Description |
|---------|-------------|
| `npm start` | Start dev server at localhost:3000 |
| `npm run build` | Production build (zero warnings required) |
| `npm test` | Run Jest tests (~590 tests across 10 suites) |
| `npm run format` | Format all source with Prettier |
| `npm run format:check` | Check formatting without writing |
| `bash verify.sh` | Pre-push verification (mirrors CI pipeline) |

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR to `main`:

1. **Format check** - Prettier formatting
2. **Tests** - Jest test suite
3. **Build** - Production build with zero warnings
4. **Deploy** - Firebase Hosting (on push to `main` only)

Always run `bash verify.sh` locally before pushing to catch issues early.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 16.13.1 (class components, Context API) |
| UI Library | Ant Design 4.x with custom dark theme |
| Backend | Firebase Realtime Database (client-side game logic) |
| Auth | Firebase Authentication |
| Email | emailjs-com (turn notifications) |
| Build | Create React App (react-scripts 3.4.3) |
| Tests | Jest |
| CI/CD | GitHub Actions + Firebase Hosting |

## Architecture

All game logic runs client-side. There is no server-side validation.

```
User Action -> Component -> UserContext (setState) -> submitAPI.js
  -> mutate gameState in memory -> finalizeSubmit() -> Firebase write
  -> Firebase listener fires -> component re-renders with new data
```

See `docs/game-logic.md` for the full game state machine and rules, and `docs/firebase-schema.md` for the complete data model.

## Database Rules

Database rules in `database.rules.json` require Firebase Authentication for all reads and writes. Setup/template data is read-only.
