# Maneuver UI Interaction Spec

Defines what the player sees and can do at every step of the maneuver planner. This is the **ideal behavior** — where the current code diverges, gaps are marked with `⚠ GAP`.

Cross-reference: `docs/game-logic.md` §1-10 for rules. This doc covers UI only.

---

## Interaction Model

**The map is the primary interaction surface.** The vast majority of maneuver planning happens by clicking territories and units on the map. The form/plan list is a secondary UI that shows the current plan state and provides access to edge-case interactions.

| Interaction | Map (primary) | Form (secondary) |
|------------|:---:|:---:|
| Select a unit | ✓ Click unit marker | ✓ Click row |
| Assign destination | ✓ Click highlighted territory | — |
| Choose action (war/peace/hostile/blow up) | ✓ Action picker popup at click position | ✓ Action dropdown on row |
| Stay in place | ✓ Click origin (gold highlight) | — |
| Reorder unit moves | — | ✓ Arrow buttons / drag handles |
| Remove a move | — | ✓ ✕ button on row |
| Assign convoy fleet | — | ✓ Fleet picker (form only) |
| Choose peace vote order | — | ✓ Reorder picker (form only) |
| Submit / Request Peace | ✓ Floating action button on map | ✓ Button in plan list |
| Accept/reject peace (dictator) | — | ✓ Accept/reject buttons |

Edge-case interactions (convoy assignment, manual reorder, peace vote order) are **form-only** — these are infrequent enough that the map doesn't need dedicated UI for them.

---

## 1. Entering the Maneuver Planner

**Trigger:** Player selects L-Maneuver or R-Maneuver on the rondel (via ProposalApp or ProposalAppOpp).

**What happens:**
1. `enterManeuver()` snapshots all fleets and armies into `currentManeuver`.
2. Mode changes to `continue-man`.
3. ManeuverPlanProvider loads, reads the snapshot, computes initial destination options for all units.
4. The plan list appears (sidebar on desktop, bottom sheet on mobile).
5. All units start as **unassigned** — no destinations, no actions.

**Edge case — zero units:** If the country has no fleets and no armies, skip the planner entirely. `completeManeuver()` is called immediately with empty move arrays.

**Edge case — resuming after peace vote:** If `currentManeuver.remainingFleetPlans` or `remainingArmyPlans` exist, pre-populate the plan list with those saved destinations and actions. The player can adjust them before re-submitting (board state may have changed due to war-on-rejection).

**Edge case — localStorage draft:** If no remaining plans exist but a localStorage draft is found, validate that unit count and origins match the current snapshot. If they match, restore the draft. If not, discard it.

---

## 2. Plan List Layout

```
┌─────────────────────────────────────────┐
│  MANEUVER: Austria L-Maneuver           │
│  ───────────────────────────────────────│
│  Prior completed moves (if any):        │
│  ┊ Fleet 1: Trieste → Adriatic Sea ✓   │
│  ┊ Army 1: Vienna → Budapest ✓         │
│  ┊─────── peace vote resolved ─────────│
│                                         │
│  Progress: 2/4 units assigned           │
│                                         │
│  ── FLEETS ──────────────────────────── │
│  Fleet 2: Adriatic Sea → Ionian Sea  ✓ │
│           [move]              [↑][↓][✕] │
│                                         │
│  ── ARMIES ──────────────────────────── │
│  Army 2: Budapest → (unassigned)        │
│  Army 3: Trieste → Rome         ✓      │
│           [war Italy army]    [↑][↓][✕] │
│           ☮ Request Peace               │
│                                         │
│  [Submit Maneuver]                      │
└─────────────────────────────────────────┘
```

### 2.1 Row States

| State | Appearance | Interactions |
|-------|-----------|-------------|
| **Unassigned** | Origin only, "(unassigned)" label, dimmed | Click to select as active unit → map highlights destinations |
| **Assigned** | Origin → Destination, action badge, green check | Click destination to re-select, reorder buttons, remove button |
| **Locked** | Same as assigned but greyed out, lock icon | No interactions — committed in a prior peace round |
| **Active** | Highlighted border (country color) | Map shows selectable destinations for this unit |

### 2.2 Action Badges

| Action | Badge Color | Label |
|--------|------------|-------|
| Move (empty) | None (default) | — |
| Peace | Green | "Enter peacefully" |
| Hostile | Orange | "Enter as hostile occupier" |
| War | Red | "Declare war on {country} {unit}" |
| Blow up | Dark red | "Destroy {country} factory" |

### 2.3 Reordering

Each assigned row has ↑/↓ buttons (or drag handles if drag-to-reorder is implemented).

**Rules:**
- Fleet rows can only reorder within the fleet section.
- Army rows can only reorder within the army section.
- Reordering triggers cascade recomputation of action options for all affected rows (see §4).
- `⚠ GAP: Drag-to-reorder not yet implemented (P3 TODO). Currently uses arrow buttons.`

### 2.4 Remove Button

Clicking ✕ on an assigned row clears its destination and action, returning it to unassigned.

**Cascade effect:** If this unit's fleet was providing convoy for an army, that army's destination may become unreachable. The provider must recompute destinations for all army rows and clear any that are now invalid.

---

## 3. Destination Selection

### 3.1 Activating a Unit

Click an unassigned row (or click the destination of an assigned row to re-select). The clicked unit becomes the **active unit**.

**Map response:**
- All valid destinations highlight in the country's color.
- The unit's origin highlights in gold.
- Already-planned destinations from other units show dimly.
- Clicking a highlighted territory assigns that destination.

### 3.2 Fleet Destinations

