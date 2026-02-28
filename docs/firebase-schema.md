# Firebase Realtime Database Schema

Complete reference for every path in the Firebase Realtime Database. This is the authoritative source for understanding game state.

---

## Top-Level Structure

```
root/
  games/{gameID}/              # Active game state (one per game)
  game histories/{gameID}/{turnID}/  # Snapshot of game state before each turn
  template game/               # Template used to create new games
  setups/{setupName}/          # Static board configuration (territories, countries, wheel, costs)
  users/{uid}/                 # Per-user data (auth-gated)
```

---

## `games/{gameID}/` - Active Game State

This is the primary game state object. All game logic reads from and writes to this path. Every field is described below.

```
games/{gameID}/
  mode: string                 # Current game phase (see Mode Values below)
  countryUp: string            # Name of the country whose turn it is (e.g. "Austria")
  round: number                # Current round number (increments when last country finishes)
  turnID: number               # Auto-incrementing turn counter, used as key in game histories
  setup: string                # Path to the setup config (e.g. "setups/standard")
  sameTurn: boolean            # True if the turn hasn't fully changed (e.g. mid-voting)
  undo: string                 # Player name who last submitted (can undo). Null if no undo available.
  history: string[]            # Array of human-readable history messages for the game log

  # Proposals (only present during proposal/vote flow, null otherwise)
  proposal 1: object | null    # Stringified context from leader's proposal (see Proposal Object)
  proposal 2: object | null    # Stringified context from opposition's proposal (see Proposal Object)

  # Voting (only present during vote mode, null otherwise)
  voting: VotingState | null   # Vote tracking object (see Voting State)

  # Bid-buy order (only present during buy-bid mode)
  bidBuyOrder: string[]        # Ordered list of player names sorted by bid (highest first)

  # Swiss banking
  swissSet: string[] | null    # Players who chose "Punt Buy" this investor round. Null when not in use.

  # Step-by-step maneuver state (only present during continue-man mode)
  currentManeuver: CurrentManeuver | null  # Tracks unit-by-unit movement progress (see Current Maneuver)

  # Peace vote state (only present during peace-vote mode)
  peaceVote: PeaceVote | null    # Tracks stockholder vote on a peace offer (see Peace Vote)

  # Timer
  timer: TimerState            # Timer configuration and state (see Timer State)

  # Player data
  playerInfo/{name}/           # Per-player state (see Player Info)

  # Country data
  countryInfo/{country}/       # Per-country state (see Country Info)
```

### Mode Values

The `mode` field drives the entire UI and game flow. `TurnApp.js` switches on this value.

| Mode            | Description                                                    | Who plays                    |
|-----------------|----------------------------------------------------------------|------------------------------|
| `"bid"`         | All players simultaneously bid on the current country's stock  | All players with enough money|
| `"buy-bid"`     | Highest bidder decides to buy or pass on the stock             | One player at a time (from bidBuyOrder) |
| `"buy"`         | Investor card triggered; players buy stock in turn order       | Player with investor card + swiss banking players |
| `"proposal"`    | Country leader makes a proposal (chooses wheel action)         | Leader (leadership[0])       |
| `"proposal-opp"`| Opposition leader counter-proposes                             | Opposition (leadership[1])   |
| `"vote"`        | Stockholders vote on leader vs opposition proposal             | All players in leadership[]  |
| `"continue-man"`| Step-by-step maneuver: move one unit at a time                 | Player building the maneuver |
| `"peace-vote"`  | Stockholders vote on a peace offer from another country        | Target country's stockholders|
| `"game-over"`   | A country reached 25 points; game ends                         | Nobody (display only)        |

---

## `games/{gameID}/playerInfo/{name}/` - Player Info

Each player is keyed by their display name (a string like `"Alice"`). Player names are set during game creation.

```
playerInfo/{name}/
  money: number          # Player's cash (float, rounded to 2 decimals on save)
  myTurn: boolean        # True if this player should be taking an action right now
  investor: boolean      # True if this player holds the investor card
  order: number          # Turn order (1-based). Set after initial bidding round, by wealth ranking.
  swiss: boolean         # True if this player gets a swiss banking buy this round
  stock: StockEntry[]    # Array of stock objects owned by this player (see Stock Entry)
  scoreModifier: number  # Points added/subtracted from final score (e.g. -1 per timer violation)
  email: string          # Player's email for turn notifications (optional, may be empty)

  # Timer-related
  banked: number         # Banked time in seconds (chess-clock style)

  # Bid-related (transient, deleted after bid round)
  bid: number | undefined  # Current bid amount. Deleted after bid round resolves.
```

