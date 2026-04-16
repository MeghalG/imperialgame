# Design System Implementation Spec

Implements DESIGN.md across the Imperial Game codebase. Covers visual tokens (fonts,
colors, spacing), interaction model changes (rondel-primary proposal flow, sidebar
preview + submit), and vote UI refinement.

## Current State

The codebase is closer to DESIGN.md than it appears:

- **Layout:** Map-dominant (~70%) with persistent sidebar (~30%). Already correct.
- **Map interactions:** Territory hotspots, rondel clicks, unit markers, movement arrows
  all functional. Produce, import, factory, maneuver all have map-based input.
- **Dual-input pattern:** `useMapTerritorySelect` hook lets any component add map
  interaction. Sidebar forms sync with map clicks for produce, import, factory.
- **Maneuver planner:** Full map-first workflow with contextual action picker,
  movement arrows, ghost markers. This is the "gold standard" for the target UX.

### What's Missing

1. **Visual tokens** — No Geist/JetBrains Mono fonts loaded. CSS variables don't
   match DESIGN.md names/values. Spacing and radius not tokenized.
2. **Proposal rondel wiring** — Rondel sectors ARE clickable (SvgRondel.js), but
   ProposalApp uses a sidebar dropdown for wheel action selection, not the rondel.
3. **Sidebar action preview** — No "here's what will happen" summary before submit.
4. **Persistent submit button** — Each mode has its own submit via ActionFlow.
   No consistent anchored submit at bottom of sidebar.
5. **Vote/Peace Vote UI** — Small radio buttons. Could be larger, more prominent.

## Scope

### In Scope

- Visual foundation (fonts, CSS variables, typography, spacing, radius tokens)
- Proposal flow: rondel as primary input for wheel action selection
- Sidebar action preview for all proposal sub-actions
- Persistent submit button at bottom of sidebar
- Vote/Peace Vote UI refresh (larger buttons)
- Contextual popovers for proposal sub-decisions (extending maneuver pattern)

### Out of Scope

- Buy/Bid interface redesign (noted as TBD in DESIGN.md)
- Game engine changes (submitAPI.js, proposalAPI.js logic)
- Firebase data model changes
- New game modes or features
- Mobile-specific redesign (current drawer behavior stays)

### Explicit Boundaries (DO NOT CHANGE)

- Ant Design stays as the component library
- Stock badge pattern (colored numbered squares) preserved exactly
- Country card layout (accent bar + stats + stock info) preserved
- Sidebar tab structure (Turn, Players, Countries, History, Rules) stays
- Country colors are sacred
- ManeuverPlannerApp stays as-is (already meets DESIGN.md vision)

---

## Phase 1: Visual Foundation

### 1.1 Font Loading