Per rules spec §2.1:
- **Fleet at port:** Origin port + the port's designated sea. Two options.
- **Fleet at sea:** Origin sea + all adjacent seas. Multiple options.
- Fleets can never move to land territories after leaving port.

### 3.3 Army Destinations

Per rules spec §2.2:
- BFS from origin through connected home territories and convoyed seas.
- One hop outward from the connected zone. Filter to land only.
- **Army destinations depend on fleet plans.** A fleet's destination determines which seas provide convoy. This means:
  - Changing a fleet's destination can expand or shrink army destinations.
  - Removing a fleet move can invalidate army moves that relied on that convoy.

### 3.4 Convoy Assignment and Visualization

`⚠ GAP: Not yet implemented.`

**Core principle:** When multiple fleets can provide convoy for a route, the system auto-assigns one. But the assignment is **soft** — it can be reassigned when a later army needs a different fleet. The system treats fleet-army assignments as a constraint-satisfaction problem, not a first-come-first-served lock.

**Example walkthrough — flexible convoy reassignment:**

```
Setup: Italy has Fleet A at Western Med, Fleet B at Ionian Sea.
       Italy has Army 1 at Naples, Army 2 at Rome.
       Tunis is reachable via either Western Med OR Ionian Sea.
       Spain is reachable only via Western Med.
       Greece is reachable only via Ionian Sea.

STEP 1 — Army 1 assigned: Naples → Tunis
  System needs a fleet to convoy through one sea.
  Both Fleet A (Western Med) and Fleet B (Ionian) could work.
  System auto-assigns Fleet A (Western Med) arbitrarily.
  Map: Dotted transport line Naples → Western Med → Tunis
       Fleet A highlighted as carrying Army 1.

STEP 2 — Player assigns Army 2: Rome → ???
  Army 2's destination options must consider fleet availability:
  - Spain (requires Western Med): Fleet A is currently assigned to Army 1,
    BUT if the system reassigns Fleet B (Ionian) to Army 1 instead,
    Fleet A becomes free for Army 2 → Spain.
    → Spain IS available (system can reshuffle).
  - Greece (requires Ionian): Fleet B is free → Greece IS available.
  - Tunis: BOTH fleets are needed (Army 1 already going there via one,
    Army 2 would need the other) → Tunis IS available.

  The key insight: When computing Army 2's destinations, the system must
  check if ANY valid fleet assignment exists that satisfies BOTH Army 1
  and Army 2's convoy needs simultaneously, not just whether the
  currently-assigned fleet is free.

STEP 2A — Army 2 picks Spain (requires Western Med)
  System detects: Fleet A is assigned to Army 1 for Tunis, but Fleet B
  can also carry Army 1 to Tunis via Ionian. REASSIGN:
    Fleet B → Army 1 (Naples → Ionian → Tunis)
    Fleet A → Army 2 (Rome → Western Med → Spain)
  Map updates: Both dotted transport lines redraw with new fleet assignments.

STEP 2B — Army 2 picks Greece (requires Ionian)
  Fleet B is free (not needed by Army 1). Simple assignment:
    Fleet A → Army 1 (stays at Western Med → Tunis)
    Fleet B → Army 2 (Rome → Ionian → Greece)
  No reassignment needed.
```

**Constraint-satisfaction algorithm (conceptual):**
1. For each army with a convoy destination, identify which fleets COULD provide the convoy.
2. Find any valid assignment of fleets to armies where each fleet carries at most 1 army.
3. If no valid assignment exists, the destination is not available.
4. When computing a new army's destinations, check if adding each candidate destination still allows a valid global assignment.

**Override:** The form UI provides a fleet picker for manual convoy assignment (form-only interaction). The map always shows the current auto-assignment.

**Visualization:**
- Dotted transport line from army origin, through the conveying fleet's sea, to army destination.
- The conveying fleet is visually linked to the army (matching color highlight).
- When reassignment happens (dotted lines redraw), a brief animation shows the swap.

### 3.5 Staying in Place

Clicking the unit's origin territory (which is always highlighted in gold) assigns `destination = origin` with action `""` (move). No action picker appears.

---

## 4. Action Selection

### 4.1 Auto-Assignment

When a destination is selected, the provider computes available actions (per rules spec §6 decision tree):

| Situation | Actions offered | Auto-assign? |
|-----------|----------------|-------------|
| Staying in place | `move` only | Yes — no picker |
| Own/neutral territory, no enemies | `move` only | Yes — no picker |
| Own/neutral territory, enemies present | `war` targets + `peace` | No — show picker |
| Enemy home, enemies present | `war` targets + `peace` + `blow up` (if eligible) | No — show picker |
| Enemy home, no enemies | `peace` + `hostile` | No — show picker |
| Sea, no enemy fleets | `move` only | Yes — no picker |
| Sea, enemy fleets present | `war` targets + `peace` | No — show picker |

**When only one action exists:** Auto-assign it, no picker shown.

### 4.2 Action Picker (Map-Primary)

When multiple actions are available, a popup appears at the click position on the map:

```
┌─────────────────────────────┐
│  Choose action at Rome:     │
│                             │
│  ■ Declare war on Italy army│  ← red
│  ■ Declare war on Italy fleet│ ← red
│  ■ Enter peacefully         │  ← green
│  ■ Destroy Italy factory    │  ← dark red
└─────────────────────────────┘
```

**Behavior:**
- Click an action → assigns it, closes picker, auto-advances to next unassigned unit.
- Click outside / press Escape → dismisses picker, keeps the default action (first war option if available, otherwise first option).
- `⚠ GAP: No keyboard navigation in the action picker.`

