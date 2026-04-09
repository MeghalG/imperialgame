# Imperial Game — UI State Diagram

This document maps every game mode to the interaction elements visible on screen.

---

## Layout (Always Present)

```
┌──────────────────────────────────────────────────────────────┐
│  TopBar: game title, timer, player name, sound/colorblind    │
├──────────────────────────────────┬───────────────────────────┤
│                                  │  Sidebar                  │
│  MapViewport                     │  ┌─────────────────────┐  │
│  ┌────────────────────────────┐  │  │ Portfolio header     │  │
│  │ Territory hotspots         │  │  │ (name, $, stocks)    │  │
│  │ Unit markers (fleet/army)  │  │  ├─────────────────────┤  │
│  │ Movement arrows            │  │  │ Tab bar:             │  │
│  │ Factories (sea/land)       │  │  │ Turn|Players|Country │  │
│  │ Tax chips                  │  │  │ |Scores|History|Rules│  │
│  │ Victory points track       │  │  ├─────────────────────┤  │
│  │ Rondel (wheel)             │  │  │ Tab content area     │  │
│  │ Compass rose               │  │  │ (changes per mode)   │  │
│  └────────────────────────────┘  │  └─────────────────────┘  │
│                                  │                           │
└──────────────────────────────────┴───────────────────────────┘
```

**TurnAnnouncement overlay**: Appears center-top for 2.2s when `myTurn` flips to true. Shows country name (colored) + "Your Turn".

---

## State Transitions

```
                    ┌──────────┐
                    │   BID    │ ← all players simultaneously
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │ BUY-BID  │ ← highest bidder: buy or pass?
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │   BUY    │ ← investor card: buy stock in order
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │ PROPOSAL │ ← leader picks rondel action
                    └────┬─────┘
                         │
              ┌──────────┴──────────┐
              │ democracy?          │
         ┌────▼──────┐         ┌───▼────┐
         │PROPOSAL   │         │execute │
         │   -OPP    │         │directly│
         └────┬──────┘         └───┬────┘
              │                    │
         ┌────▼──────┐            │
         │   VOTE    │            │
         └────┬──────┘            │
              │                   │
              └────────┬──────────┘
                       │
              ┌────────▼────────┐
              │ if maneuver:    │
              │ CONTINUE-MAN   │◄──────────┐
              └────────┬────────┘           │
                       │                   │
              ┌────────▼────────┐          │
              │ peace offered?  │          │
              │ PEACE-VOTE     ├──────────┘
              └────────┬────────┘ (resume remaining units)
                       │
              ┌────────▼────────┐
              │ 25 pts reached? │
              │   GAME-OVER    │
              └────────────────┘
```

---

## Interaction Elements by Mode

### `bid` — BidApp

| Element | Type | Detail |
|---------|------|--------|
| Player card | Collapsible info | Current player's stocks & money |
| "You may bid up to $X on [Country]" | Text | Contextual prompt |
| Bid amount | `InputNumber` | min=0, max=player money, step=$0.01, format `$ X.XX` |
| Submit | `SubmitButton` | Calls `submitAPI.bid()` |

**Map interactions**: None  
**Template components**: `SubmitButton`

---

### `buy-bid` — BuyBidApp

| Element | Type | Detail |
|---------|------|--------|
| Player card | Collapsible info | Current player's stocks & money |
| Bid order list | Collapsible info | All players' bids in order |
| "Would you like to spend $X on the [Country] Y?" | Text | |
| Yes / No | `Radio.Group` | Ant Design radio |
| Submit | `SubmitButton` | Disabled until choice made. Calls `submitAPI.bidBuy()` |

**Map interactions**: None  
**Template components**: `SubmitButton`

---

### `buy` — BuyApp (ActionFlow)

3-step progressive disclosure:

| Step | Element | Type | Map Interaction |
|------|---------|------|-----------------|
| 1 | Country | `OptionSelect` dropdown | `select-territory` (gold highlight) |
| 2 | Return stock | `OptionSelect` dropdown | None |
| 3 | Stock to buy | `OptionSelect` dropdown | None |
| — | Submit | `SubmitButton` | — |

**Submit**: `submitAPI.submitBuy()`  
**Template components**: `ActionFlow`, `OptionSelect`, `SubmitButton`

---

### `proposal` — ProposalApp (ActionFlow, nested)

3-step flow with conditional sub-flows:

| Step | Element | Type | Map Interaction |
|------|---------|------|-----------------|
| 1 | Previous proposal | `MessageDisplay` | None |
| 2 | Wheel action | `OptionSelect` (with costs: free/free/free/$2/$4/$6) | `select-rondel` (rondel click) |
| 3 | Action detail | *varies by wheel choice* | *varies* |

**Step 3 sub-flows by wheel action:**

| Wheel Action | Sub-flow | Elements | Map Interaction |
|--------------|----------|----------|-----------------|
| Factory | FactoryFlow | `OptionSelect` (location) | `select-territory` (green) |
| L-Produce / R-Produce | ProduceFlow | `ProduceSelect` checkbox | `select-territory` (gold) |
| Investor | InvestorFlow | `MessageDisplay` only | None |
| Taxation | TaxFlow | `MessageDisplay` only | None |
| L-Maneuver / R-Maneuver | ManeuverStartMessage | `SimpleMessage` "Submit to plan" | None |
| Import | ImportFlow | `ImportSelect` (3-slot picker) | `select-territory` (gold) |

**Submit**: `submitAPI.submitProposal()`  
**Template components**: `ActionFlow`, `OptionSelect`, `MessageDisplay`, `SimpleMessage`, `ImportSelect`, `ProduceSelect`, `SubmitButton`