Add Google Fonts link to `public/client/public/index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

Note: Custom fonts were deliberately reverted in commit `c3224a30`. This time DESIGN.md
exists as the documented authority for the change.

### 1.2 CSS Variable Alignment

Update `:root` in `MapOverlay.css` to add DESIGN.md tokens. Keep existing `--imp-*`
names as aliases so nothing breaks.

**New tokens to add:**

```css
:root {
  /* DESIGN.md color tokens */
  --bg-primary: #090B0F;
  --bg-surface: #12141A;
  --bg-elevated: #1A1D24;
  --accent-gold: #C9A84C;
  --accent-teal: #13A8A8;
  --text-primary: rgba(255,255,255,0.87);
  --text-secondary: rgba(255,255,255,0.70);
  --text-muted: rgba(255,255,255,0.38);
  --success: #49AA19;
  --error: #D32029;
  --warning: #D8BD14;
  --info: #177DDC;

  /* Spacing tokens (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  /* Border radius tokens */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;
  --radius-round: 50%;

  /* Font tokens */
  --font-display: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Aliases for existing --imp-* references */
  --imp-panel-bg: var(--bg-surface);
  --imp-topbar-bg: rgba(18, 20, 26, 0.94);
  --imp-accent-gold: var(--accent-gold);
  --imp-accent-gold-dim: rgba(201, 168, 76, 0.35);
  --imp-accent-green: var(--success);
  --imp-accent-green-dim: rgba(73, 170, 25, 0.3);
  --imp-text: var(--text-primary);
  --imp-text-dim: var(--text-secondary);
  --imp-danger: var(--error);
  --imp-font-display: var(--font-display);
  --imp-font-body: var(--font-body);
  --imp-font-condensed: 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif;
}
```

### 1.3 Typography Application

**Headings and titles** (TopBar turn title, sidebar headers, card headers):
```css
font-family: var(--font-display);
font-weight: 600; /* or 700 for display-size */
```

**Financial data** (treasury values, scores, stock prices, tax amounts):
```css
font-family: var(--font-mono);
font-variant-numeric: tabular-nums;
```

Apply to:
- `.imp-state__key-stat` (treasury values in country cards)
- `.imp-state__card-header-extra` (points display)
- Score track numbers
- Any `$` prefixed values or point totals

**Body/UI text:** Already uses system sans. No change needed.

### 1.4 Color Application

- Update background on `body` / `.imp-game-layout` to use `--bg-primary`
- Update sidebar background to use `--bg-surface`
- Update card backgrounds to use `--bg-elevated`
- Update text colors to use `--text-primary` / `--text-secondary`
- Add `--accent-teal` to interactive elements (buttons, focus rings, submit)
- Leave country-colored elements untouched

### 1.5 Files Changed

| File | Change |
|------|--------|
| `public/client/public/index.html` | Add Google Fonts link |
| `public/client/src/MapOverlay.css` | Add CSS variable tokens, update existing vars to use new tokens |
| `public/client/src/App.css` | Update any hardcoded colors/fonts to use tokens |
| `public/client/src/ManeuverPlanner.css` | Update to use tokens where applicable |

### 1.6 Risk

Low. CSS-only changes. Fonts load async with system fallback. Existing `--imp-*`
aliases prevent breakage. If Geist fails to load, system sans renders (current behavior).

---

## Phase 2: Proposal Rondel Flow

### 2.1 Current Architecture

```
ProposalApp.js
  -> getWheelOptions() from proposalAPI.js (returns available actions + costs)
  -> Renders OptionSelect dropdown in sidebar for wheel action
  -> On selection, renders sub-action UI (ProduceSelect, ImportSelect, etc.)
  -> Submit button via ActionFlow

SvgRondel.js (on map)
  -> Reads MapInteractionContext.rondelSelectableItems
  -> Shows clickable sectors with cost labels
  -> Calls mapInteraction.onRondelItemSelected(action) on click
```

The rondel and ProposalApp are disconnected. ProposalApp doesn't set
`rondelSelectableItems`, and doesn't listen for `rondelSelectedItem`.

### 2.2 Target Architecture

```
ProposalApp.js
  -> getWheelOptions() (same as today)
  -> Sets MapInteractionContext.rondelSelectableItems with available actions + costs
  -> Listens for MapInteractionContext.rondelSelectedItem changes
  -> On rondel click OR sidebar dropdown change: activates sub-action
  -> Sidebar dropdown stays (secondary input, synced with rondel)
  -> Sub-action UI renders in sidebar (same components as today)
  -> Sub-action map interactions activate automatically

SvgRondel.js (unchanged)
  -> Already handles clicks and visual feedback