### Stock Entry

Each element of the `stock` array:

```js
{
  country: string,  // Country name (e.g. "Austria")
  stock: number     // Stock denomination/value (1-8 typically, maps to stockCosts index)
}
```

**Note:** `stock` value of `0` is a special "nothing" value used when no return stock is selected. A stock with value `0` is never pushed to availStock on return.

### Score Calculation

Final score = `sum(floor(countryPoints / 5) * stockDenomination)` for each owned stock + `money` + `scoreModifier`

Cash value = `sum(2 * stockDenomination)` for each owned stock + `money`

---

## `games/{gameID}/countryInfo/{country}/` - Country Info

Each country is keyed by its display name (e.g. `"Austria"`, `"Italy"`, `"France"`, `"England"`, `"Germany"`, `"Russia"`).

```
countryInfo/{country}/
  money: number              # Country treasury (float, rounded to 2 decimals on save)
  points: number             # Victory points (0-25). Game ends when any country reaches 25.
  factories: string[]        # Array of territory names where this country has factories
  wheelSpot: string          # Current position on the rondel wheel (e.g. "Investor", "Taxation", or "center" at start)
  gov: string                # Government type: "dictatorship" or "democracy"
  leadership: string[]       # Ordered array of player names. [0] = leader, [1] = opposition. Sorted by stock ownership descending.
  availStock: number[]       # Array of available stock denominations that can be purchased
  offLimits: boolean         # True if this country's stock was already bought this investor round
  lastTax: number            # Points threshold from last taxation (used to calculate player payout)
  taxChips: string[]         # Array of territory names where this country has tax/flag chips

  # Military units
  fleets: FleetUnit[]        # Array of fleet objects (may be undefined/null if no fleets)
  armies: ArmyUnit[]         # Array of army objects (may be undefined/null if no armies)
```

### Fleet Unit

```js
{
  territory: string,   // Territory name where the fleet is located
  hostile: boolean      // Always true for fleets (fleets are always hostile)
}
```

### Army Unit

```js
{
  territory: string,   // Territory name where the army is located
  hostile: boolean      // True = occupying/hostile. False = peaceful passage (in foreign territory via peace action)
}
```

### Government Type Logic

Government is recalculated by `changeLeadership()` in `submitAPI.js` whenever stock is bought:

- **Dictatorship:** The top stockholder owns >= 50% of all stock in that country (by denomination sum). Only the leader (leadership[0]) makes proposals.
- **Democracy:** No single player owns >= 50%. The leader proposes, opposition counter-proposes, then stockholders vote.

### Leadership Array

- `leadership[0]` = Leader (player with most stock by denomination sum)
- `leadership[1]` = Opposition (player with second-most stock)
- Sorted descending by total stock denomination owned in that country
- Only players who own stock in this country appear in this array

---

## `games/{gameID}/voting/` - Voting State

Only exists during `mode === "vote"`. Set to `null` after vote resolves.

```
voting/
  country: string              # Country being voted on
  proposal 1/                  # Leader's proposal
    proposal: string           # Human-readable description of the proposal (from history)
    votes: number              # Vote tally (stock denomination sum of voters + 0.1 leader bonus)
    voters: string[]           # Array of player names who voted for this
  proposal 2/                  # Opposition's proposal
    proposal: string           # Human-readable description
    votes: number              # Vote tally
    voters: string[]           # Array of player names who voted for this
```

### Vote Threshold

A proposal wins when `votes > (totalStock + 0.01) / 2.0`. The leader gets a +0.1 bonus to their vote (tiebreak advantage). `totalStock` is the sum of all stock denominations owned by all players in leadership[].

---

## `games/{gameID}/currentManeuver/` - Current Maneuver State

Only exists during `mode === "continue-man"`. Set to `null` when the maneuver completes. Tracks the step-by-step progress of moving units one at a time.

