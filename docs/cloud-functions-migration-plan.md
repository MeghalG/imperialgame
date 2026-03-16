# Cloud Functions Migration Plan

> Reviewed by /plan-eng-review on 2026-03-16. All decisions resolved interactively.

## Goal

Move all game logic from client-side to Firebase Cloud Functions so that:
1. Clients cannot cheat (server validates every move)
2. Database rules lock down to server-only writes
3. UI stays snappy via optimistic updates

## Architecture Overview

```
  REACT CLIENT                              CLOUD FUNCTIONS (v2 onCall)
  ┌──────────────────────┐                 ┌──────────────────────┐
  │ Mode Components       │                 │ index.js             │
  │ (BuyApp, VoteApp...) │                 │   onCall entry points│
  │         │             │                 │   auth (auto)        │
  │         ▼             │                 │   route by type      │
  │ submitAPI.js          │                 │         │            │
  │  1. Run logic locally │  httpsCallable  │         ▼            │
  │  2. Optimistic UI     │────────────────▶│ validation.js (NEW)  │
  │  3. Cache + disable   │                 │   turn check         │
  │     submit btn        │                 │   move legality      │
  │  4. Await CF response │                 │         │            │
  │     ├─ ok → re-enable │◀──── response ──│         ▼            │
  │     └─ err → revert + │  (new state)    │ submitLogic.js       │
  │          toast error  │                 │   (pure game logic)  │
  │                       │                 │   submitBuy()        │
  │ helper.js ◄───────────┤─── predeploy ──▶│   submitVote()       │
  │ gameConstants.js      │     copy        │   executeProposal()  │
  │                       │                 │   ...etc             │
  │ stateCache.js         │                 │         │            │
  │  (optimistic cache)   │                 │         ▼            │
  └───────────┬───────────┘                 │ submitHelpers.js     │
              │                             │   finalizeSubmit()   │
              │ listen                      │   ├─ round money     │
              │ turnID                      │   ├─ EmailJS REST    │
              ▼                             │   ├─ timer adjust    │
  ┌──────────────────────┐                 │   ├─ archive old     │
  │ Firebase RTDB         │◀─ admin SDK ───│   └─ write + error   │
  │                       │    writes      │      propagation     │
  │ games/     .write:    │    (txns for   │                      │
  │            false      │     vote/undo) │ helper.js (copied)   │
  │ histories/ .write:    │                │ gameConstants (copy)  │
  │            false      │                │                      │
  │ template   read-only  │                │ email.js (REST)      │
  │ setups/    read-only  │                │ db.js (admin SDK)    │
  └──────────────────────┘                 └──────────────────────┘

  CI/CD: GitHub Actions → format + test + build + firebase deploy
```

## Key Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | CF invocation style | v2 Callable (`onCall`) | Auto auth, better cold starts, Cloud Run backend |
| 2 | CF granularity | 4-5 grouped CFs matching module split | Natural alignment with file split |
| 3 | Shared code strategy | Predeploy copy script | One source of truth in client, copied to functions/ |
| 4 | Phase A (shadow mode) | Skip — go straight to CF | Trust unit tests (170 existing) |
| 5 | Email transport | EmailJS REST API from CF | Same service/templates, different transport |
| 6 | Client API surface | Optimistic update (keep logic + call CF) | Instant UI, CF confirms/corrects |
| 7 | Database rules | Full lockdown (`.write: false`) | All writes through CFs only |
| 8 | CF parameters | Minimal choices only | Server reads authoritative state from Firebase |
| 9 | Peace vote DRY | Extract `triggerPeaceVote()` helper | 3x duplication → 1 helper |
| 10 | Known bugs | Fix templatePlayer + getStockBelow during migration | Already touching that code |
| 11 | Test reuse | Separate logic from Firebase layer | 170 tests preserved, pure functions |
| 12 | Optimistic mismatch | Listener auto-corrects + submit blocked until CF confirms | Self-healing + no double-submits |
| 13 | Write errors | Error propagation in server finalizeSubmit | Critical gap fixed |
| 14 | Transactions | Add for submitVote and undo | Concurrent vote safety |
| 15 | Error UI | Client-side toast for CF errors | Clear feedback on rejected moves |
| 16 | CI deploy | Add CF deploy to GitHub Actions | Prevent manual deployment drift |