```

### 2.3 Changes to ProposalApp.js

1. **On mount / when wheel options load:**
   - Call `mapInteraction.setRondelSelectableItems(wheelOptions)` with available actions
   - Call `mapInteraction.setRondelCosts(costMap)` if applicable

2. **Add effect listening for rondel selection:**
   ```js
   useEffect(() => {
     if (mapInteraction.rondelSelectedItem) {
       setWheelSpot(mapInteraction.rondelSelectedItem);
       // Activate sub-action UI
     }
   }, [mapInteraction.rondelSelectedItem]);
   ```

3. **Sync sidebar dropdown -> rondel:**
   When the OptionSelect dropdown changes, also update
   `mapInteraction.setRondelSelectedItem(value)` so the rondel highlights.

4. **On unmount / mode change:**
   Clear rondel selectable items: `mapInteraction.setRondelSelectableItems(null)`

5. **Sub-action activation:**
   When a wheel action is selected (from rondel or dropdown), the sub-action
   component renders and its own map interaction activates (produce highlights
   factories, import highlights cities, etc.). This already works for sidebar-
   initiated selections — just needs to also trigger from rondel clicks.

### 2.4 Changes to ProposalAppOpp.js

Same pattern as ProposalApp. The opposition counter-proposal also gets rondel-primary input.

### 2.5 Non-destructive Switching

The user can click different rondel sectors freely. When switching:
- Clear the previous sub-action's map state (territory highlights, ghost markers)
- Activate the new sub-action's map interaction
- Sidebar updates to show the new sub-action controls
- No data is committed until Submit

This matches how ProposalApp already handles dropdown changes — switching the
OptionSelect value clears the previous sub-action and shows the new one.

### 2.6 Files Changed

| File | Change |
|------|--------|
| `public/client/src/ProposalApp.js` | Wire rondelSelectableItems, listen for rondelSelectedItem, sync dropdown |
| `public/client/src/ProposalAppOpp.js` | Same as ProposalApp |
| `public/client/src/MapInteractionContext.js` | Verify rondel state fields exist (likely already there) |

### 2.7 Risk

Medium. ProposalApp is complex (handles multiple sub-action types). The rondel
wiring touches state flow but doesn't change game logic. Sub-action components
(ProduceSelect, ImportSelect, etc.) don't need changes — they already respond
to their parent's state. Test by playing through a full proposal cycle in each
government type (democracy + dictatorship).

---

## Phase 3: Sidebar Action Preview + Persistent Submit

### 3.1 Action Preview Component

New component: `ActionPreview.js`

Reads the current mode and user selections from UserContext, computes a
human-readable summary of what will happen on submit.

| Mode | Preview Text |
|------|-------------|
| proposal (produce) | "Austria produces: Army in Vienna, Fleet in Trieste" |
| proposal (import) | "France imports: Army to Paris, Fleet to Marseilles" |
| proposal (maneuver) | Already shown by ManeuverPlanList |
| proposal (factory) | "Build factory in Munich" |
| proposal (taxation) | "Austria collects $3M tax revenue" (from getTaxInfo) |
| proposal (investor) | "Investor round: all players may buy stock" |
| vote | "Vote on: [proposal summary]" |
| buy | "Buy [country] stock at $[price]" |

The preview renders inside the sidebar's Turn tab, below the mode-specific controls
and above the submit button.

Data sources:
- Produce selections: from UserContext (checkboxes/map selections)
- Import selections: from UserContext (slot state)
- Factory selection: from UserContext
- Tax info: from `helper.getTaxInfo(context)`
- Proposal text: from `helper.stringifyProposal()` or similar

### 3.2 Persistent Submit Button

New component: `SidebarSubmit.js`

Anchored at the bottom of the sidebar (sticky/fixed positioning within the sidebar
scroll container). Always visible when it's the player's turn.

Props/behavior:
- **Label:** Reads current mode to show action-specific text
  - "Propose [Action]" during proposal
  - "Submit Vote" during vote
  - "Buy Stock" during buy
  - "Submit Bid" during bid
  - "Confirm Move" during continue-man
- **Color:** Active country's color (from UserContext.country + countryColors.js)
- **Handler:** Delegates to the current mode's submit function
  - Gets the submit function from the active mode component
  - This requires the mode component to expose its submit handler, or for the
    sidebar to read it from a shared ref/context
- **Disabled state:** Disabled until required selections are complete
- **Loading state:** Shows spinner during Firebase write

**Implementation approach:**
Each mode component registers its submit handler in a shared context
(`TurnControlContext`) that SidebarSubmit reads from. This keeps submit logic
owned by the mode that understands it, while the sidebar just renders and delegates.

`TurnControlContext` provides `{ submitHandler, submitLabel, submitEnabled }`.
Mode components call `setSubmitHandler(fn)`, `setSubmitLabel(str)`, and
`setSubmitEnabled(bool)` in their effects. SidebarSubmit reads and renders.

### 3.3 ActionFlow Refactor

Currently `ActionFlow` includes a submit button as part of its component tree.
With `SidebarSubmit` taking over submit responsibility:

- ActionFlow's internal submit button can be hidden when SidebarSubmit is active
- Or ActionFlow's `submitMethod` gets registered in TurnControlContext instead
  of rendering its own button
- The progressive disclosure / layer management in ActionFlow stays unchanged

This needs care — ActionFlow is used by most mode components. The change should
be backward-compatible: if no SidebarSubmit is present (e.g., in a test), ActionFlow
still renders its own button.

### 3.4 Files Changed

| File | Change |
|------|--------|
| `public/client/src/ActionPreview.js` | New file — action preview component |
| `public/client/src/SidebarSubmit.js` | New file — persistent submit button |
| `public/client/src/TurnControlContext.js` | New file — shared context for submit handler |
| `public/client/src/Sidebar.js` | Render ActionPreview + SidebarSubmit in Turn tab |
| `public/client/src/ComponentTemplates.js` | ActionFlow registers submit in TurnControlContext |
| `public/client/src/ProposalApp.js` | Register submit handler in TurnControlContext |
| `public/client/src/VoteApp.js` | Register submit handler |
| `public/client/src/BuyApp.js` | Register submit handler |
| `public/client/src/BidApp.js` | Register submit handler |
| `public/client/src/BuyBidApp.js` | Register submit handler |
| `public/client/src/PeaceVoteApp.js` | Register submit handler |

### 3.5 Risk

Medium-high. Touches ActionFlow which is used by every mode. The TurnControlContext
approach isolates the change (mode components register, SidebarSubmit reads), but
testing every mode is essential. Maneuver already has its own submit (ManeuverSubmitFAB)
and should be left alone.

---

## Phase 4: Vote/Peace Vote UI

### 4.1 Current State

VoteApp renders radio buttons via RadioSelect for Yes/No (or proposal choices).
PeaceVoteApp is similar.

### 4.2 Target

When the mode is `vote` or `peace-vote`, the map is less relevant. The vote controls
should be visually larger in the sidebar:

- Replace radio buttons with large, styled buttons
- Country-colored (matching the proposing country) for the proposal options
- Clear visual distinction between Yes/No or Proposal 1/Proposal 2
- Each button shows a summary of what it means (the proposal text)

### 4.3 Implementation

- New `VoteButtons.js` component (or modify VoteApp's render)
- Large button per option, stacked vertically in the sidebar
- Each button: proposal summary text + "Vote for this" label
- Selected state: filled with country color. Unselected: outlined.
- Still uses SidebarSubmit at bottom to confirm the vote

### 4.4 Files Changed

| File | Change |
|------|--------|
| `public/client/src/VoteApp.js` | Replace RadioSelect with large vote buttons |
| `public/client/src/PeaceVoteApp.js` | Same treatment |
| `public/client/src/MapOverlay.css` | Styles for vote buttons |

### 4.5 Risk

Low. Vote and PeaceVote are self-contained components. No map interaction involved.
Test by going through a full democracy proposal-vote cycle.

---

## Phase 5: Contextual Popovers for Proposal Sub-Decisions

### 5.1 Current State

ManeuverActionPicker already implements contextual popovers — it appears at the
click location when a maneuver destination needs an action type (war/peace/hostile).

### 5.2 Target

Extend this pattern to proposal sub-actions where a map click needs a follow-up choice:

- **Import:** When clicking a factory city, if both army and fleet are valid, show a
  popover at the click location to choose unit type (instead of the sidebar ImportSelect
  cascading form). Currently ImportSelect handles this via slot pre-assignment (1st army,
  1st fleet, etc.), so this may not need a popover if the slot system is clear enough.

- **Produce:** When clicking a factory, if the territory can produce army or fleet,
  the selection toggles. Currently ProduceSelect handles army/fleet via separate
  checkboxes. If a territory has both army and fleet factories, a popover could
  disambiguate — but the current toggle behavior may already be sufficient.

### 5.3 Assessment

The existing import and produce map interactions already handle sub-decisions without
popovers (via slot systems and toggles). The contextual popover pattern is most
valuable for **maneuver** (which already has it).

**Recommendation:** Don't force popovers where the existing pattern works. Focus
popovers on cases where the user genuinely needs to choose between options at a
map location. Import's slot system and produce's toggle system are already well-liked
patterns. If user testing reveals friction, add popovers then.

### 5.4 Files Changed

Likely none in this phase. Maneuver already has it. Import/produce patterns work
as-is. This section is here to document the decision not to add unnecessary popovers.

### 5.5 Risk

None (no changes).

---

## Implementation Order

```
Phase 1: Visual Foundation
  1.1 Font loading (index.html)
  1.2 CSS variables (MapOverlay.css)
  1.3 Typography application (MapOverlay.css, App.css)
  1.4 Color application (MapOverlay.css, component styles)

