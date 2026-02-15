# Imperial Game

A multiplayer online strategy board game built with React and Firebase Realtime Database.

## Prerequisites

- [Node.js](https://nodejs.org/) v14.x (required by react-scripts 3.4.3)
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

## Project Structure

```
imperialgame/
  firebase.json              # Firebase project configuration
  database.rules.json        # Realtime Database security rules
  firestore.rules            # Firestore security rules
  storage.rules              # Cloud Storage security rules
  functions/                 # Firebase Cloud Functions (currently unused)
  public/client/             # React frontend (Create React App)
    src/                     # Source code
      backendFiles/          # Firebase database API layer
      App.js                 # Root component
      UserContext.js          # React Context for global state
      EnterApp.js            # Game selection screen
      GameApp.js             # Main game interface
      MapApp.js              # Interactive game map
      ...                    # Other game components
    patches/                 # patch-package patches (antd dark theme)
```

## Available Scripts

From `public/client/`:

| Command | Description |
|---------|-------------|
| `npm start` | Start development server |
| `npm run build` | Create production build |
| `npm test` | Run tests |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without changes |

## Firebase

The app uses Firebase Realtime Database for game state and real-time multiplayer updates. Hosting is configured to serve the production build from `public/client/build/`.

### Security Note

Database rules in `database.rules.json` are currently wide open (`read: true, write: true`). Before any public deployment, these must be updated with proper authentication-based rules.

## Known Tech Debt

- All components use class-based React (migration to hooks is a future task)
- antd dark theme is applied via a large patch-package patch
- No CI/CD pipeline
- Minimal test coverage
- Node 14 is required due to react-scripts 3.4.3 compatibility
- Firebase SDK is on v8 (current is v10+)
