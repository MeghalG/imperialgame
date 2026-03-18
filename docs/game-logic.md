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

When a player selects L-Maneuver or R-Maneuver on the rondel, the game moves **all** of the country's fleets and armies. Each unit's movement is encoded as a ManeuverTuple: `[origin, destination, actionCode]`.

There are two submission paths:

| Path | Mode | UI | Code |
|------|------|----|------|
| **Batch** | `continue-man` with ManeuverPlanProvider | Map-based planner: assign all moves, then submit once | `submitBatchManeuver()` |
| **Step-by-step** | `continue-man` with ContinueManeuverApp | Dropdown per unit, submit one at a time | `submitManeuver()` |

Both paths produce the same ManeuverTuples and feed into the same execution logic. The batch path is the default UI; step-by-step is the legacy fallback.

### Entering a Maneuver (`enterManeuver`)

Called from `submitProposal()` or `submitNoCounter()` when a player selects L/R-Maneuver.

1. Snapshot the country's current fleets and armies into `currentManeuver.pendingFleets` / `pendingArmies` (deep copy).
2. Set `phase: 'fleet'` if fleets exist, else `phase: 'army'`. Set `unitIndex: 0`.
3. Determine `returnMode` and `proposalSlot` based on government type and who is proposing:
   - **Dictatorship**: `returnMode = 'execute'`, `proposalSlot = 0` (execute immediately after all moves)
   - **Democracy, leader proposing** (mode was `proposal`): `returnMode = 'proposal-opp'`, `proposalSlot = 1`
   - **Democracy, opposition proposing** (mode was `proposal-opp`): `returnMode = 'vote'`, `proposalSlot = 2`
4. Set `gameState.mode = 'continue-man'`. Only the proposing player's `myTurn` is true.
5. **Edge case**: If the country has zero fleets and zero armies, skip directly to `completeManeuver()`.

### Phase Order

Maneuvers always process in this order:

1. **Fleet phase**: All fleets are assigned destinations and actions.
2. **Army phase**: All armies are assigned destinations and actions.

The fleet phase must complete before armies begin, because army movement depends on where fleets end up (fleets provide sea transport for armies).

### Movement Rules

#### Fleet Movement

Fleets move between **sea territories and ports**. Legal destinations are the direct adjacencies of the fleet's current territory, as defined in the territory setup.

- Source: `proposalAPI.getFleetOptions()` → calls `getAdjacentSeas(territory, territorySetup)`.
- Each fleet gets a list of adjacent sea/port territories it can move to.
- A fleet may also stay at its current territory (destination = origin).

#### Army Movement

Armies can reach any **land territory** connected through:
1. **Home territory chains**: Connected sequences of territories belonging to the army's country, where both the source and destination of each step belong to that country.
2. **Friendly-fleet-controlled seas**: A sea territory counts as passable if one of the country's fleets is moving there with action `""` (normal move) or `"peace"`. This lets armies cross seas via naval transport.

The reachable set is computed in two steps:

1. **`getD0(territory)`** — BFS from the army's position. Expands through:
   - Adjacent territories where both sides of the border belong to the army's country.
   - Adjacent sea territories where a friendly fleet is moving (action is `""` or `"peace"`).
   - Result: the "distance-0" connected zone.

2. **`getAdjacentLands(territory)`** — From every territory in the D0 set, expand one more step outward (including through seas reachable from those territories), then filter to land-only. Deduplicate.

- Source: `proposalAPI.getArmyOptions()`.
- **Constraint**: Armies cannot move to sea territories. Validated in `submitManeuver()` / `_submitBatchManeuverLocal()`.

#### Staying in Place

A unit may stay at its current territory. In this case `destination === origin`, and no action is needed (the action code is `""`).

### Action Codes (ManeuverTuple[2])

The third element of every ManeuverTuple encodes what happens when the unit arrives:

| Code | Name | Applies to | What happens |
|------|------|-----------|--------------|
| `""` (empty string) | Normal move | Fleet or Army | Unit moves to destination. If destination is a neutral territory (not belonging to any country), removes all other countries' tax chips there and places the moving country's tax chip. |
| `"peace"` | Peaceful entry | Fleet or Army | Unit enters foreign territory non-hostilely (`hostile: false` on the unit object). Triggers a peace vote (see below). Only meaningful when destination belongs to another country AND enemy units are present there. |
| `"hostile"` | Hostile entry | Fleet or Army | Unit enters foreign territory hostilely (`hostile: true`). Used as the fallback when a peace vote is rejected but no enemy unit exists to destroy. |
| `"war {country} {unitType}"` | War / Attack | Fleet or Army | Destroys one enemy unit of the specified type at the destination. The attacking unit is also destroyed (mutual destruction). Example: `"war France fleet"`. |
| `"blow up {country}"` | Destroy factory | Army only | Destroys one factory belonging to `{country}` at the destination. The army that blows up the factory is destroyed. Two additional friendly armies at the same territory are also consumed (3 armies total destroyed per blow-up). Example: `"blow up Austria"`. |

#### When Actions Are Required

A unit needs an action code (war/peace/hostile) when **all** of these are true:
1. The destination belongs to a different country than the moving country.
2. There are hostile enemy units at the destination (fleets or armies with `hostile: true` from any country other than the moving country).
3. The destination is different from the origin (the unit is actually entering the territory, not staying).

If any condition is false, the action code is `""` (normal move).

"Blow up" is available when: an army enters a territory with an enemy factory AND the moving country has at least 3 armies at that territory (including the blowing-up army itself, after all moves resolve).

### Peace Vote System

Peace votes happen **during maneuver planning**, before the maneuver proposal enters the democracy flow. They interrupt the maneuver to ask the target country whether to accept or reject a peaceful entry.

#### Trigger Conditions

A peace vote is triggered when ALL of these are true:
1. The unit's action code starts with `"peace"`.
2. `destination !== origin` (the unit is actually moving).
3. The destination territory belongs to another country (`destCountry !== movingCountry`).
4. There are enemy units at the destination (from any country other than the moving country).

In the batch path, destroyed units from earlier war moves in the same batch are tracked in a `destroyedUnits` set and excluded from the enemy unit check. This prevents spurious peace votes when a prior move in the batch already destroyed all enemies at that territory.

#### Dictatorship Peace Vote

When the target country is a dictatorship:

1. `currentManeuver.pendingPeace` is set with the peace offer details (origin, destination, targetCountry, unitType, tuple).
2. Only the dictator (target country's `leadership[0]`) has `myTurn = true`.
3. The mode stays `continue-man` — the dictator sees accept/reject buttons inline.
4. The dictator submits via `submitDictatorPeaceVote(context)`.

**If accepted**: The tuple's action stays `"peace"`. History: `"{dictator} accepts the peace offer from {country} at {destination}."`.

**If rejected**: The code finds the first enemy unit at the destination:
- If an enemy unit exists → tuple becomes `"war {targetCountry} {unitType}"` (mutual destruction).
- If no enemy unit exists (edge case) → tuple becomes `"hostile"`.
- History: `"{dictator} rejects the peace offer from {country} at {destination}."`.

After the dictator decides, `unitIndex` advances and control returns to the proposer.

#### Democracy Peace Vote

When the target country is a democracy:

1. `gameState.peaceVote` is set with: `movingCountry`, `targetCountry`, `unitType`, `origin`, `destination`, `acceptVotes: 0`, `rejectVotes: 0`, `voters: []`, `totalStock`, `tuple`.
2. `totalStock` = sum of all stockholders' stock denominations for the target country.
3. Mode changes to `peace-vote`. All of the target country's leadership (stockholders) have `myTurn = true`.
4. Each stockholder submits via `submitPeaceVote(context)`.

**Vote weight**: Each voter's weight = sum of their stock denominations for the target country. The target country's leader (`leadership[0]`) gets a +0.1 tiebreak bonus added to their weight.

**Threshold**: `votes > (totalStock + 0.01) / 2.0`. This means a strict majority is needed, with the +0.01 ensuring that exactly 50% is not enough.

**If accepted** (acceptVotes > threshold): Tuple action stays `"peace"`. History logged. `peaceVote` is cleared, mode returns to `continue-man`, `unitIndex` advances, control returns to proposer.

**If rejected** (rejectVotes > threshold): Same logic as dictatorship rejection — finds enemy unit, converts to war or hostile. `peaceVote` is cleared, mode returns to `continue-man`, `unitIndex` advances, control returns to proposer.

**If neither threshold reached**: More votes needed. Stay in `peace-vote` mode.

#### Batch Path Peace Interruption

In the batch submission path (`submitBatchManeuver`), if a peace vote is triggered at move index N:

1. Moves 0 through N-1 are committed to `completedFleetMoves`/`completedArmyMoves`.
2. Move N triggers the peace vote (dictatorship pendingPeace or democracy peace-vote mode).
3. Remaining moves (N+1 onward) are stored in `cm.remainingFleetPlans` / `cm.remainingArmyPlans`.
4. The batch function calls `finalizeSubmit()` and returns — the batch is split.
5. After the peace vote resolves, the ManeuverPlanProvider reloads and pre-populates the remaining plans from `cm.remainingFleetPlans`/`cm.remainingArmyPlans`.

### Completing a Maneuver (`completeManeuver`)

Called when all units in both phases have been processed (unitIndex >= pendingArmies.length while in army phase).

1. Assembles `fullContext` with `fleetMan = cm.completedFleetMoves`, `armyMan = cm.completedArmyMoves`.
2. Routes based on `cm.returnMode`:

| `returnMode` | What happens |
|---|---|
| `'execute'` | Dictatorship: calls `executeProposal()` immediately. Maneuver takes effect now. |
| `'proposal-opp'` | Democracy leader: serializes context into `gameState['proposal 1']` via `stringifyFunctions()`. Adds history entry. Sets mode to `proposal-opp`. Gives turn to opposition. |
| `'vote'` | Democracy opposition: serializes context into `gameState['proposal 2']`. Adds history entry. Sets mode to `vote`. Sets up `gameState.voting` with both proposals. All leadership stockholders get `myTurn = true`. |

3. Clears `gameState.currentManeuver = null`.

### Execution (`executeProposal`, L/R-Maneuver case)

When the maneuver proposal is finally executed (after democracy vote resolves, or immediately for dictatorship):

#### Fleet Execution (processed first)

For each fleet tuple in order:

1. **War**: If action starts with `"war"`, parse target country and unit type. Find the first matching enemy unit at the destination and remove it from `gameState.countryInfo`. The attacking fleet is NOT added to the new fleet list (consumed). **Skip to next tuple.**
2. **Tax chips** (normal move, action is `""`): Remove all other countries' tax chips at the destination. If the destination is a neutral territory (no owning country), place the moving country's tax chip there.
3. **Add fleet**: Add `{ territory: destination, hostile: true }` to the new fleet list.

After all fleet tuples: replace `gameState.countryInfo[country].fleets` with the new list. Note: all surviving fleets are set to `hostile: true` regardless of action code. (Peace/hostile distinction only applies to armies.)

#### Army Execution (processed second)

**Pre-sort**: Army tuples are sorted by action code character value, descending. This means:
- `"war ..."` (starts with 'w', charCode 119) executes first
- `"blow up ..."` (starts with 'b', charCode 98) executes second
- `"peace"` (starts with 'p', charCode 112) executes third
- `"hostile"` (starts with 'h', charCode 104) executes fourth
- `""` (charCode 0) executes last

This ordering ensures destroyed units are removed before peaceful/hostile entries are placed, preventing conflicts.

For each army tuple (in sorted order):

1. **Blow-up consumption check**: If a previous blow-up at this territory consumed this army (3 armies destroyed per blow-up), skip this tuple.
2. **War**: Parse target country and unit type. Find and remove the first matching enemy unit. The attacking army is consumed. **Skip to next tuple.**
3. **Tax chips** (normal move, action is `""`): Same as fleets — clear other countries' chips, place own chip on neutral territory.
4. **Peace**: If action is `"peace"` and destination belongs to a foreign country, set `hostile = false`. Otherwise `hostile = true`.
5. **Blow up**: If action starts with `"blow"`, find and remove the factory from the target country. The army is consumed. Mark 2 more armies at this territory for consumption (`blowUpConsumed`). **Skip to next tuple.**
6. **Add army**: Add `{ territory: destination, hostile: hostile }` to the new army list.

After all army tuples: replace `gameState.countryInfo[country].armies` with the new list.

### Mode Transitions for Maneuvers

```
proposal ─── (select L/R-Maneuver) ──→ continue-man
proposal-opp (select L/R-Maneuver) ──→ continue-man

During continue-man (step-by-step path):
  (move unit, no conflict)              → continue-man (next unit)
  (unit peace to dictatorship target)   → dictator sees accept/reject in continue-man
  (unit peace to democracy target)      → peace-vote mode → stockholders vote → continue-man
  (all fleets done)                     → switch to army phase → continue-man
  (all units done, dictatorship)        → executeProposal → buy/next
  (all units done, democracy leader)    → store proposal 1 → proposal-opp
  (all units done, democracy opposition)→ store proposal 2 → vote

During continue-man (batch path):
  (no peace votes in entire batch)      → completeManeuver → same as "all units done" above
  (peace vote triggered at move N)      → commit moves 0..N-1, store remaining plans,
                                          trigger peace vote (dict or democracy),
                                          after resolution → ManeuverPlanProvider reloads
                                          with remaining plans
```

### Firebase Data Model During Maneuvers

**`gameState.currentManeuver`** (exists only during `continue-man`):

| Field | Type | Description |
|-------|------|-------------|
| `country` | string | Country being maneuvered |
| `player` | string | Player who is building the proposal |
| `wheelSpot` | string | `"L-Maneuver"` or `"R-Maneuver"` |
| `phase` | `"fleet"` or `"army"` | Current phase |
| `unitIndex` | number | Index into pendingFleets or pendingArmies |
| `pendingFleets` | FleetUnit[] | Snapshot of original fleet positions |
| `pendingArmies` | ArmyUnit[] | Snapshot of original army positions |
| `completedFleetMoves` | ManeuverTuple[] | Resolved fleet tuples so far |
| `completedArmyMoves` | ManeuverTuple[] | Resolved army tuples so far |
| `returnMode` | string | `"execute"`, `"proposal-opp"`, or `"vote"` |
| `proposalSlot` | number | 0 (execute), 1 (leader proposal), or 2 (opposition proposal) |
| `pendingPeace` | object or null | Dictatorship peace vote info (origin, destination, targetCountry, unitType, tuple) |
| `remainingFleetPlans` | ManeuverTuple[] or undefined | Remaining fleet plans after a batch peace interruption |
| `remainingArmyPlans` | ManeuverTuple[] or undefined | Remaining army plans after a batch peace interruption |

**`gameState.peaceVote`** (exists only during `peace-vote` mode):

| Field | Type | Description |
|-------|------|-------------|
| `movingCountry` | string | Country whose unit is requesting peace |
| `targetCountry` | string | Country being asked to accept peace |
| `unitType` | `"fleet"` or `"army"` | Type of the moving unit |
| `origin` | string | Territory the unit is moving from |
| `destination` | string | Territory the unit is entering |
| `acceptVotes` | number | Weighted accept votes so far |
| `rejectVotes` | number | Weighted reject votes so far |
| `voters` | string[] | Players who have already voted |
| `totalStock` | number | Total stock denominations across all stockholders |
| `tuple` | ManeuverTuple | The original tuple (may be rewritten on rejection) |

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