## Deployment Phases

```
Phase B: Deploy CFs, client calls CFs, rules unchanged
  ├── Client runs logic locally (optimistic UI)
  ├── Client also calls CF (authoritative computation)
  ├── CF writes to Firebase
  ├── Old client-side writes still allowed by rules (safety net)
  └── Monitor for mismatches between client and CF

Phase C: Lock down Firebase rules
  ├── games/ → .write: false
  ├── game histories/ → .write: false
  ├── Remove client-side Firebase write code from submitAPI.js
  └── Admin SDK (CF) bypasses rules, still writes freely
```

Phase B is the soft launch: if CFs break, clients can theoretically still write
(rules haven't changed). Phase C is the hard cutover.

---

## Implementation Steps

### Step 1: Split submitAPI.js into modules

Split the 2034-line `submitAPI.js` into focused server-side modules.
This is done in `functions/` directly (not in `public/client/src/`).
The client-side `submitAPI.js` stays intact for optimistic updates.

**New file structure in `functions/`:**

```
functions/
  package.json              ← NEW: firebase-functions v2, firebase-admin, node-fetch
  index.js                  ← NEW: CF entry points (5 onCall functions)
  validation.js             ← NEW: turn + move validation rules
  email.js                  ← NEW: EmailJS REST wrapper
  db.js                     ← NEW: Firebase admin read/write wrapper
  logic/
    submitBuy.js            ← EXTRACTED: submitBuy, buyStock, returnStock
    submitProposal.js       ← EXTRACTED: submitProposal, submitVote, submitNoCounter,
                               executeProposal, makeHistory
    submitBid.js            ← EXTRACTED: bid, bidBuy, doneBuying, setBidBuyOrder,
                               setNextBuyer, shuffle
    submitManeuver.js       ← EXTRACTED: submitManeuver, submitBatchManeuver,
                               enterManeuver, completeManeuver, triggerPeaceVote (NEW)
    submitPeace.js          ← EXTRACTED: submitPeaceVote, submitDictatorPeaceVote
    submitHelpers.js        ← EXTRACTED: finalizeSubmit (server version),
                               adjustTime, incrementCountry, changeLeadership
    gameAdmin.js            ← EXTRACTED: newGame, undo
  shared/                   ← AUTO-COPIED by predeploy script
    helper.js
    gameConstants.js
  __tests__/
    validation.test.js      ← NEW: auth, turn, move validation tests
    submitBuy.test.js       ← ADAPTED from existing submitAPI.test.js
    submitProposal.test.js  ← ADAPTED
    submitBid.test.js       ← ADAPTED
    submitManeuver.test.js  ← ADAPTED
    submitPeace.test.js     ← ADAPTED
    gameAdmin.test.js       ← ADAPTED
    triggerPeaceVote.test.js ← NEW: extracted helper tests
```

**Key refactoring during split:**

Each game logic function becomes pure (gameState in → gameState out):

```js
// BEFORE (in submitAPI.js):
async function submitBuy(context) {
  let gameState = await database.ref('games/' + context.game).once('value');
  gameState = gameState.val();
  // ... mutate gameState ...
  await finalizeSubmit(gameState, context.game, context);
  return 'done';
}

// AFTER (in functions/logic/submitBuy.js):
function submitBuyLogic(gameState, setup, params) {
  // params = { playerName, buyCountry, buyStock, returnStock }
  // ... mutate gameState (same logic) ...
  return gameState;
}
// Firebase read/write handled by the CF entry point in index.js
```

**Files to create:** 14 new files in `functions/`
**Files to modify:** 0 (client code unchanged in this step)

### Step 2: Bug fixes during split

Fix these bugs while extracting the code:

**2a. `newGame()` shallow templatePlayer copy** (`gameAdmin.js`)

```js
// BEFORE (shallow copy — nested objects shared):
gameState.playerInfo[name] = { ...templatePlayer };

// AFTER (deep clone):
gameState.playerInfo[name] = JSON.parse(JSON.stringify(templatePlayer));
```

**2b. `returnStock()` iterate-while-splice** (`submitBuy.js`)

```js
// BEFORE (buggy — for...in on array + splice during iteration):
for (let i in owned) {
  if (owned[i].country === stock.country && owned[i].stock === stock.stock) {
    owned.splice(i, 1);
  }
}

// AFTER:
let idx = owned.findIndex(s => s.country === stock.country && s.stock === stock.stock);
if (idx !== -1) owned.splice(idx, 1);
```

**2c. `getStockBelow()` returns purchased stock** (`helper.js`)

```js
// Add filter to exclude stocks already in any player's portfolio
// (exact fix TBD after reading getStockBelow implementation)
```

**Files to modify:** `helper.js` (source of truth), `functions/logic/submitBuy.js`, `functions/logic/gameAdmin.js`

### Step 3: Extract triggerPeaceVote helper

Extract the 3x duplicated peace vote trigger logic into a shared helper:

```js
// functions/logic/submitManeuver.js

/**
 * Checks if a move triggers a peace vote and sets up the appropriate
 * voting mechanism (dictatorship: dictator decides, democracy: stockholders vote).
 *
 * Peace vote flow:
 //
 //   Move to foreign territory with "peace" action
 //       │
 //       ├── No enemy units at destination → no vote, continue
 //       │
 //       ├── Enemy units + Dictatorship
 //       │   └── Set pendingPeace, activate dictator
 //       │
 //       └── Enemy units + Democracy
 //           └── Set peaceVote, activate all stockholders
 //
 * @param {Object} gameState - Game state (mutated in place)
 * @param {Object} cm - currentManeuver object
 * @param {string} origin - Unit's current territory
 * @param {string} dest - Destination territory
 * @param {string} unitType - 'fleet' or 'army'
 * @param {Object} territorySetup - Territory configuration
 * @param {Set} [destroyedUnits] - Units destroyed earlier in batch (optional)
 * @returns {{ triggered: boolean, tuple: Array }} Whether a peace vote was triggered
 */
function triggerPeaceVote(gameState, cm, origin, dest, unitType, territorySetup, destroyedUnits) {
  // ... extracted logic (shared by submitManeuver + submitBatchManeuver) ...
}
```

**Replaces:** ~227 lines of duplicated code → ~60 line helper + 3 call sites of ~5 lines each

**Files to create:** Helper is part of `submitManeuver.js`
**Tests to add:** `triggerPeaceVote.test.js` — dictatorship path, democracy path, no-enemy-units path, destroyed-units filtering

### Step 4: Server-side validation layer

Create `functions/validation.js` with validation for every action type:

```js
// functions/validation.js

/**
 * Validation pipeline:
 //
 //   ┌──────────┐     ┌──────────┐     ┌──────────┐
 //   │ Auth      │────▶│ Turn     │────▶│ Move     │
 //   │ (auto by  │     │ check    │     │ legality │
 //   │  callable)│     │          │     │          │
 //   └──────────┘     └──────────┘     └──────────┘
 //       │                 │                 │
 //       ▼                 ▼                 ▼
 //   HttpsError        HttpsError       HttpsError
 //   UNAUTHENTICATED   FAILED_PRECOND   FAILED_PRECOND
 //   "Not logged in"   "Not your turn"  "Can't afford"
 */

const { HttpsError } = require('firebase-functions/v2/https');

/** Verify the game is in the expected mode */
function validateMode(gameState, expectedMode) {
  if (gameState.mode !== expectedMode) {
    throw new HttpsError('failed-precondition',
      `Expected mode ${expectedMode}, got ${gameState.mode}`);
  }
}

/** Verify it's this player's turn */
function validateTurn(gameState, playerName) {
  if (!gameState.playerInfo[playerName]?.myTurn) {
    throw new HttpsError('failed-precondition',
      `It is not ${playerName}'s turn`);
  }
}

