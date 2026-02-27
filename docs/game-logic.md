# Game Logic & State Machine

A plain-English guide to how Imperial's game loop works, how state transitions happen, and how all the systems interact. Read `firebase-schema.md` first for data model details.

---

## The Turn Cycle

Imperial follows a fixed country rotation. Each country gets a turn in order (e.g. Austria, Italy, France, England, Germany, Russia). When the last country finishes, a new round begins.

Within each country's turn, the game goes through a sequence of **modes**. The current mode is stored in `gameState.mode` and drives which UI component is shown in `TurnApp.js`.

### Starting Phase: Initial Bidding

When a new game starts, the mode is `bid`. All players simultaneously bid on stock for each country in rotation order. This is how initial stock ownership is established.

```
For each country (Austria → Italy → ... → Russia):
  bid → buy-bid → [next country bid OR end bidding]
```

- **bid**: All players submit a bid amount simultaneously. When everyone has bid, mode changes to `buy-bid`.
- **buy-bid**: Players are offered the stock in order of highest bid. Each player can buy (at their bid price) or pass. When no one left can afford stock, the next country's bid begins.

After the last country (Russia) or when no one can afford to bid, the game transitions to the main cycle:
- Player order is set by wealth (richest gets turn #1)
- The investor card goes to the richest player
- The first country's leader begins proposing

### Main Cycle: Proposal → Buy

This is the core loop that repeats for the rest of the game:

```
┌──────────────────────────────────────────────────────────┐
│                    COUNTRY'S TURN                         │
│                                                          │
│  ┌──────────┐                                            │
│  │ proposal │── (dictatorship) ──> executeProposal() ──┐ │
│  └──────────┘                                          │ │
│       │                                                │ │
│   (democracy)                                          │ │
│       │                                                │ │
│       v                                                │ │
│  ┌──────────────┐                                      │ │
│  │ proposal-opp │── (agree) ──> executeProposal() ───┐ │ │
│  └──────────────┘                                    │ │ │
│       │                                              │ │ │
│   (counter)                                          │ │ │
│       │                                              │ │ │
│       v                                              │ │ │
│  ┌──────────┐                                        │ │ │
│  │   vote   │── (winner) ──> executeProposal() ────┐ │ │ │
│  └──────────┘                                      │ │ │ │
│                                                    v v v │
│                                          ┌─────────────┐ │
│                                          │ post-action  │ │
│                                          └─────────────┘ │
│                                                │         │
│                                   ┌────────────┴───┐     │
│                                   │                │     │
│                          (investor passed)  (not passed) │
│                                   │                │     │
│                                   v                v     │
│                              ┌─────────┐   next country  │
│                              │   buy   │   (proposal)    │
│                              └─────────┘                 │
│                                   │                      │
│                            (all done buying)             │
│                                   │                      │
│                              next country                │
│                              (proposal)                  │
└──────────────────────────────────────────────────────────┘
```

### Mode Transitions (with code references)

| From | To | Trigger | Code Location |
|------|----|---------|---------------|
| `bid` | `buy-bid` | All players submitted bids | `bid()` line ~850 |
| `buy-bid` | `bid` | More countries to bid on, players can afford | `doneBuying()` line ~743 |
| `buy-bid` | `proposal` | Last bid country done or no one can afford | `doneBuying()` → `incrementCountry()` line ~102 |
| `proposal` | `continue-man` | L/R-Maneuver selected (any gov type) | `submitProposal()` → `enterManeuver()` |
| `proposal` | (executes) | Dictatorship: non-maneuver proposal runs immediately | `submitProposal()` |
| `proposal` | `proposal-opp` | Democracy: non-maneuver leader submitted | `submitProposal()` |
| `proposal-opp` | `continue-man` | Opposition selects L/R-Maneuver | `submitProposal()` → `enterManeuver()` |
| `proposal-opp` | (executes) | Opposition agreed (no counter) | `submitNoCounter()` |
| `proposal-opp` | `vote` | Opposition counter-proposed (non-maneuver) | `submitProposal()` |
| `continue-man` | `continue-man` | Unit moved, more units remain | `submitManeuver()` |
| `continue-man` | `peace-vote` | Peace offer to democracy target | `submitManeuver()` |
| `continue-man` | (executes) | All units done, dictatorship | `completeManeuver()` → `executeProposal()` |
| `continue-man` | `proposal-opp` | All units done, democracy leader | `completeManeuver()` |
| `continue-man` | `vote` | All units done, democracy opposition | `completeManeuver()` |
| `peace-vote` | `continue-man` | Peace vote threshold reached | `submitPeaceVote()` / `submitDictatorPeaceVote()` |
| `vote` | (executes) | A proposal got majority votes | `submitVote()` line ~315 |
| (post-execute) | `buy` | Investor slot was passed on the rondel | `executeProposal()` |
| (post-execute) | `proposal` | Investor not passed, next country | `executeProposal()` → `incrementCountry()` |
| `buy` | `proposal` | All buy/swiss actions complete | `submitBuy()` → `incrementCountry()` |
| (any taxation) | `game-over` | A country reached 25 points | `executeProposal()` Taxation case |

---

## The Wheel (Rondel) System

Each country has a position on a circular wheel (rondel) with 8 actions. When a country's leader proposes, they choose which wheel action to move to.

### Wheel Positions (standard setup)

The wheel is an ordered array: `["Factory", "L-Produce", "Import", "L-Maneuver", "Taxation", "R-Produce", "Investor", "R-Maneuver"]`

### Movement Rules

- First move from `"center"`: can go to any position (free)
- Subsequent moves: 1-3 steps forward are free. Steps 4+ cost $2 each.
- Movement is always clockwise (forward in array order, wrapping around)
- Cost formula: `$2 * (steps - 3)` for steps > 3

### What Each Action Does

**Factory** (`executeProposal` case `WHEEL_ACTIONS.FACTORY`):
- Builds a factory in one of the country's territories (not already occupied or factored)
- Costs $5 from country treasury. If country can't afford it, the player pays the shortfall.

**L-Produce / R-Produce** (`WHEEL_ACTIONS.L_PRODUCE` / `R_PRODUCE`):
- Creates new units at unsaturated factory locations (factories not occupied by hostile armies)
- Ports produce fleets, inland factories produce armies
- Each country has fleet/army limits (from setup config)

**Import** (`WHEEL_ACTIONS.IMPORT`):
- Places up to 3 new units (fleets or armies) in the country's territories
- Each import costs $1 (from country treasury, then player if country is broke)

**Taxation** (`WHEEL_ACTIONS.TAXATION`):
- Calculates points from tax chips + factories: `points = taxChips + 2 * unsatFactories` (max 15)
- Victory points gained = `max(points - 5, 0)` (5 is the baseline)
- Money into treasury = `points - numUnits` (units consume money)
- Distributes "greatness" (money) to stockholders proportionally
- **If country reaches 25 points, game is over!**

**Investor** (`WHEEL_ACTIONS.INVESTOR`):
- Pays stockholders from country treasury proportionally to stock ownership
- If treasury can't cover it, the proposing player absorbs the shortfall

**L-Maneuver / R-Maneuver** (`WHEEL_ACTIONS.L_MANEUVER` / `R_MANEUVER`):
- Moves ALL of the country's fleets and armies
- Each unit can: move normally, declare war, make peace, or blow up factories
- See "Maneuver System" section below

### Investor Passing

After executing any wheel action, the game checks if the Investor slot was "passed" on the rondel (the country moved past or onto the Investor position). If so:
- Mode changes to `buy`
- The investor card holder gets $2 bonus and takes their turn first
- All players with swiss banking also get to buy

---

## Stock Ownership & Leadership

### Stock Purchase Mechanics

- Stocks have denominations (1-8 typically) with escalating costs from `stockCosts` array
- Players can buy AND return a stock in the same transaction (upgrade)
- Stock of denomination 0 is a sentinel meaning "no stock / nothing returned"
- When buying: stock is removed from `countryInfo.availStock`, money goes from player to country
- When returning: reverse (but denomination 0 stocks are not returned to the pool)

### Leadership Determination

After every stock purchase, `changeLeadership()` recalculates:
1. Sum each player's stock denominations for that country
2. Sort players by stock total (descending)
3. `leadership[0]` = leader (most stock)
4. `leadership[1]` = opposition (second most)

### Government Type

- **Dictatorship**: `leadership[0]` owns >= 50% of total stock by denomination
  - Only the leader proposes; proposal executes immediately
- **Democracy**: No player owns >= 50%
  - Leader proposes → Opposition counter-proposes → All stockholders vote
  - Leader gets a +0.1 tiebreak bonus in voting

---

## Maneuver System

Maneuvers move a country's military units **one at a time** in a step-by-step interactive flow. Each unit's movement generates a ManeuverTuple: `[origin, destination, actionCode]`.

### Step-by-Step Movement (Continue-Man Mode)

When a player selects L-Maneuver or R-Maneuver on the rondel, the game enters `continue-man` mode instead of collecting all moves at once:

1. **Fleet phase first**: Each fleet is presented one at a time. The player selects a destination and action for each.
2. **Army phase second**: After all fleets are done, each army is presented one at a time.
3. **Virtual state**: Moves are tracked in `currentManeuver` but NOT applied to `gameState.countryInfo` until the maneuver is fully complete. Movement options for each unit are computed from the virtual board state (original positions + completed moves).
4. **Completion**: After all units are processed, the full maneuver is assembled with resolved ManeuverTuples and either executed (dictatorship) or stored as a proposal (democracy).

### Peace Vote Mechanics

When a unit declares "peace" entering foreign territory, the target country must vote:

- **Target is dictatorship**: The dictator (leadership[0]) alone votes accept/reject.
- **Target is democracy**: Full stockholder vote among the target country's stockholders, weighted by stock denomination. The target country's leader gets a +0.1 tiebreak bonus. Threshold: `votes > (totalStock + 0.01) / 2.0`.
- **If accepted**: ManeuverTuple action stays `"peace"` (unit enters with `hostile: false`).
- **If rejected**: ManeuverTuple action becomes `"war {targetCountry} {unitType}"` (both units destroyed).
- The proposing country never votes on its own peace offers.
- Peace votes happen during proposal **building**, before the proposal enters the democracy flow.

### Mode Transitions for Maneuvers

```
proposal → (select L/R-Maneuver) → continue-man

During continue-man:
  (move unit, no conflict) → continue-man (next unit)
  (unit peace to dictatorship target) → dictator sees accept/reject in continue-man
  (unit peace to democracy target) → peace-vote mode → stockholders vote → continue-man
  (all fleets done) → switch to army phase → continue-man
  (all units done, dictatorship) → executeProposal → buy/next
  (all units done, democracy leader) → store proposal 1 → proposal-opp
  (all units done, democracy opposition) → store proposal 2 → vote
```

### Action Codes

| Code | Meaning | Effect |
|------|---------|--------|
| `""` (empty) | Normal move | Unit moves. Places tax chip on neutral territory. |
| `"peace"` | Peaceful entry | Army enters foreign territory non-hostilely (`hostile: false`). Triggers peace vote. |
| `"hostile"` | Hostile entry | Army enters foreign territory hostilely |
| `"war {country} {unitType}"` | Attack | Destroys one enemy unit at the destination. Attacking unit is also removed. |
| `"blow up {country}"` | Destroy factory | Army destroys a factory at the destination. Army is removed. |

### Processing Order (executeProposal)

When the maneuver proposal is finally executed (after all moves collected and proposal accepted):

1. **Fleets first**: All fleets are moved/resolved before armies
2. **Armies sorted**: Sorted by action code (wars processed before peaceful moves)
3. **Tax chips**: When a unit enters a neutral territory (not belonging to any country), removes any other country's tax chip there and places the moving country's tax chip
4. **Wars**: The attacking unit AND the target unit are both removed
5. **Factory destruction**: The army is removed and the factory is removed from the target country

### Fleet vs Army Movement

- **Fleets** move between sea territories and ports. Movement options come from adjacencies.
- **Armies** can reach any land territory connected through friendly territory and/or friendly fleets (fleets that moved to `"peace"` provide sea transport). Uses BFS in `getD0()` and `getAdjacentLands()`.
- During step-by-step mode, `getCurrentUnitOptions()` computes destinations from the virtual board state (accounting for completed moves).

---

## Swiss Banking

"Swiss banking" is the mechanism where uninvolved players get a free buy opportunity during the Investor round.

### Who Gets Swiss Banking

**Permanent Swiss** (`getPermSwiss()` in helper.js): Players who do NOT lead or oppose ANY country with stock. These players are not involved in any country's governance, so they get to buy every investor round.

**Temporary Swiss** (Punt Buy): During a `buy` round, a player can choose "Punt Buy" instead of buying stock. This adds them to `swissSet` for a later buy opportunity within the same investor round.

### Swiss Buy Order

Swiss buys happen in reverse player order (scanning backwards from the current buyer). Each swiss player gets one buy action, then the round ends.

---

## Scoring System

### Victory Points (Country)

- Countries earn points through Taxation
- Points = `taxChips + 2 * unsatFactories` (capped at 15 per tax event)
- Actual VP gained = `max(points - 5, 0)`
- First country to 25 points triggers game over

### Player Score

```
Score = sum(floor(countryPoints / 5) * stockDenomination) + cash + scoreModifier
```

For each stock a player owns:
- Look up the country's current points
- `floor(points / 5)` gives a multiplier (0-5)
- Multiply by the stock denomination

Add the player's cash on hand and any score modifier (e.g. -1 per timer violation).

The player with the highest score wins.

---

## Timer System

Optional chess-clock style timer with increment and banking.

- Each player has `banked` time (seconds)
- Each turn has an `increment` (seconds added after your move)
- After your turn: `remaining = banked - elapsed + increment` (capped at previous banked)
- If remaining < 0: lose 1 point, banked resets to 60 seconds
- Game can be paused/unpaused (sets `timer.pause` to server timestamp or 0)

---

## Undo System

- After each turn, the previous state is saved to `game histories/{gameID}/{turnID}`
- `gameState.undo` stores the name of the player who last submitted
- Only that player can undo (checked by `turnAPI.undoable()`)
- Undo restores the previous state and removes the history entry
- Only one level of undo is supported (can't undo twice in a row)

---

## Email Notifications

After each turn submission (`finalizeSubmit`), the system sends email notifications via EmailJS to all players whose `myTurn` is now true AND who have an email address configured. This notifies players when it's their turn.