---

### `proposal-opp` — ProposalAppOpp (Democracy only)

| Element | Type | Detail |
|---------|------|--------|
| Player + country cards | Collapsible info | Leader, opposition, gov type |
| Previous proposal alert | Alert | Shows leader's proposal |
| "Do you want to counterpropose?" | Text | |
| Yes / No | `Radio.Group` | |
| **If Yes**: full ProposalApp | Nested `ActionFlow` | Same as `proposal` mode above |
| **If No**: Submit directly | `SubmitButton` | |

**Map interactions**: Conditional (only if counterproposing — inherits `proposal` interactions)  
**Submit**: `submitAPI.submitNoCounter()` (no) or `submitAPI.submitProposal()` (yes)

---

### `vote` — VoteApp (ActionFlow)

| Element | Type | Detail |
|---------|------|--------|
| Player + country cards | Collapsible info | |
| Two proposals | `RadioSelect` | Each shows proposal description |
| Submit | `SubmitButton` | Calls `submitAPI.submitVote()` |

**Map interactions**: None  
**Template components**: `ActionFlow`, `RadioSelect`, `SubmitButton`

---

### `continue-man` — ManeuverPlannerApp

This mode has a unique UI — not based on ActionFlow. Uses `ManeuverPlanContext` for map coordination.

**Sidebar / Panel elements:**

| Element | Type | Detail |
|---------|------|--------|
| Prior completed moves | Card | Previously completed moves (if any) |
| Progress indicator | Text | "N/M units assigned" |
| Fleet section | Card list | Assigned rows (action badges) + unassigned rows |
| Army section | Card list | Same structure as fleet |
| Reorder buttons | Up/Down arrows | Change move order |
| Remove button | X icon | Remove planned move |
| Lock visualization | Dimmed + lock icon | Completed units |

**Floating elements (over map):**

| Element | Type | Detail |
|---------|------|--------|
| ManeuverSubmitFAB | Floating button | Teal "Submit Maneuver" or "☮ Peace: [Country]" (country color) |
| ManeuverActionPicker | Context menu | On right-click: Move, Peace, Hostile, War, Blow up factory |

**Map interactions (full interactive):**

| Interaction | Trigger | Effect |
|-------------|---------|--------|
| Territory click | Left-click | Set destination or action for selected unit |
| Unit right-click | Right-click | Open ManeuverActionPicker context menu |
| Ghost unit markers | Automatic | Blue=fleet, Gold=army at planned destinations |
| Movement arrows | Automatic | Show planned moves |

**Submit**: `submitAPI.submitManeuver()`  
**Template components**: None (custom UI)

---

### `peace-vote` — PeaceVoteApp (Full-screen overlay)

This mode renders as a **full-page modal** overlaying everything.

| Element | Type | Detail |
|---------|------|--------|
| "Peace Offer" | Result header | Ant Design Result |
| Move description | Subheading | "[Country]'s [unit] wants to enter [territory] peacefully" |
| Stockholder vote card | Card | "[Target Country] Stockholder Vote" |
| Accept option | Description | "The [unit] enters peacefully (non-hostile)" |
| Reject option | Description | "The entry becomes an act of war (both destroyed)" |
| Vote tally | Display | "Accept: X, Reject: Y (threshold: Z)" |
| "Accept Peace" | Button (primary) | Blue |
| "Reject (War)" | Button (danger) | Red |
| Already voted state | Status text | "You have already voted" |

**Map interactions**: None (modal takes focus)  
**Submit**: `submitAPI.submitPeaceVote()`

---

### `game-over` — GameOverApp (Full-screen overlay)

Replaces sidebar with full-screen overlay (sidebar hidden via CSS).

| Element | Type | Detail |
|---------|------|--------|
| "Game Over" header | Display | |
| Winner name + score | Display | |
| Collapse toggle | Button | Show/hide details |
| Investor Rankings | Left column | Rank badge, name, score, wealth bar, bond breakdown, cash |
| Country Standings | Right column | Country name, points, $/bond, owners |

**Map interactions**: None  

---

## Component Template Usage Matrix

| Component | bid | buy-bid | buy | proposal | proposal-opp | vote | continue-man | peace-vote | game-over |
|-----------|:---:|:-------:|:---:|:--------:|:------------:|:----:|:------------:|:----------:|:---------:|
| ActionFlow | | | ✓ | ✓ | ✓ | ✓ | | | |
| OptionSelect | | | ✓ | ✓ | ✓ | | | | |
| RadioSelect | | | | | | ✓ | | | |
| ProduceSelect | | | | ✓ | ✓ | | | | |
| ImportSelect | | | | ✓ | ✓ | | | | |
| MessageDisplay | | | | ✓ | ✓ | | | | |
| SimpleMessage | | | | ✓ | ✓ | | | | |
| SubmitButton | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| InputNumber | ✓ | | | | | | | | |
| Radio.Group | | ✓ | | | ✓ | | | | |

---

## Map Interaction Modes

| Mode | Active During | Highlight Color | Action |
|------|---------------|-----------------|--------|
| `select-territory` | Buy (country), Proposal (factory) | Gold (#c9a84c) / Green (#49aa19) | Click territory → set selection |
| `select-territory` | Proposal (produce, import) | Gold (#c9a84c) | Click territory → toggle selection |
| `select-rondel` | Proposal (wheel) | — | Click rondel position → set wheel action |
| Interactive maneuver | Continue-man | Blue (fleet) / Gold (army) | Click territory = destination, right-click = action menu |
| None | bid, buy-bid, vote, peace-vote, game-over | — | Map is view-only |