/** Validate a stock buy action */
function validateBuy(gameState, setup, params) {
  const { playerName, buyCountry, buyStock } = params;
  validateTurn(gameState, playerName);
  // Punt buy is always valid
  if (buyCountry === 'Punt Buy') return;
  // Check stock exists in available pool
  const avail = gameState.countryInfo[buyCountry]?.availStock || [];
  if (!avail.includes(buyStock)) {
    throw new HttpsError('failed-precondition',
      `Stock ${buyStock} not available for ${buyCountry}`);
  }
  // Check player can afford it
  const price = setup.stockCosts?.[buyStock] || 0;
  if (gameState.playerInfo[playerName].money < price) {
    throw new HttpsError('failed-precondition',
      `Cannot afford stock (need $${price}, have $${gameState.playerInfo[playerName].money})`);
  }
}

/** Validate a bid */
function validateBid(gameState, params) {
  const { playerName, bidAmount } = params;
  validateTurn(gameState, playerName);
  if (bidAmount < 0) {
    throw new HttpsError('failed-precondition', 'Bid cannot be negative');
  }
  if (bidAmount > gameState.playerInfo[playerName].money) {
    throw new HttpsError('failed-precondition',
      `Bid exceeds available money ($${gameState.playerInfo[playerName].money})`);
  }
}