Phase 2: Proposal Rondel Flow
  2.1 Wire rondelSelectableItems in ProposalApp
  2.2 Listen for rondelSelectedItem, sync with dropdown
  2.3 Same for ProposalAppOpp
  2.4 Test full proposal cycle (democracy + dictatorship)

Phase 3: Sidebar Action Preview + Submit
  3.1 Create TurnControlContext
  3.2 Create ActionPreview component
  3.3 Create SidebarSubmit component
  3.4 Wire mode components to register submit handlers
  3.5 Refactor ActionFlow to defer to SidebarSubmit
  3.6 Test every mode's submit flow

Phase 4: Vote/Peace Vote UI
  4.1 Replace radio buttons with large vote buttons
  4.2 Test democracy vote cycle

Phase 5: Contextual Popovers
  5.1 Evaluate if any new popovers are needed (likely not)
```

Each phase can be committed and tested independently. Phase 1 is prerequisite
for all others (establishes the visual language). Phases 2-5 are independent
of each other.

## Testing Strategy

**Per-phase testing:**
- Phase 1: Visual inspection. Load the game, verify fonts render, colors match, spacing looks right. Screenshot before/after.
- Phase 2: Play through a full proposal in democracy mode. Verify rondel clicks activate sub-actions. Verify sidebar dropdown still works and syncs. Test dictatorship mode (no opposition).
- Phase 3: Verify action preview shows correct text for each sub-action. Verify submit button works for every mode. Verify ActionFlow still works in isolation (if SidebarSubmit is absent).
- Phase 4: Play through a vote. Verify large buttons render, selection works, submit confirms the vote.
- Phase 5: No new code expected.

**Regression testing:**
- Run full test suite (`npm test -- --watchAll=false --ci`) after each phase
- Play a complete game turn cycle (proposal -> vote -> execute -> buy) after phases 2-4
- Verify maneuver planner still works (should be untouched)

## Success Criteria

- All DESIGN.md visual tokens are implemented and CSS variables match the spec
- Geist renders for headings, JetBrains Mono for financial data
- Proposal wheel action selection works via rondel click (primary) and sidebar dropdown (secondary)
- Sidebar shows action preview for all proposal sub-actions
- Submit button is always at the bottom of the sidebar, labeled per action
- Vote UI uses large buttons instead of radio groups
- All existing tests pass
- Game is fully playable through all modes