```
currentManeuver/
  country: string                  # Country being maneuvered (e.g. "Austria")
  player: string                   # Player building the proposal
  wheelSpot: string                # "L-Maneuver" or "R-Maneuver"
  phase: string                    # Current phase: "fleet" or "army"
  unitIndex: number                # Index into pendingFleets (fleet phase) or pendingArmies (army phase)
  pendingFleets: FleetUnit[]       # Original fleet positions at maneuver start
  pendingArmies: ArmyUnit[]        # Original army positions at maneuver start
  completedFleetMoves: ManeuverTuple[]  # Resolved fleet ManeuverTuples (accumulated as fleets move)
  completedArmyMoves: ManeuverTuple[]   # Resolved army ManeuverTuples (accumulated as armies move)
  returnMode: string               # Where to go after all units done:
                                   #   "execute" → dictatorship, execute immediately
                                   #   "proposal-opp" → democracy leader, store as proposal 1
                                   #   "vote" → democracy opposition, store as proposal 2
  proposalSlot: number             # Which proposal slot to fill (0=none/execute, 1=proposal 1, 2=proposal 2)

  # Peace vote pending (only present when a dictator must decide on a peace offer)
  pendingPeace: object | null      # If set, a peace vote is awaiting the dictator's decision
    origin: string                 # Territory the unit is coming from
    destination: string            # Territory being entered
    targetCountry: string          # Country that owns the destination territory
    unitType: string               # "fleet" or "army"
    tuple: ManeuverTuple           # The original [origin, dest, "peace"] tuple
```

**Phase transitions:**
- Starts in "fleet" phase if the country has fleets, otherwise "army"
- When `unitIndex >= pendingFleets.length`, switches to "army" phase (unitIndex resets to 0)
- When `unitIndex >= pendingArmies.length` in army phase, maneuver is complete

---

## `games/{gameID}/peaceVote/` - Peace Vote State

Only exists during `mode === "peace-vote"`. Set to `null` when the vote resolves. Tracks a democracy stockholder vote on whether to accept or reject a peace offer.

```
peaceVote/
  movingCountry: string            # Country making the peace offer
  targetCountry: string            # Country that owns the territory (voters are this country's stockholders)
  unitType: string                 # Type of moving unit: "fleet" or "army"
  origin: string                   # Territory the unit is coming from
  destination: string              # Territory being entered
  acceptVotes: number              # Weighted accept vote total (stock denominations)
  rejectVotes: number              # Weighted reject vote total (stock denominations)
  voters: string[]                 # Player names who have already voted
  totalStock: number               # Sum of all stock denominations for threshold calculation
  tuple: ManeuverTuple             # The original [origin, dest, "peace"] tuple
```

**Vote resolution:**
- Threshold: `votes > (totalStock + 0.01) / 2.0`
- Target country leader gets +0.1 tiebreak bonus to their vote weight
- If accept wins: ManeuverTuple action stays "peace" (unit enters non-hostilely)
- If reject wins: ManeuverTuple action becomes `"war {targetCountry} {unitType}"` (both units destroyed)
- The proposing country's players never vote on their own peace offers

---

## `games/{gameID}/timer/` - Timer State

Chess-clock style timer with increment and banking.

```
timer/
  timed: boolean        # Whether this game uses timed turns
  increment: number     # Seconds added per turn (like chess increment)
  pause: number         # Server timestamp when game was paused (0 = not paused)
  lastMove: number      # Server timestamp of the last move
  banked: number        # Default banked time in seconds (used when initializing players)
```

**Timer behavior:**
- When a player's banked time runs out (goes negative), they lose 1 point (`scoreModifier -= 1`) and their banked time resets to 60 seconds.
- `adjustTime()` in `submitAPI.js` handles this calculation after each turn submission.
- `pause` is set to the current server timestamp to freeze the clock; set to `0` to resume.

---

## `games/{gameID}/proposal 1` and `proposal 2` - Proposal Objects

Stringified context objects stored during the proposal/vote flow. Created by `helper.stringifyFunctions()` which converts any keys starting with `"set"` or `"reset"` to their `.toString()` representation (to persist React setState callbacks across turns).

When read back, `helper.unstringifyFunctions()` uses `eval()` to restore the function references.

The proposal object contains all the fields from `UserContext` that were set during the proposal, including:

```
proposal 1/  (or proposal 2/)
  game: string              # Game ID
  name: string              # Player who made the proposal
  wheelSpot: string         # Chosen wheel action (e.g. "Taxation", "L-Maneuver")

  # Action-specific fields (varies by wheelSpot):
  factoryLoc: string        # Territory for factory placement (Factory action)
  fleetProduce: string[]    # Territories to produce fleets in (L-Produce/R-Produce)
  armyProduce: string[]     # Territories to produce armies in (L-Produce/R-Produce)
  fleetMan: ManeuverTuple[] # Fleet maneuver instructions (L-Maneuver/R-Maneuver)
  armyMan: ManeuverTuple[]  # Army maneuver instructions (L-Maneuver/R-Maneuver)
  import: ImportData        # Import action data

  # Stringified setState functions (keys starting with "set" or "reset")
  setWheelSpot: string      # Stringified function
  setFleetMan: string       # Stringified function
  # ... etc
```

### Maneuver Tuple

Each element of `fleetMan[]` or `armyMan[]` is a 3-element array:

```js
[origin, destination, actionCode]
```

- `origin`: string - Territory name the unit starts in
- `destination`: string - Territory name the unit moves to
- `actionCode`: string - One of:
  - `""` (empty string) - Normal peaceful move. Also places a tax chip if the destination is an unowned territory.
  - `"peace"` - Explicitly peaceful move (army enters foreign territory non-hostilely)
  - `"war {countryName} {unitType}"` - Attack and destroy an enemy unit (e.g. `"war France fleet"`)
  - `"blow up {countryName}"` - Destroy a factory in the destination territory (e.g. `"blow up France"`)
  - `"hostile"` - Enter foreign territory hostilely (army only)

### Import Data

```js
{
  types: string[],        // Array of "fleet" or "army" for each import slot
  territories: string[]   // Array of territory names for each import slot
}
```