/** Validate a proposal (wheel position) */
function validateProposal(gameState, setup, params) {
  const { playerName, wheelSpot } = params;
  validateTurn(gameState, playerName);
  const wheel = setup.wheel;
  if (!wheel || !wheel.includes(wheelSpot)) {
    throw new HttpsError('failed-precondition',
      `Invalid wheel position: ${wheelSpot}`);
  }
}

/** Validate a maneuver move */
function validateManeuver(gameState, territorySetup, params) {
  const { destination } = params;
  const cm = gameState.currentManeuver;
  if (!cm) {
    throw new HttpsError('failed-precondition', 'No active maneuver');
  }
  // Armies can't move to sea
  if (cm.phase === 'army' && territorySetup[destination]?.sea) {
    throw new HttpsError('failed-precondition',
      `Armies cannot move to sea territory "${destination}"`);
  }
}

module.exports = {
  validateMode, validateTurn, validateBuy, validateBid,
  validateProposal, validateManeuver,
};
```

**Tests to add:** `validation.test.js` — each validation function with pass and fail cases.
Estimated: ~30-40 test cases.

### Step 5: CF entry points (index.js)

Create the 5 grouped Cloud Functions:

```js
// functions/index.js
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const db = require('./db');
const validation = require('./validation');
const submitBuyLogic = require('./logic/submitBuy');
const submitProposalLogic = require('./logic/submitProposal');
const submitBidLogic = require('./logic/submitBid');
const submitManeuverLogic = require('./logic/submitManeuver');
const submitPeaceLogic = require('./logic/submitPeace');
const gameAdminLogic = require('./logic/gameAdmin');
const helpers = require('./logic/submitHelpers');

admin.initializeApp();