### 4.3 Hostile Availability

Per rules spec §3.3, hostile is available ONLY when:
1. Destination is enemy home territory, AND
2. No enemy units remain at that destination **after accounting for war actions from earlier units in the current plan**.

The UI must compute a **virtual board state** that applies all planned war moves above the current row. If earlier rows declare war on all enemies at a territory, hostile becomes available for later rows targeting that territory.

`⚠ GAP: Current code (getArmyPeaceOptions / getUnitActionOptionsFromPlans) offers hostile without checking if earlier war moves in the plan clear enemies. P2 TODO.`

### 4.4 Blow-Up Availability

Per rules spec §3.5, blow up requires:
1. Enemy factory at destination.
2. Target country has >1 operational factory (accounting for hostile armies in virtual state).
3. At least 3 friendly armies at destination after all moves resolve.

The "3 armies" check must look at the **entire plan** — count how many friendly armies have this territory as their destination. This is a forward-looking check.

### 4.5 Cascade Recomputation

When any row changes (destination assigned, removed, or reordered), the provider must:
1. Recompute destinations for all army rows (fleet destinations affect convoy).
2. Recompute action options for all rows at or below the changed index.
3. Clear any row whose destination is no longer reachable.
4. Recalculate peace vote flags for all rows.
5. Revalidate blow-up eligibility (army count at destination may have changed).

This is the most performance-sensitive operation — it runs on every user interaction.

---

## 5. Peace Vote Flow

### 5.1 Peace Detection in the Plan List

When a row's action is `peace` AND the destination has hostile enemy units (in the virtual state), the row is flagged with `peaceVote: true`.

**Visual indicator:** Orange left border on the row. An inline "☮ Request Peace" button appears below the action badge.

### 5.2 Submitting with Peace

The plan list has a **peace stop** — the first row (in execution order) with `peaceVote: true`.

**Submit button behavior:**
- If there's a peace stop: button label changes to "☮ Peace: {target country}". Clicking submits all rows up to and including the peace row.
- If no peace stop: button label is "Submit Maneuver". Clicking submits all rows.

**What the submit does when peace is triggered:**
1. Rows before the peace row are committed to `completedFleetMoves` / `completedArmyMoves`.
2. The peace row triggers the vote.
3. Rows after the peace row are stored in `remainingFleetPlans` / `remainingArmyPlans`.
4. Firebase is written. Turn passes to the target country (dictator or stockholders).

### 5.3 Multi-Country Peace

`⚠ GAP: Not yet implemented.`

When the peace row's destination has hostile enemy units from **multiple countries**, the player must choose the order of peace votes:

```
┌─────────────────────────────────────┐
│  Peace vote order at Rome:          │
│                                     │
│  1. [Italy]     ← click to reorder │
│  2. [France]                        │
│  3. [Russia]                        │
│                                     │
│  [Confirm order]                    │
└─────────────────────────────────────┘
```

The order matters strategically: if Italy rejects and destroys your unit in mutual war, the peace with France and Russia can't proceed (your unit is gone).

After confirming order, the first peace vote is triggered. If accepted, the next country's vote triggers automatically. If rejected, the rejection plays out (mutual destruction or hostile), and remaining peace votes are cancelled (the moving unit was destroyed).

### 5.4 Dictatorship Peace Vote (Target Player's View)

When a dictatorship's territory is the target of a peace offer:

1. The dictator sees the plan list with a **peace offer panel** instead of the normal planning UI:

```
┌─────────────────────────────────────┐
│  PEACE OFFER                        │
│                                     │
│  Austria proposes peace at Rome.    │
│  Austrian army entering from Vienna.│
│                                     │
│  [Accept Peace]  [Reject Peace]     │
└─────────────────────────────────────┘
```

2. **Accept:** Tuple stays `peace`. Control returns to the proposer. The plan list resumes with remaining moves pre-populated.

3. **Reject:** If the dictator has both armies and fleets at the destination, they choose which unit type to sacrifice:

```
┌─────────────────────────────────────┐
│  PEACE REJECTED                     │
│  Choose which unit to sacrifice:    │
│                                     │
│  ○ Italian army at Rome             │
│  ○ Italian fleet at Rome            │
│                                     │
│  [Confirm]                          │
└─────────────────────────────────────┘
```

If only one unit type exists, auto-select it. Tuple becomes `war {targetCountry} {unitType}`.

### 5.5 Democracy Peace Vote (Stockholders' View)

When a democracy's territory is the target:

1. Mode changes to `peace-vote`. All stockholders of the target country see:

```
┌─────────────────────────────────────┐
│  PEACE VOTE: Italy                  │
│                                     │
│  Austria proposes peace at Rome.    │
│  Your vote weight: 3 shares         │
│                                     │
│  [Accept]  [Reject]                 │
│                                     │
│  Votes so far: 2/5 accept, 0/5 rej │
│  Threshold: >2.505 to pass          │
└─────────────────────────────────────┘
```

