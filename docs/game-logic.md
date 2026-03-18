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
| `continue-man` | `continue-man` | Unit moved, more units remain | `submitBatchManeuver()` |
| `continue-man` | `peace-vote` | Peace offer to democracy target | `submitBatchManeuver()` |
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
- Each unit can: move (normal), war (mutual destruction), peace (coexist), hostile (block territory), or blow up factories
- See "Maneuver System" section below for full rules

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

When a player selects L-Maneuver or R-Maneuver on the rondel, the game moves **all** of the country's fleets and armies. Each unit's movement is encoded as a ManeuverTuple: `[origin, destination, actionCode]`. All moves are planned and submitted as a single batch.

### 1. Definitions

#### 1.1 Territory Types

- **Home territory**: A land territory that belongs to a specific country in the board setup (`territorySetup[t].country` is set). Example: Vienna is Austria's home territory.
- **Neutral territory**: A land territory with no owning country (`territorySetup[t].country` is falsy). Can have tax chips placed by visiting units.
- **Sea territory**: A water territory (`territorySetup[t].sea === true`). Fleets move here. Armies cannot occupy seas.
- **Port territory**: A home territory that has a `port` field pointing to an adjacent sea. Fleets spawn at ports and move out to sea on their first move.

#### 1.2 Unit Types

- **Fleet**: Moves on seas. Starts at a port territory, then moves to sea territories. Cannot return to a port after leaving. All fleets are always in **occupying** state (the distinction is meaningless on seas).
- **Army**: Moves on land. Can be in either **occupying** or **coexisting** state.

#### 1.3 Unit Occupancy State

Every unit has a boolean attribute `hostile`. This spec uses the following terminology:

| Term | `hostile` value | Meaning |
|------|----------------|---------|
| **Occupying** | `true` | Default state. On enemy home territory, the unit **blocks territory functioning** (saturates factories, denies tax chips). On non-home territory, this has no special effect. |
| **Coexisting** | `false` | Only meaningful on enemy home territory. The unit does **not** block territory functioning. On non-home territory, the distinction from occupying is meaningless. |

**Key rules about occupancy state:**
- All fleets are always occupying. Fleets are on seas, never on enemy home territory, so the distinction never applies.
- Armies default to occupying. An army enters coexisting state only when: (a) the peace action was chosen, (b) peace was accepted (vote passed or no vote needed), AND (c) the destination is enemy home territory.
- **Coexisting units automatically accept future peace offers** from the home nation. If a country maneuvers into a territory where the only enemy units present are coexisting units from that country's perspective, no peace vote is triggered. (Note: not yet implemented in code.)
- **Occupying units on enemy home territory cannot be peaced** by the home nation. The home nation must use war to remove them.

#### 1.4 ManeuverTuple

The atomic unit of movement: `[origin, destination, actionCode]`.

- `origin`: Territory name where the unit starts.
- `destination`: Territory name where the unit moves to. Can equal origin (staying in place).
- `actionCode`: A string encoding the action taken on arrival. See Section 3.

#### 1.5 Phases

Every maneuver processes in two phases, always in this order:

1. **Fleet phase**: All fleets are assigned destinations and actions.
2. **Army phase**: All armies are assigned destinations and actions.

The fleet phase must complete before armies begin because army movement depends on where fleets end up (fleets provide sea transport for armies).

### 2. Movement Rules

#### 2.1 Fleet Movement

Fleets move between sea territories. Legal destinations depend on the fleet's current position:

- **Fleet at a port**: Can move to the port's designated sea territory, or stay at the port. Exactly one sea destination. After leaving the port, the fleet cannot return.
- **Fleet at sea**: Can move to any adjacent sea territory (filtered from the territory's adjacency list to include only seas), or stay at the current sea.

Fleets can never move to land territories (ports or otherwise) after their initial port departure.

#### 2.2 Army Movement

Armies move on land territories. The set of reachable destinations is computed via BFS:

**Step 1 — Connected zone (D0):** Starting from the army's current territory, expand through:
- Adjacent territories where **both sides** of the border belong to the army's country (home-to-home connections).
- Adjacent sea territories where a friendly fleet provides **convoy** (see 2.3).

**Step 2 — One step outward:** From every territory in the D0 set, expand one more hop outward (including through conveyed seas reachable from those territories). Filter to land territories only. Deduplicate.

The result is all land territories the army can reach. An army can also stay at its current territory.

**Constraint:** Armies cannot move to sea territories.

#### 2.3 Fleet Convoy (Army Sea Transport)

Armies cannot occupy seas, but they can cross them via fleet transport (convoy).

**Convoy rules:**
1. A sea territory is passable for army movement if a friendly fleet's **destination** is that sea AND the fleet's action is `move` (empty string) or `peace`. Fleets with `war` actions at their destination do NOT provide convoy (the fleet is being destroyed).
2. A fleet staying at its current sea (destination = origin) provides convoy for that sea.
3. **Each fleet can transport at most one army per maneuver.** If two armies need to cross the same sea and only one fleet is there, only one army can cross. Fleet-to-army assignment is a UI concern; the rule is: 1 fleet = 1 army max.

#### 2.4 Staying in Place

A unit may stay at its current territory. In this case, `destination === origin` and the action code is `move` (empty string). No action choice is needed.

### 3. Action Codes

The third element of every ManeuverTuple encodes what happens when the unit arrives. There are five action types.

#### 3.1 Move (empty string `""`)

**Applies to:** Fleet or Army.
**When available:** Always. This is the default when no special action is needed.
**Effect:**
- Unit moves to destination.
- **Tax chip placement** (only on move, not on any other action): Remove all other countries' tax chips at the destination. If the destination is a neutral territory (no owning country), place the moving country's tax chip.
- Unit is set to **occupying** (`hostile: true`).

**Triggers peace vote:** No.

#### 3.2 Peace (`"peace"`)

**Applies to:** Fleet or Army.
**When available:**
- The destination has enemy units (hostile units from any other country), OR
- The destination is enemy home territory with no enemy units (player can choose peace or hostile).

**Effect:**
- "I propose to coexist with enemy units here without mutual destruction."
- If enemy units are present at the destination: **triggers a peace vote** (see Section 5).
- If no enemy units are present (entering empty enemy home territory): no vote needed.
- **Resulting occupancy state** after acceptance:
  - If destination is enemy home territory: army becomes **coexisting** (`hostile: false`).
  - If destination is NOT enemy home territory (e.g., a sea for fleets, or neutral land): unit stays **occupying** (`hostile: true`). The distinction is meaningless here.
- **No tax chips** are placed on peace moves.

**Triggers peace vote:** Yes, if enemy units are present. No, if entering empty enemy home territory.

#### 3.3 Hostile (`"hostile"`)

**Applies to:** Army only.
**When available:** The destination is enemy home territory AND:
- No enemy units remain at the destination. If enemies are present, they must be cleared first via `war` actions from other units in the same plan. The UI must enforce this.
- The territory is NOT the target country's last operational factory (see 3.5 for "operational" definition).

Hostile is also available as a choice (alongside peace) when entering **empty** enemy home territory.

**Effect:**
- Unit enters as **occupying** (`hostile: true`), blocking the territory's functioning (saturates factories, denies tax chips to the home country).
- **No tax chips** are placed on hostile moves.

**Triggers peace vote:** No.

**Critical constraint:** The home nation cannot use `peace` against occupying units on their home territory. They must use `war` to remove them.

#### 3.4 War (`"war {country} {unitType}"`)

**Applies to:** Fleet or Army.
**When available:** Enemy units of the specified type and country exist at the destination.

When multiple enemy unit types or countries are present, the player chooses which specific `{country} {unitType}` combination to target. Example: `"war Austria fleet"` or `"war Italy army"`.

**Effect:**
- **Mutual destruction**: The attacking unit and one enemy unit of the specified type are both removed from the game.
- The attacker is consumed (not placed at the destination).
- One matching enemy unit is removed.
- **No tax chips** are placed on war moves.

**Same-type disambiguation:** If multiple units of the same country and type exist at the destination, they are indistinguishable. The first match is removed.

**Triggers peace vote:** No.

#### 3.5 Blow Up (`"blow up {country}"`)

**Applies to:** Army only.
**When available:** All of the following must be true:
1. The destination has a factory belonging to `{country}`.
2. The target country has **more than 1 operational factory**. An "operational" factory is one that is NOT occupied by a hostile army from another country. If a hostile army sits on a factory, that factory is "saturated" and non-operational. The blow-up action cannot destroy a country's last operational factory.
3. After all moves in the plan resolve, at least **3 friendly armies** will be at the destination (including the blowing-up army itself).

**Effect:**
- The factory is destroyed (removed from the target country's factory list).
- The blowing-up army is consumed (removed from the game).
- **2 additional friendly armies** at the same destination are also consumed (3 total). The consumed armies are auto-selected (see Section 4.2).
- **No tax chips** are placed on blow-up moves.

**Triggers peace vote:** No.

### 4. Execution

When the maneuver proposal is finally executed (immediately for dictatorship, or after the democracy vote resolves), all tuples are applied to the game state.

#### 4.1 Fleet Execution

Fleet tuples are processed **in the order the player arranged them**. For each fleet tuple:

1. **War:** Remove one matching enemy unit at the destination. The attacking fleet is consumed (not added to the new fleet list). Skip to next tuple.
2. **Tax chips** (move action only): Remove other countries' tax chips at the destination. Place the moving country's tax chip on neutral territory.
3. **Add fleet:** Add `{ territory: destination, hostile: true }` to the new fleet list. All surviving fleets are always occupying.

After all fleet tuples: replace the country's fleet list with the new list.

#### 4.2 Army Execution

Army tuples are processed **in the order the player arranged them**. The UI constrains ordering so that dependencies are respected (e.g., wars that clear enemies must come before hostile entries at the same territory).

For each army tuple:

1. **Blow-up consumption check:** If a previous blow-up at this territory consumed this army (see below), skip this tuple.
2. **War:** Remove one matching enemy unit at the destination. The attacking army is consumed. Skip to next tuple.
3. **Blow up:** Remove the factory from the target country. The army is consumed. Mark 2 more armies at this destination for consumption (`blowUpConsumed` counter). Skip to next tuple.
4. **Tax chips** (move action only): Remove other countries' tax chips. Place own chip on neutral territory.
5. **Determine occupancy state:**
   - Peace action + destination is foreign home territory → `hostile: false` (coexisting).
   - All other cases → `hostile: true` (occupying).
6. **Add army:** Add `{ territory: destination, hostile: hostile }` to the new army list.

After all army tuples: replace the country's army list with the new list.

**Blow-up consumption:** When a blow-up occurs at a territory, 2 additional armies at that territory are consumed. The consumed armies are the next 2 in execution order that share the same destination. Their own actions are skipped. If two blow-ups target the same territory, consumption stacks (4 additional armies consumed).

### 5. Peace Vote System

Peace votes happen **during maneuver planning**, before the maneuver enters the democracy proposal flow. They interrupt the maneuver to ask the target country whether to accept or reject a peaceful entry.

#### 5.1 Trigger Conditions

A peace vote is triggered when ALL of these are true:
1. The unit's action code is `peace`.
2. `destination !== origin` (the unit is actually moving).
3. There are **hostile enemy units** at the destination from the target country. (Coexisting units from a nation that already accepted peace do not trigger a new vote — see 5.5.)

#### 5.2 Multiple Countries at Destination

If enemy units from **multiple countries** are present at the destination and the mover chooses peace, a separate peace vote is triggered for each country. The player chooses the **order** of peace votes.

#### 5.3 Dictatorship Peace Vote

When the target country is a dictatorship:

1. `currentManeuver.pendingPeace` is set with the peace offer details.
2. Only the dictator (target country's `leadership[0]`) has `myTurn = true`.
3. The mode stays `continue-man` — the dictator sees accept/reject inline.

**If accepted:** The tuple's action stays `"peace"`. The unit will enter as coexisting (if on enemy home territory) or occupying (otherwise).

**If rejected:** The dictator chooses which of **their own** unit types at the destination to sacrifice for mutual destruction. (This choice only matters when the target country has both armies and fleets at the location; otherwise there's only one option.) The tuple is rewritten to `"war {targetCountry} {unitType}"`.

If no enemy unit exists at the destination after rejection (edge case): tuple becomes `"hostile"`.

#### 5.4 Democracy Peace Vote

When the target country is a democracy:

1. `gameState.peaceVote` is set with vote tracking state.
2. Mode changes to `peace-vote`. All target country stockholders have `myTurn = true`.

**Vote weight:** Each voter's weight = sum of their stock denominations for the target country. The target country's leader (`leadership[0]`) gets a +0.1 tiebreak bonus.

**Threshold:** `votes > (totalStock + 0.01) / 2.0`. Strict majority required — exactly 50% is not enough.

**If accepted** (acceptVotes exceed threshold): Tuple stays `"peace"`. Vote is cleared, mode returns to `continue-man`, unit advances.

**If rejected** (rejectVotes exceed threshold): The target country's stockholders vote on which of their own unit types to sacrifice (if both armies and fleets are present; otherwise the only available type is used). Tuple is rewritten to war. Vote is cleared, mode returns to `continue-man`.

**If neither threshold reached:** More votes needed. Stay in `peace-vote` mode.

#### 5.5 Auto-Accept Rule

If the only enemy units at the destination are **coexisting** units (hostile = false) from the same nation as the mover, no peace vote is triggered. The peace is automatically accepted. This represents units that have already established a peaceful presence — they don't get a say in rejecting further peaceful entries.

(Note: this rule is not yet implemented in code.)

#### 5.6 Batch Path Peace Interruption

When using batch submission, if a peace vote is triggered at move index N:

1. Moves 0 through N-1 are committed to `completedFleetMoves` / `completedArmyMoves`.
2. Move N triggers the peace vote.
3. Remaining moves (N+1 onward) are stored in `remainingFleetPlans` / `remainingArmyPlans`.
4. `finalizeSubmit()` is called — the batch is split.
5. After the peace vote resolves, the remaining plans are reloaded and the player can adjust if needed (board state may have changed due to war-on-rejection).

### 6. Action Decision Tree

When a unit moves to a destination, the available actions depend on the situation:

```
Unit moves to destination:
│
├─ destination === origin (staying in place)
│   └─ Action: move (""). No choice needed.
│
├─ destination is own-country territory or neutral territory
│   ├─ No enemy units present
│   │   └─ Action: move (""). No choice needed.
│   └─ Enemy units present
│       └─ Choose: war (pick target) or peace (triggers vote)
│
├─ destination is enemy home territory
│   ├─ Enemy units present
│   │   └─ Choose: war (pick target), peace (triggers vote),
│   │      or blow up (if conditions in 3.5 met)
│   │   └─ hostile is NOT available while enemy units remain
│   └─ No enemy units present
│       └─ Choose: hostile (block territory) or peace (coexist, no vote)
│
└─ destination is sea territory
    ├─ (only fleets can be here)
    ├─ Enemy fleets present
    │   └─ Choose: war (pick target) or peace (triggers vote)
    └─ No enemy fleets present
        └─ Action: move (""). No choice needed.
```

**Blow up** is additionally available at any enemy home territory with an enemy factory, provided the conditions in Section 3.5 are met.

### 7. Entering a Maneuver (`enterManeuver`)

Called from `submitProposal()` when a player selects L-Maneuver or R-Maneuver.

1. Snapshot the country's current fleets and armies into `currentManeuver.pendingFleets` / `pendingArmies`.
2. Set `phase: 'fleet'` if fleets exist, else `phase: 'army'`.
3. Determine `returnMode` and `proposalSlot` based on government type:
   - **Dictatorship:** `returnMode = 'execute'`, `proposalSlot = 0`
   - **Democracy, leader proposing:** `returnMode = 'proposal-opp'`, `proposalSlot = 1`
   - **Democracy, opposition proposing:** `returnMode = 'vote'`, `proposalSlot = 2`
4. Set `gameState.mode = 'continue-man'`. Only the proposing player's `myTurn` is true.
5. **Edge case:** If the country has zero fleets and zero armies, skip directly to `completeManeuver()`.

### 8. Completing a Maneuver (`completeManeuver`)

Called when all units in both phases have been assigned moves.

1. Assemble context with `fleetMan` = completed fleet moves, `armyMan` = completed army moves.
2. Route based on `returnMode`:

| `returnMode` | What happens |
|---|---|
| `'execute'` | Dictatorship: calls `executeProposal()` immediately. |
| `'proposal-opp'` | Democracy leader: serializes context into `gameState['proposal 1']`. Sets mode to `proposal-opp`. |
| `'vote'` | Democracy opposition: serializes context into `gameState['proposal 2']`. Sets mode to `vote`. |

3. Clear `gameState.currentManeuver = null`.

### 9. Mode Transitions

```
proposal ─── (select L/R-Maneuver) ──→ continue-man
proposal-opp (select L/R-Maneuver) ──→ continue-man

During continue-man:
  (no peace votes in entire batch)      → completeManeuver
  (peace vote triggered at move N)      → commit moves 0..N-1, store remaining plans,
                                          trigger peace vote (dict or democracy),
                                          after resolution → reload remaining plans

After completeManeuver:
  (dictatorship)                        → executeProposal → buy/next country
  (democracy leader)                    → store proposal 1 → proposal-opp
  (democracy opposition)               → store proposal 2 → vote
```

### 10. Firebase Data Model During Maneuvers

**`gameState.currentManeuver`** (present only during `continue-man` mode):

| Field | Type | Description |
|-------|------|-------------|
| `country` | string | Country being maneuvered |
| `player` | string | Player building the proposal |
| `wheelSpot` | string | `"L-Maneuver"` or `"R-Maneuver"` |
| `phase` | `"fleet"` or `"army"` | Current phase |
| `unitIndex` | number | Index into pendingFleets or pendingArmies |
| `pendingFleets` | FleetUnit[] | Snapshot of original fleet positions |
| `pendingArmies` | ArmyUnit[] | Snapshot of original army positions |
| `completedFleetMoves` | ManeuverTuple[] | Resolved fleet tuples so far |
| `completedArmyMoves` | ManeuverTuple[] | Resolved army tuples so far |
| `returnMode` | string | `"execute"`, `"proposal-opp"`, or `"vote"` |
| `proposalSlot` | number | 0, 1, or 2 |
| `pendingPeace` | object or null | Dictatorship peace vote info |
| `remainingFleetPlans` | ManeuverTuple[] or undefined | Remaining fleet plans after batch peace interruption |
| `remainingArmyPlans` | ManeuverTuple[] or undefined | Remaining army plans after batch peace interruption |

**`gameState.peaceVote`** (present only during `peace-vote` mode):

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