// ── submitTurn ──────────────────────────────────────────────
// Handles: buy, vote, noCounter, proposal
exports.submitTurn = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Not logged in');
  const { type, gameID, ...params } = request.data;

  const gameState = await db.readGameState(gameID);
  const setup = await db.readSetup(gameState.setup);

  switch (type) {
    case 'buy':
      validation.validateBuy(gameState, setup, params);
      submitBuyLogic.submitBuy(gameState, setup, params);
      break;
    case 'vote':
      validation.validateTurn(gameState, params.playerName);
      submitProposalLogic.submitVote(gameState, params);
      break;
    case 'noCounter':
      validation.validateTurn(gameState, params.playerName);
      submitProposalLogic.submitNoCounter(gameState, params);
      break;
    case 'proposal':
      validation.validateProposal(gameState, setup, params);
      submitProposalLogic.submitProposal(gameState, setup, params);
      break;
    default:
      throw new HttpsError('invalid-argument', `Unknown action: ${type}`);
  }

  await helpers.finalizeSubmit(gameState, gameID);
  return { state: gameState };  // Return for client-side cache
});

// ── submitBid ───────────────────────────────────────────────
exports.submitBid = onCall(async (request) => { /* similar pattern */ });

// ── submitManeuver ──────────────────────────────────────────
exports.submitManeuver = onCall(async (request) => { /* similar pattern */ });

// ── submitPeace ─────────────────────────────────────────────
exports.submitPeace = onCall(async (request) => { /* similar pattern */ });

// ── gameAdmin ───────────────────────────────────────────────
exports.gameAdmin = onCall(async (request) => { /* similar pattern */ });
```

**Files to create:** `functions/index.js`, `functions/db.js`, `functions/email.js`, `functions/package.json`

### Step 6: Server-side finalizeSubmit

Adapt `finalizeSubmit` for the server:

```js
// functions/logic/submitHelpers.js

// Server-side finalizeSubmit differences from client:
//
// ┌─────────────────────────┬──────────────┬──────────────┐
// │ Responsibility          │ Client       │ Server       │
// ├─────────────────────────┼──────────────┼──────────────┤
// │ Round money             │ ✓            │ ✓ (same)     │
// │ Send email              │ emailjs-com  │ EmailJS REST │
// │ Adjust timer            │ ✓            │ ✓ (same)     │
// │ Archive old state       │ ✓            │ ✓ (same)     │
// │ Write new state         │ client SDK   │ admin SDK    │
// │ setCachedState          │ ✓            │ ✗ (removed)  │
// │ Error propagation       │ ✗ (silent)   │ ✓ (throws)   │
// │ Firebase transactions   │ ✗            │ ✓ (vote/undo)│
// └─────────────────────────┴──────────────┴──────────────┘
```

**Key changes:**
- Remove `setCachedState()` call
- Replace `emailjs.send()` with `fetch('https://api.emailjs.com/api/v1.0/email/send', ...)`
- Replace `database.ref().set()` with `admin.database().ref().set()`
- Let `.set()` errors propagate (remove empty error handler)
- Use `admin.database.ServerValue.TIMESTAMP` for server time (instead of `/.info/serverTimeOffset`)

### Step 7: Firebase transactions for vote + undo

Add transactions for the two concurrent-write-prone operations:

```js
// In submitVote (server-side):
// Use transaction to prevent lost votes when multiple players vote simultaneously
const gameRef = admin.database().ref('games/' + gameID);
await gameRef.transaction((currentState) => {
  if (!currentState) return currentState;
  // Apply vote to currentState (not a stale copy)
  // ... same vote logic ...
  return currentState;  // Transaction commits atomically
});

// In undo (server-side):
// Use transaction to prevent undo colliding with an in-progress submission
await gameRef.transaction((currentState) => {
  if (!currentState) return currentState;
  if (currentState.undo !== params.playerName) {
    return; // Abort transaction — someone else submitted
  }
  // ... restore previous state ...
  return restoredState;
});
```

### Step 8: Client-side optimistic update wiring

Modify `submitAPI.js` (client) to add CF calls alongside local logic:

```js
// public/client/src/backendFiles/submitAPI.js (modified)
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