2. **If rejected:** Stockholders vote on unit type to sacrifice (same picker as dictator, but it's a weighted vote among all stockholders).

`⚠ GAP: Democracy "vote on unit type after rejection" is not implemented. Currently auto-selects the first enemy unit found.`

### 5.6 Resuming After Peace Vote

After the peace vote resolves (accept or reject):
1. Control returns to the proposer.
2. The plan list reloads with:
   - **Prior completed moves** shown as locked rows at the top.
   - **Remaining plans** pre-populated from `remainingFleetPlans` / `remainingArmyPlans`.
3. The player can adjust remaining plans (board state may have changed — e.g., if peace was rejected and an enemy unit was destroyed, new action options may be available).
4. Destinations are revalidated. Any destination that is no longer reachable (e.g., a fleet was destroyed in war-on-rejection and no longer provides convoy) is cleared with a visual warning.

---

## 6. Submit Button States

```
State machine for the submit button:

  ┌──────────┐   all units    ┌───────────┐
  │ DISABLED ├──────────────►│  ENABLED   │
  │          │   assigned     │            │
  └────┬─────┘               └─────┬──────┘
       │                           │
       │  peace stop    ┌──────────┴──────────┐
       │  found         │                     │
       │           no peace stop         peace stop
       │                │                     │
       │         ┌──────▼──────┐    ┌─────────▼────────┐
       │         │   "Submit   │    │  "☮ Peace:       │
       │         │   Maneuver" │    │   {country}"     │
       │         └─────────────┘    └──────────────────┘
       │
       │  submitting
       ▼
  ┌──────────┐
  │ LOADING  │  "Submitting..."
  └──────────┘
```

**Disabled reasons (shown as tooltip):**
- "N unit(s) still unassigned"
- "Peace vote in progress" (lockLine present)

---

## 7. Map Interaction States

### 7.1 No Active Unit

Map shows:
- All units at their current positions (origin for unassigned, destination for assigned).
- Movement arrows for all assigned rows (solid for normal, dashed for locked).
- No territory highlighting.
- Clicking a unit marker selects it as the active unit.

### 7.2 Active Unit Selected

Map shows:
- Valid destinations highlighted in country color.
- Origin highlighted in gold.
- Other assigned destinations shown dimly.
- Clicking a highlighted territory assigns the destination.
- Clicking outside valid territories deselects the active unit.

### 7.3 Action Picker Open

Map shows:
- The selected destination pulsing or highlighted.
- Action picker popup at the click position.
- All other interactions frozen until picker is dismissed.

### 7.4 Movement Arrow Types

| Arrow | Style | Meaning |
|-------|-------|---------|
| Solid, country color | Normal assigned move |
| Solid + red X at tip | War move (unit consumed) |
| Solid + orange border | Peace move |
| Dashed, grey | Locked (prior round) |
| Dotted, through sea | Army convoy transport route |

---

## 8. Detailed Interaction Walkthroughs

These trace exact user scenarios step-by-step, showing what the player sees at each moment.

### 8.1 Unit Selection and Deselection

**Scenario:** Austria has 2 fleets and 3 armies. Player opens the maneuver planner.

```
INITIAL STATE (no active unit):
  Map: 5 unit markers at their origins (fleet icons at seas/ports, army icons at land)
  Plan list: 5 rows, all "(unassigned)", all dimmed
  No territory highlighting on map

STEP 1 — Player clicks Army 1 marker on the map:
  Map: Army 1 marker gets highlighted border (Austria color)
       All reachable land territories light up in Austria color
       Army 1's origin highlights in gold
       Other unit markers remain but are not highlighted
  Plan list: Army 1 row gets highlighted border, scrolls into view if needed

STEP 2 — Player clicks a highlighted territory (Budapest):
  Map: Movement arrow appears from Army 1's origin → Budapest
       Territory highlighting clears
       Army 1 marker moves to Budapest (or shows at both with arrow)
       If action auto-assigned: Army 1 marker settles at Budapest
       If action picker needed: picker popup appears at click position
  Plan list: Army 1 row updates to "Vienna → Budapest [move]"

STEP 3 — Auto-advance: Next unassigned unit activates automatically
  Map: Army 2 marker gets highlighted border
       Army 2's reachable territories light up
  Plan list: Army 2 row highlights

DESELECTION — Player clicks empty map area (not a territory, not a unit):
  Map: All highlighting clears. No active unit.
  Plan list: No row highlighted.
  Player must click a unit or row to resume.

DESELECTION — Player clicks an already-assigned unit:
  Map: That unit becomes active. Its destinations re-highlight.
       Player can pick a new destination (reassignment).
  Plan list: That row highlights. Old destination shown but can change.

RE-ASSIGNMENT — Player clicks a new territory while an assigned unit is active:
  Old destination arrow disappears.
  New destination arrow appears.
  Action recomputed for new destination.
  All downstream units recompute options (cascade).
```

### 8.2 Visualizing Many Units

The map already has three layers relevant to maneuvers:
- **Base map**: Territory boundaries, territory name labels, factory icons (land/sea factories shown at their positions)
- **UnitMarkerLayer**: Shows ⚓ (fleet) and ⚔ (army) icons at each territory's `unitCoords`. Already handles grouping/stacking when multiple units share a territory (horizontal offset spacing). Each marker is clickable with hover tooltip ("army at Vienna").
- **MovementArrowLayer**: Shows colored lines from origin to destination for each planned move.

**During maneuver planning, the existing UnitMarkerLayer shows three visual states:**

| State | CSS class | Appearance |
|-------|----------|-----------|
| **Idle** (unassigned) | `imp-unit-marker--idle` | Unit icon at origin, default styling |
| **Planned** (assigned) | `imp-unit-marker--planned` | Unit icon at destination, checkmark overlay ✓ |
| **Active** (selected) | `imp-unit-marker--active` | Pulsing/highlighted border in country color |

**Key behavior with many units:**
- Stacking: When 3+ units share a territory, markers space horizontally (offset by `markerSpacing`). All remain individually clickable.
- Planned units appear at their DESTINATION, not origin. The map reflects the "planned future state."
- Arrows connect origin → destination for each assigned unit.
- Unassigned units stay at their ORIGIN.

**What needs to be added for destruction visualization:** See §8.3.

### 8.3 Visualizing Unit Destruction (War)

`⚠ GAP: Destruction visualization not yet implemented. Currently all arrows look the same regardless of action.`

Building on the existing MovementArrow and UnitMarkerLayer:

**War move:** The MovementArrow from origin to destination should use a red color or add a ✕ marker at the tip. The attacking unit's marker does NOT appear at the destination (it is consumed — no surviving unit to show). The targeted enemy unit marker (already shown by the base UnitMarkerLayer from mapAPI data) should be shown with reduced opacity or a crossed-out overlay to indicate it will be destroyed.

**Blow-up move:** Arrow to destination with a distinct style (dark red or explosion icon). The factory icon at that territory (already rendered by the base map) should be shown crossed out. Three army markers at the destination are consumed — they should not appear at destination.

**Peace move:** Arrow with green tint. The moving unit marker DOES appear at the destination (it survives). Enemy unit markers remain as-is (no destruction).

**Plan list row styling for consumed units:**
- War/blow-up rows: Dimmed text or strikethrough for the unit name. A skull ✕ icon indicates the unit won't survive.
- Peace rows: Normal text. Green badge.

**The base map's territory labels and factory icons remain unchanged** — they show the current real state. The maneuver visualization overlays planned changes on top.

### 8.4 Cancel Cascade — The War→Move→Cancel Scenario

This is the critical scenario the user identified. Walk through it step by step.

**Setup:** Austrian Army 1 at Vienna, Austrian Army 2 at Budapest. Italian Army at Rome.

```
STEP 1 — Assign Army 1: Vienna → Rome, action "war Italy army"
  Map: Arrow from Vienna → Rome with red ✕
       Italian army at Rome shown faded (will be destroyed)
       Army 1 does NOT appear at Rome (consumed)
  Plan list:
    Army 1: Vienna → Rome [war Italy army] 💀
    Army 2: Budapest → (unassigned)

STEP 2 — Assign Army 2: Budapest → Rome
  Provider computes action options for Army 2 at Rome.
  Virtual state: Army 1's war move already destroyed the Italian army.
  So at Rome, in the virtual state: no enemy units remain.
  Rome is Italian home territory with no enemies.
  Available actions: "peace" + "hostile" (+ "blow up" if eligible)
  Action picker appears. Player picks "hostile".

  Map: Arrow from Budapest → Rome (solid, orange border for hostile)
       Army 2 marker appears at Rome
       Italian army at Rome is STILL shown faded (destroyed by Army 1)
  Plan list:
    Army 1: Vienna → Rome [war Italy army] 💀
    Army 2: Budapest → Rome [hostile]

STEP 3 — Player CANCELS Army 1's move (clicks ✕ on Army 1 row)
  ┌─────────────────────────────────────────────────────────────┐
  │ THIS IS THE CASCADE MOMENT                                  │
  │                                                             │
  │ Army 1 reverts to unassigned.                               │
  │ The Italian army at Rome is NO LONGER being destroyed.      │
  │ Army 2's action options must be recomputed:                 │
  │   - Rome now has an enemy unit (Italian army, not destroyed)│
  │   - "hostile" is no longer valid (enemies present)          │
  │   - Available actions change to: "war Italy army" + "peace" │
  │   - Army 2's current action "hostile" is INVALID            │
  └─────────────────────────────────────────────────────────────┘

  CASCADE RESOLUTION:
    Provider detects Army 2's action "hostile" is no longer in the
    recomputed action options list.

    OPTION A: Auto-clear the invalid action. Army 2 keeps its destination
    (Rome) but its action is reset to the new default (first war option).
    The action picker re-appears so the player can confirm or change.

    OPTION B: Clear the entire move. Army 2 reverts to unassigned.
    More disruptive but impossible to have an invalid state.

    RECOMMENDED: Option A — keep the destination, reset the action,
    show the picker. This is less disruptive and lets the player quickly
    pick "war Italy army" or "peace" without re-clicking Rome on the map.

  AFTER CASCADE:
  Map: Army 1 marker back at Vienna (unassigned, outlined)
       Army 2 arrow still points to Rome, but action badge changes
       Italian army at Rome shown normally again (no longer faded)
       Action picker appears for Army 2 at Rome
  Plan list:
    Army 1: Vienna → (unassigned)
    Army 2: Budapest → Rome [war Italy army] ← auto-defaulted, picker open
```

### 8.5 Cancel Cascade — Fleet Removal Breaks Convoy

**Setup:** Austrian Fleet 1 at Adriatic Sea. Austrian Army 1 at Trieste.
Army 1 plans to cross Adriatic Sea (via Fleet 1 convoy) to reach Albania.

```
STEP 1 — Assign Fleet 1: Adriatic Sea → Adriatic Sea (stays in place)
  Fleet 1 provides convoy at Adriatic Sea.

STEP 2 — Assign Army 1: Trieste → Albania (crosses Adriatic Sea via Fleet 1)
  Army 1's BFS includes Albania because Fleet 1 convoys at Adriatic.
  Map: Dotted transport line through Adriatic Sea, solid arrow to Albania.

STEP 3 — Player CANCELS Fleet 1's move (clicks ✕ on Fleet 1 row)
  Fleet 1 reverts to unassigned.
  Provider recomputes Army 1's destinations.
  Without Fleet 1 convoying, Adriatic Sea is not passable.
  Albania is no longer reachable from Trieste.
  Army 1's destination "Albania" is no longer in destOptions.

  CASCADE: Army 1's entire move is cleared (dest + action).
  Map: Army 1 marker returns to Trieste. Fleet 1 marker at Adriatic (unassigned).
       Transport line disappears. Arrow to Albania disappears.
  Plan list:
    Fleet 1: Adriatic Sea → (unassigned)
    Army 1: Trieste → (unassigned) ← was Albania, cascade-cleared

  ⚠ GAP: Currently the cascade silently clears the army move.
  The spec says a toast/warning should appear:
  "Army 1's destination cleared — fleet no longer provides transport."
```

### 8.6 War vs Peace Choice During Movement — Full Flow

**Scenario:** Austrian Army at Vienna moves to Rome (Italian home territory). Italy has an army and a fleet at Rome.

```
STEP 1 — Player activates Army 1 (clicks marker or row)
  Map: All reachable territories highlight. Rome is among them.

STEP 2 — Player clicks Rome on the map
  Provider computes action options at Rome.
  Rome has enemy units: Italian army + Italian fleet.
  Available actions:
    - "war Italy army" (destroy their army, your army consumed)
    - "war Italy fleet" (destroy their fleet, your army consumed)
    - "peace" (propose peace, triggers vote)
  Action picker appears at click position:

  ┌──────────────────────────────────┐
  │  Choose action at Rome:          │
  │                                  │
  │  ■ Declare war on Italy army     │ ← red badge
  │  ■ Declare war on Italy fleet    │ ← red badge
  │  ■ Enter peacefully              │ ← green badge
  └──────────────────────────────────┘

  NOTE: "hostile" is NOT shown. Enemies are present.
  NOTE: "blow up" might be shown if 3+ armies target Rome and
        Italy has >1 operational factory.

STEP 3A — Player picks "war Italy army"
  Picker closes. Army 1 row shows: Vienna → Rome [war Italy army] 💀
  Map: Arrow with red ✕ tip. Army consumed. Italian army faded.
  Italian FLEET at Rome still shown normally (not targeted).
  Auto-advance to next unit.

STEP 3B — Player picks "peace"
  Picker closes. Army 1 row shows: Vienna → Rome [peace] ☮
  Row gets orange border + "☮ Request Peace" button.
  Map: Arrow with green/dove tip. Army marker at Rome (survives).
  Italian units shown normally (no destruction).
  Submit button changes to "☮ Peace: Italy".

STEP 3C — Player picks "war Italy fleet"
  Same as 3A but Italian fleet is faded, army remains.

CHANGING YOUR MIND:
  After picking an action, the player can:
  1. Click the row's ✕ button → clears entire move, re-selects unit
  2. Click the Army 1 marker → re-activates it, can click a new destination
  3. Click Rome again while Army 1 is active → re-triggers action picker
     with the same options, player can choose differently
```

### 8.7 Multi-Unit War at Same Territory

**Scenario:** Austria has 3 armies. Rome has 2 Italian armies and 1 Italian fleet.

```
STEP 1 — Army 1: Vienna → Rome, picks "war Italy army"
  One Italian army will be destroyed. Army 1 consumed.
  Virtual state after: Rome has 1 Italian army + 1 Italian fleet.

STEP 2 — Army 2: Budapest → Rome
  Action options recomputed against virtual state.
  Rome still has enemies: 1 Italian army + 1 Italian fleet.
  Available: "war Italy army", "war Italy fleet", "peace"
  Player picks "war Italy fleet".
  Virtual state after: Rome has 1 Italian army. Army 2 consumed.

STEP 3 — Army 3: Trieste → Rome
  Action options recomputed.
  Rome still has enemies: 1 Italian army.
  Available: "war Italy army", "peace"
  Player picks "war Italy army".
  Virtual state after: Rome has NO enemies. Army 3 consumed.

  Map shows: 3 arrows converging on Rome, all with red ✕.
  All 3 Austrian army markers shown as consumed (💀).
  All Italian units at Rome shown faded.
  No Austrian units survive at Rome (all 3 sacrificed in war).

WHAT IF: Army 3 picks "peace" instead of war?
  Virtual state: 1 Italian army remains. Rome is enemy home.
  Army 3 cannot pick "hostile" (enemy still present).
  Army 3 survives at Rome. Peace vote triggers for Italy.
  Submit button: "☮ Peace: Italy"

CANCEL ARMY 1: What if player cancels Army 1's war?
  Italian army count at Rome reverts: now 2 armies + 1 fleet.
  Army 2's "war Italy fleet" is still valid (fleet still there).
  Army 3's target "war Italy army" is still valid (2 Italian armies remain,
    but Army 2 only kills the fleet, so after Army 2: 2 armies remain,
    Army 3 kills 1 → 1 army left).
  Wait — the virtual state cascade must be precise:
    After Army 2 (war fleet): 2 Italian armies + 0 fleets
    After Army 3 (war army): 1 Italian army remains
  Both Army 2 and Army 3's actions are still valid. No cascade needed.

CANCEL ARMY 2: What if player cancels Army 2's "war Italy fleet"?
  After Army 1 (war army): 1 Italian army + 1 fleet remain.
  Army 3's target "war Italy army" → is there still an Italian army?
    After Army 1 kills one: 1 army remains. Army 3 can still war it. Valid.
  But if Army 3 had picked "hostile" (which would only be valid if no
  enemies remained after Army 1 + Army 2 cleared them all):
    Army 2 cancellation breaks this. Army 3's "hostile" becomes invalid.
    CASCADE: Army 3's action resets, picker reopens.
```

### 8.8 Selection State Machine

```
                    ┌──────────────────┐
        ┌──────────►│    NO ACTIVE     │◄──────────┐
        │           │      UNIT        │           │
        │           └───────┬──────────┘           │
        │                   │                      │
        │          click unit marker               │
        │          or click plan row               │
        │                   │                      │
        │                   ▼                      │
        │           ┌──────────────────┐           │
        │           │   UNIT ACTIVE    │           │
click   │           │  (destinations   │    click empty
empty   │           │   highlighted)   │    map area
map     │           └───┬──────────┬───┘           │
area    │               │          │               │
        │    click      │          │  click another │
        │    territory  │          │  unit marker   │
        │               ▼          │               │
        │    ┌──────────────────┐  │               │
        │    │  DEST ASSIGNED   │  └───────┐       │
        │    │  (computing      │          │       │
        │    │   action opts)   │          │       │
        │    └───┬────────┬─────┘          │       │
        │        │        │                │       │
        │   1 action   multiple            │       │
        │   (auto)     actions             │       │
        │        │        │                │       │
        │        │        ▼                │       │
        │        │  ┌──────────────┐       │       │
        │        │  │ PICKER OPEN  │       │       │
        │        │  │ (frozen map) │       │       │
        │        │  └──┬───────┬───┘       │       │
        │        │     │       │           │       │
        │    pick action    dismiss        │       │
        │        │     │       │           │       │
        │        ▼     ▼       ▼           │       │
        │  ┌────────────────────────┐      │       │
        │  │    MOVE COMPLETE       │──────┘       │
        │  │   (auto-advance to    │               │
        │  │    next unassigned)   │───────────────┘
        │  └───────────────────────┘  (no more unassigned)
        │            │
        │       click ✕ on row
        │            │
        │            ▼
        │  ┌────────────────────────┐
        └──│   MOVE CANCELLED       │
           │  (cascade recompute,   │
           │   unit re-activates)   │
           └────────────────────────┘
```

### 8.9 Cascade Recomputation — Complete Rules

When ANY plan row changes (assigned, removed, reassigned, reordered, action changed), the following cascade runs:

```
TRIGGER: Row R in phase P changed
         │
         ▼
    ┌─────────────────────────────────────────────────────────┐
    │ 1. RECOMPUTE DEST OPTIONS                               │
    │    For each unit after R in phase P:                     │
    │      - Call getUnitOptionsFromPlans(plan, phase, index)  │
    │      - If current dest is NOT in new destOptions:        │
    │          → CLEAR dest + action (set to unassigned)       │
    │          → Flag as "cascade-cleared"                     │
    │                                                         │
    │ 2. IF P is 'fleet': RECOMPUTE ALL ARMY DEST OPTIONS     │
    │    Fleet changes affect convoy availability.             │
    │    For each army:                                        │
    │      - Recompute destOptions                             │
    │      - If current dest not reachable: CLEAR it           │
    │                                                         │
    │ 3. RECOMPUTE ACTION OPTIONS for all affected units       │
    │    For each unit that still has a dest:                   │
    │      - Call getUnitActionOptionsFromPlans(plan, ..., dest)│
    │      - If current action is NOT in new actionOptions:    │
    │          → RESET action to default (first war or first)  │
    │          → Show action picker so player can choose       │
    │                                                         │
    │ 4. RECOMPUTE PEACE FLAGS                                │
    │    For each unit with action 'peace':                    │
    │      - Recheck if destination has enemies in virtual state│
    │      - Update peaceVote flag                             │
    │                                                         │
    │ 5. RECOMPUTE BLOW-UP ELIGIBILITY                        │
    │    For each unit with action 'blow up X':                │
    │      - Recount friendly armies at that destination       │
    │      - If <3: CLEAR the blow-up action, reset to default │
    └─────────────────────────────────────────────────────────┘

CASCADE-CLEARED UNITS:
  When a unit's move is cleared by cascade:
  - Show a brief inline warning on the row:
    "Destination no longer reachable" (for dest cascade)
    "Action no longer valid" (for action cascade)
  - The warning fades after 3 seconds
  - The row reverts to unassigned state

ACTION RESET (not full clear):
  When a unit's dest is still valid but its action isn't:
  - Keep the destination
  - Reset action to new default
  - Show the action picker at the row's position (not map position,
    since the click didn't happen on the map)
  - Player must confirm or change the action
```

---

## 9. Additional Edge Cases

A double-click should not assign the same destination twice. Debounce clicks — ignore a second click within 200ms of the first.

### 8.2 Rapid Re-Assignment

If the player clicks destination A, then immediately clicks destination B before action options finish computing for A, cancel the computation for A and start for B. The provider should use a generation counter or abort signal to prevent stale async results from overwriting newer selections.

### 8.3 All Units Staying in Place

Valid — every unit can stay at its origin. The plan list would show all units with `origin → origin` and action `move`. Submit is enabled.

### 8.4 Country with Only Fleets (No Armies)

Skip the army section entirely. Plan list shows only fleet rows. Army phase is skipped in execution.

### 8.5 Country with Only Armies (No Fleets)

Skip the fleet section. No convoy is possible (no fleets to provide it). Army BFS only expands through home-to-home connections.

### 8.6 Peace Vote Rejection Invalidates Remaining Plans

If peace is rejected and the moving unit is destroyed (war-on-rejection), all remaining plans for that unit's phase are potentially affected:
- The destroyed unit's remaining plan row should be removed.
- Other rows' action options may change (e.g., blow-up no longer has 3 armies).
- Army destinations may shrink if a fleet was destroyed.

The provider must revalidate all remaining plans on resume and visually flag any that became invalid.

### 8.7 Browser Refresh Mid-Maneuver

The maneuver state (`currentManeuver`) is in Firebase and survives refresh. The plan list rebuilds from:
1. `completedFleetMoves` / `completedArmyMoves` → locked rows.
2. `remainingFleetPlans` / `remainingArmyPlans` → pre-populated rows.
3. localStorage draft → unsubmitted work.

Priority: Firebase remaining plans > localStorage draft > fresh start.

### 8.8 Another Player's Turn (Observing)

When it's not your turn (e.g., waiting for a peace vote), the plan list shows a read-only view:
- All rows are locked/greyed.
- No reorder, remove, or assign buttons.
- A status message: "Waiting for {player} to resolve peace vote..."

### 8.9 Undo During Maneuver

The undo button reverts to before the maneuver started. All planned moves are discarded. The player returns to the proposal mode.

### 8.10 Timer Expiration During Maneuver

If the timer expires while planning, the game should auto-submit whatever is currently assigned (treating unassigned units as staying in place) or skip the maneuver entirely (all units stay).

`⚠ GAP: Timer behavior during maneuver planning is not specified.`

### 8.11 Convoy Fleet Destroyed in War

If Fleet A is planned to move to Sea X (providing convoy for Army B to cross Sea X), and then Fleet A's action is changed to `war` (fleet is destroyed), Army B can no longer cross Sea X. Army B's destination must be cleared if it required that convoy.

The cascade recomputation (§4.5) handles this — but the UI should show a brief toast or inline warning: "Army 2's destination cleared — fleet no longer provides transport."

### 8.12 Multiple Armies at Same Destination with Blow-Up

If Army A targets Rome with `blow up Italy` and Army B also targets Rome with `move`:
- Army A is consumed by the blow-up.
- Army B is consumed as one of the 2 additional armies.
- If only Army A and B target Rome, blow-up is NOT available (need 3 armies total).
- The UI must dynamically enable/disable blow-up based on how many OTHER armies also target that destination.

### 8.13 Reordering Changes Action Availability

Moving a war row below a hostile row at the same territory should trigger a recomputation. The hostile row may become invalid (enemies not yet cleared) and should be flagged or auto-cleared.

---

## 10. Mobile-Specific Behavior

### 9.1 Bottom Sheet

On screens < 768px wide, the plan list renders in a swipeable bottom sheet:
- **Peek state:** Shows progress bar ("2/4 units assigned") and the submit/peace button.
- **Half-open:** Shows the plan list, scrollable.
- **Full-open:** Shows the plan list with more vertical space.

The map remains fully interactive behind the bottom sheet.

### 9.2 Action Picker on Mobile

On mobile, the action picker should render as a bottom sheet action menu rather than a positioned popup (which may be off-screen or obscured by the keyboard).

### 9.3 Touch Targets

All interactive elements (reorder buttons, remove buttons, action badges, territory hotspots) must have minimum 44x44px touch targets per iOS HIG.

---

## 11. Accessibility

### 10.1 Keyboard Navigation

- Tab through plan list rows.
- Enter/Space to select a row (make it the active unit).
- Arrow keys to navigate territory hotspots on the map when a unit is active.
- Enter to assign the focused territory as destination.
- Escape to dismiss the action picker.

`⚠ GAP: Keyboard navigation is not implemented.`

### 10.2 Screen Reader

- Each row should have an aria-label: "Fleet 1 from Trieste to Adriatic Sea, move action, assigned."
- The progress indicator should be a live region.
- Action picker options should have role="listbox".

`⚠ GAP: Screen reader support is not implemented.`

---

## 12. Visual Feedback Summary

| User Action | Immediate Feedback | Async Feedback |
|------------|-------------------|----------------|
| Click unassigned row | Row highlights, map shows destinations | — |
| Click territory on map | Destination assigned, arrow appears | Action options computed, picker may appear |
| Select action | Badge appears on row, picker closes | Next unassigned unit auto-activates |
| Reorder row | Row moves, position updates | Options recomputed for affected rows |
| Remove row | Row reverts to unassigned | Cascade: dependent rows may clear |
| Click Submit | Button shows loading | Firebase write, mode may change (peace vote) |
| Peace vote resolved | Locked rows appear, remaining plans load | Options recomputed for remaining rows |

---

## 13. GAP Summary

| # | Gap | Rules Spec Ref | Priority | Current Behavior |
|---|-----|---------------|----------|-----------------|
| 1 | Hostile offered with enemies present | §3.3 | P2 | Hostile shown even when enemies exist at destination |
| 2 | 1-fleet-1-army convoy limit | §2.3 | P2 | No enforcement; multiple armies can cross via one fleet |
| 3 | Multi-country peace vote order | §5.2 | P2 | Only first country's peace vote triggers |
| 4 | Democracy rejection unit-type vote | §5.4 | P2 | Auto-selects first enemy unit instead of voting |
| 5 | Auto-accept for coexisting units | §5.5 | P3 | Not implemented; peace vote triggers for coexisting units too |
| 6 | Timer behavior during maneuver | §8.10 | P2 | Unspecified |
| 7 | Keyboard navigation | §10.1 | P3 | Not implemented |
| 8 | Screen reader support | §10.2 | P3 | Not implemented |
| 9 | Convoy visualization | §3.4 | P2 | No visual transport routes shown |
| 10 | Drag-to-reorder | §2.3 | P3 | Arrow buttons only |
| 11 | Cascade warning toasts | §8.11 | P3 | Destinations silently cleared |