Up to 3 imports per action. Each costs $1 (from country treasury first, then player's money).

---

## `game histories/{gameID}/{turnID}/` - Turn History Snapshots

A complete copy of the game state (`games/{gameID}/`) before each turn submission. Used for the undo feature.

```
game histories/{gameID}/
  {turnID}/              # turnID is a number (matches the turnID at time of snapshot)
    ... (exact copy of games/{gameID}/ at that point in time)
```

**Undo behavior:** `undo()` in `submitAPI.js` reads the snapshot at `turnID - 1`, writes it back to `games/{gameID}/`, removes the history entry, and resets the turnID.

---

## `template game/` - New Game Template

Read-only template used by `newGame()` in `submitAPI.js` to initialize a new game. Contains:

```
template game/
  mode: string                 # Starting mode (likely "bid")
  countryUp: string            # First country to play
  round: number                # Starting round (1)
  turnID: number               # Starting turnID (0 or 1)
  setup: string                # Default setup path (e.g. "setups/standard")
  history: string[]            # Empty or starter history
  sameTurn: boolean            # false
  timer/                       # Default timer config
    timed: boolean
    increment: number
    pause: number
    lastMove: number
    banked: number
  playerInfo/
    player/                    # Template player object (key "player" is deleted and replaced per-player)
      money: number            # Will be overwritten with startingMoney = 61 / playerCount
      myTurn: boolean
      investor: boolean
      order: number
      swiss: boolean
      stock: []
      scoreModifier: number
      email: string
      banked: number
  countryInfo/
    {country}/                 # One entry per country with starting values
      money: number
      points: number
      factories: string[]     # Starting factory locations
      wheelSpot: string       # "center" (starting position)
      gov: string
      leadership: string[]    # Empty at start
      availStock: number[]    # All stocks available at start
      offLimits: boolean      # false
      lastTax: number         # Starting lastTax (usually 5)
      taxChips: string[]      # Empty at start
      fleets: FleetUnit[]     # Starting fleet positions (if any)
      armies: ArmyUnit[]      # Starting army positions (if any)
```

**Known bug:** In `newGame()`, `templatePlayer` is assigned by reference, so all players share the same object. This means setting `banked` on one player affects all players. (Tracked for fix.)

**Known bug:** `startingMoney` calculation has an operator precedence issue: `parseFloat(61.0 / count.toFixed(2))` should be `parseFloat((61.0 / count).toFixed(2))`.

---

## `setups/{setupName}/` - Board Configuration

Static, read-only data that defines the board layout. Referenced by `games/{gameID}/setup` (e.g. `"setups/standard"`).

```
setups/{setupName}/
  wheel: string[]             # Ordered array of wheel/rondel action names
                               # e.g. ["Factory", "L-Produce", "Import", "L-Maneuver",
                               #        "Taxation", "R-Produce", "Investor", "R-Maneuver"]
  wheelCoords/                 # Map coordinates for drawing the rondel on the map
    {actionName}: [x, y]       # Pixel coordinates for each wheel position

  stockCosts: number[]         # Array where index = stock denomination, value = price in millions
                               # These values are defined entirely in Firebase setup data, not
                               # hardcoded in code. The code reads them at runtime via
                               # readSetup(gameState.setup + '/stockCosts').
                               #
                               # Index 0 is unused (stock denominations are 1-indexed, so
                               # denomination 1 maps to stockCosts[1], denomination 2 to
                               # stockCosts[2], etc.). Index 0 is conventionally 0.
                               #
                               # Example: [0, 2, 4, 6, 9, 12, 16, 21, 27]
                               # Note: The exact values depend on the setup stored in Firebase
                               # and may vary between setups.

  countries/
    {country}/
      order: number            # Turn order for this country (1-based)
      fleetLimit: number       # Maximum number of fleets this country can have
      armyLimit: number        # Maximum number of armies this country can have

  territories/
    {territoryName}/
      country: string | null   # Owning country name, or null/undefined if neutral/sea
      port: string | boolean   # If truthy, this is a port territory. Value may be the adjacent sea territory name.
      sea: boolean             # True if this is a sea territory
      adjacencies: string[]    # Array of adjacent territory names
      unitCoords: [x, y]       # Map pixel coordinates for drawing units
      factoryCoords: [x, y]    # Map pixel coordinates for drawing factories
      taxChipCoords: [x, y]    # Map pixel coordinates for drawing tax chips
```

### Territory Types

- **Home territory:** `territory.country` is set to a country name. Factories can be built here.
- **Neutral land:** `territory.country` is null/undefined and `territory.sea` is false. Can be occupied for tax chips.
- **Sea territory:** `territory.sea` is true. Only fleets can be here.
- **Port territory:** `territory.port` is truthy. Has both land and sea access. Fleets are produced at ports.

---

## `users/{uid}/` - User Data

Per-user data gated by Firebase Auth. Each user can only read/write their own node.

```
users/{uid}/
  ... (structure TBD - currently minimal usage)
```

---

## Data Flow Summary

1. **Game creation:** `newGame()` reads `template game/`, clones it, replaces `playerInfo.player` with actual player names, calculates starting money, writes to `games/{newGameID}/`.

2. **Turn submission:** Any `submit*()` function in `submitAPI.js`:
   - Reads current state from `games/{gameID}/`
   - Modifies the state object in memory
   - Saves old state to `game histories/{gameID}/{oldTurnID}/`
   - Writes new state to `games/{gameID}/`
   - Increments turnID
   - Sends email notifications to players whose `myTurn` is now true

3. **Undo:** Reads the previous turn from `game histories/`, writes it back to `games/`, removes the history entry.

4. **UI updates:** Components listen to `games/{gameID}/turnID` (and sometimes `timer/`) via Firebase `.on('value')` listeners. When turnID changes, they re-fetch relevant data through the various API files.

---

## Database Rules

```json
{
  "rules": {
    "games": {
      ".read": "auth !== null",
      "$gameID": { ".write": "auth !== null" }
    },
    "game histories": {
      ".read": "auth !== null",
      "$gameID": { "$turnID": { ".write": "auth !== null" } }
    },
    "template game": { ".read": "auth !== null", ".write": false },
    "setups": { ".read": "auth !== null", ".write": false },
    "users": {
      ".read": false, ".write": false,
      "$uid": {
        ".read": "auth !== null && auth.uid === $uid",
        ".write": "auth !== null && auth.uid === $uid"
      }
    }
  }
}
```

Any authenticated user can read all games and game histories, and write to any specific game. Template game and setups are read-only. Users can only access their own user data.