// Optimistic update flow:
//
//   Submit clicked
//       │
//       ├──────────────────────┐
//       ▼                      ▼
//   Run logic locally     Call CF (async)
//   Cache result           │
//   Update UI instantly    │
//   Disable submit btn     │
//       │                  │
//       │         ┌────────┘
//       │         ▼
//       │    CF responds
//       │    ├── success → cache CF state, re-enable submit
//       │    └── error → revert to pre-submit state, show toast
//       │
//       ▼
//   turnID listener fires
//   ├── cache hit → no-op (already correct)
//   └── cache miss → fetch authoritative state → re-render

async function submitBuy(context) {
  // 1. Run logic locally (existing code — unchanged)
  let gameState = await database.ref('games/' + context.game).once('value');
  gameState = gameState.val();
  // ... existing mutation logic ...
  // Optimistic cache + UI update
  setCachedState(context.game, gameState.turnID + 1, gameState);

  // 2. Call CF in parallel
  try {
    const submitTurn = httpsCallable(functions, 'submitTurn');
    const result = await submitTurn({
      type: 'buy',
      gameID: context.game,
      playerName: context.name,
      buyCountry: context.buyCountry,
      buyStock: context.buyStock,
      returnStock: context.returnStock,
    });
    // Cache authoritative state from CF response
    if (result.data?.state) {
      setCachedState(context.game, result.data.state.turnID, result.data.state);
    }
  } catch (err) {
    // Revert optimistic update — listener will fetch authoritative state
    setCachedState(context.game, null, null);
    throw err;  // Caller shows error toast
  }
  return 'done';
}
```

**Files to modify:** `submitAPI.js` (add CF calls to all 13 submit functions), `firebase.js` (export `getFunctions()`)

**Error toast integration:** Use Ant Design's `message.error()` in the mode components:

```js
// In BuyApp.js (and other mode components):
import { message } from 'antd';

const handleSubmit = async () => {
  setSubmitLoading(true);
  try {
    await submitBuy(context);
  } catch (err) {
    message.error(err.message || 'Move rejected by server');
    // Optimistic state already reverted by submitBuy's catch block
  } finally {
    setSubmitLoading(false);
  }
};
```

### Step 9: Database rules lockdown (Phase C)

Update `database.rules.json`:

```json
{
  "rules": {
    "games": {
      ".read": "auth !== null",
      "$gameID": {
        ".write": false
      }
    },
    "game histories": {
      ".read": "auth !== null",
      "$gameID": {
        "$turnID": {
          ".write": false
        }
      }
    },
    "template game": {
      ".read": "auth !== null",
      ".write": false
    },
    "setups": {
      ".read": "auth !== null",
      ".write": false
    },
    "users": {
      ".read": false,
      ".write": false,
      "$uid": {
        ".read": "auth !== null && auth.uid === $uid",
        ".write": "auth !== null && auth.uid === $uid"
      }
    }
  }
}
```

**Changed paths:** `games/$gameID/.write` and `game histories/$gameID/$turnID/.write` → `false`

Admin SDK (used by Cloud Functions) bypasses all rules, so CFs still write freely.

### Step 10: CI/CD deploy pipeline

Update `.github/workflows/ci.yml` to deploy Cloud Functions:

```yaml
  deploy:
    needs: build
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node 20
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install functions dependencies
        run: npm ci
        working-directory: functions

      - name: Copy shared files to functions
        run: |
          mkdir -p functions/shared
          cp public/client/src/backendFiles/helper.js functions/shared/
          cp public/client/src/gameConstants.js functions/shared/

      - name: Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: build
          path: public/client/build

      - name: Deploy to Firebase (Hosting + Functions)
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: imperialgame-e8a12

      - name: Deploy Cloud Functions
        run: npx firebase-tools deploy --only functions --project imperialgame-e8a12
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

Also update `firebase.json` predeploy to copy shared files:

```json
"functions": {
  "predeploy": [
    "mkdir -p functions/shared && cp public/client/src/backendFiles/helper.js functions/shared/ && cp public/client/src/gameConstants.js functions/shared/",
    "npm --prefix \"$RESOURCE_DIR\" run lint"
  ],
  "source": "functions"
}
```

### Step 11: Predeploy copy script + .gitignore

Add `functions/shared/` to `.gitignore` (auto-generated files shouldn't be committed):

```
# functions/.gitignore (append)
shared/
node_modules/
```

The predeploy script in `firebase.json` handles copying before deploy.
CI pipeline also copies before deploy.

---

## CF Parameter Contract

Each Cloud Function accepts minimal player choices. Server reads authoritative state.

```
submitTurn:
  type: "buy"
    → { gameID, playerName, buyCountry, buyStock, returnStock }
  type: "vote"
    → { gameID, playerName, vote }         // 1 or 2
  type: "noCounter"
    → { gameID, playerName }
  type: "proposal"
    → { gameID, playerName, wheelSpot, fleetMan?, armyMan?,
        factoryLoc?, fleetProduce?, armyProduce?, importData? }

submitBid:
  type: "bid"
    → { gameID, playerName, bidAmount }
  type: "bidBuy"
    → { gameID, playerName, accept }       // boolean

submitManeuver:
  type: "maneuver"
    → { gameID, playerName, destination, action }
  type: "batchManeuver"
    → { gameID, playerName, fleetMan[], armyMan[] }

submitPeace:
  type: "peaceVote"
    → { gameID, playerName, vote }         // 'accept' or 'reject'
  type: "dictatorPeaceVote"
    → { gameID, playerName, accept }       // boolean

gameAdmin:
  type: "newGame"
    → { newGameID, newGamePlayers[] }
  type: "undo"
    → { gameID, playerName }
```

All CFs return `{ state: <new gameState> }` on success for client-side caching.

---

## Test Plan

### Existing tests (keep + adapt)

| File | Tests | Adaptation |
|------|-------|------------|
| `submitAPI.test.js` | 170 | Extract game logic tests → run against pure functions |
| `helper.test.js` | 137 | No changes (already tests pure functions) |
| `proposalAPI.test.js` | 171 | No changes (client-only, still reads from Firebase) |
| `turnAPI.test.js` | 44 | No changes |
| `buyAPI.test.js` | 30 | No changes |
| `stateCache.test.js` | 21 | No changes |
| Others | 46 | No changes |

### New tests to write

| File | Coverage | Est. tests |
|------|----------|------------|
| `validation.test.js` | Auth, turn check, all move validation rules (pass + fail) | ~35 |
| `triggerPeaceVote.test.js` | Dictatorship, democracy, no-enemy, destroyed-units | ~10 |
| `submitHelpers.test.js` | Server finalizeSubmit, error propagation, EmailJS REST | ~8 |
| `index.test.js` | CF routing, unknown action, response shape | ~10 |
| Bugfix tests | returnStock duplicate, newGame deep clone, getStockBelow filter | ~6 |
| Transaction tests | Concurrent votes, undo collision | ~4 |
| **Total new** | | **~73** |

### Test diagram

```
New code paths requiring tests:

  ┌── Auth (C) ──────────── valid / missing token
  │
  ├── Router (D) ────────── each action type / unknown type
  │
  ├── Turn validation (E) ─ right player / wrong player / wrong mode
  │
  ├── Move validation (F)
  │   ├── Buy: can afford / can't afford / stock unavailable
  │   ├── Bid: valid / negative / exceeds money
  │   ├── Proposal: valid wheel pos / invalid
  │   └── Maneuver: valid dest / army to sea / no active maneuver
  │
  ├── Game logic (G) ────── 170 existing tests (adapted to pure functions)
  │
  ├── Server finalize (H)
  │   ├── EmailJS REST success / failure
  │   ├── Firebase write success / failure (error propagation)
  │   └── Timer adjustment
  │
  ├── Transactions (new)
  │   ├── Concurrent votes → both counted
  │   └── Undo collision → aborted
  │
  ├── triggerPeaceVote (M)
  │   ├── Dictatorship → dictator activated
  │   ├── Democracy → all stockholders activated
  │   ├── No enemy units → no vote triggered
  │   └── Destroyed units filtered out
  │
  └── Bugfixes (N, O, P)
      ├── returnStock with duplicate stocks
      ├── newGame player objects independent
      └── getStockBelow excludes purchased
```

---

## Failure Modes

| Code Path | Failure | Tested? | Handled? | User Sees |
|-----------|---------|---------|----------|-----------|
| Auth | Expired token | Yes | Yes (HttpsError) | Error toast |
| Router | Unknown action | Yes | Yes (HttpsError) | Error toast |
| Turn validation | Wrong player | Yes | Yes (HttpsError) | Error toast |
| Move validation | Invalid move | Yes | Yes (HttpsError) | Error toast |
| Firebase write | RTDB failure | Yes | Yes (propagates) | Error toast + revert |
| EmailJS REST | API timeout | No | Best-effort (log) | Silent (acceptable) |
| CF cold start | ~2-5s first call | No | Spinner covers it | Brief delay |
| Optimistic mismatch | State diverges | Listener | Auto-corrects | Brief flicker |
| Network timeout | CF unreachable | No | Callable SDK timeout | Error toast |
| Concurrent votes | Lost vote | Yes | Transaction | Both counted |

**Critical gaps: 0** (all critical paths have tests + error handling)

---

## NOT in scope

| Item | Rationale |
|------|-----------|
| Bid secrecy (write-only collection) | Feature enhancement, separate PR after CFs stable |
| Cosmetic bugs (float in history, "Denmark to Denmark") | Low severity, unrelated to migration |
| E2E Playwright tests | Separate initiative, unit tests sufficient |
| Error monitoring (Sentry) | Good to have, not blocking |
| `useTurnListener` hook extraction | Code cleanup, unrelated |
| Mobile-responsive layout | Unrelated |
| Drag-and-drop unit movement | Unrelated |
| Spectator mode | Phase 2 feature |

---

## What already exists

| Existing | Reuse? |
|----------|--------|
| `submitAPI.js` — all game logic | Reuse: same logic runs on server + client (optimistic) |
| `helper.js` — 19 pure utilities | Reuse: predeploy copy to functions/ |
| `gameConstants.js` — enums/types | Reuse: predeploy copy to functions/ |
| `firebase.json` — functions config | Reuse: already configured |
| `functions/` — eslintrc, gitignore | Reuse: add package.json + source |
| `stateCache.js` — game/setup cache | Keep on client for optimistic updates |
| 170 submitAPI tests | Reuse: adapt to pure function interface |
| `database.rules.json` | Modify: Phase C lockdown |
| CI deploy job | Extend: add functions deploy step |
| `FIREBASE_SERVICE_ACCOUNT` secret | Reuse: already in GitHub Actions |

---

## Build Sequence

```
Step  1: Split submitAPI.js → functions/logic/*.js (pure functions)
Step  2: Bug fixes (templatePlayer, returnStock, getStockBelow)
Step  3: Extract triggerPeaceVote helper
Step  4: Create validation.js
Step  5: Create index.js (CF entry points)
Step  6: Create server finalizeSubmit + email.js + db.js
Step  7: Add Firebase transactions (vote + undo)
Step  8: Wire client optimistic updates + error toasts
Step  9: Update database.rules.json (Phase C)
Step 10: Update CI pipeline (functions deploy)
Step 11: Predeploy script + .gitignore

Steps 1-7: Server-side (can be developed + tested without touching client)
Step 8: Client-side (wires everything together)
Steps 9-11: Infrastructure (final lockdown + automation)
```

**Estimated new files:** ~18
**Estimated modified files:** ~8 (submitAPI.js, firebase.js, firebase.json, database.rules.json, ci.yml, .gitignore, helper.js, TODO.md)
**Estimated new tests:** ~73
