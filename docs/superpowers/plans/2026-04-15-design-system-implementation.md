# Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement DESIGN.md across the Imperial Game codebase — visual tokens, sidebar action preview, persistent submit button, and vote UI refresh.

**Architecture:** CSS variable tokens align the visual language (fonts, colors, spacing). A new TurnControlContext lets mode components register submit handlers that a persistent SidebarSubmit component renders at the bottom of the sidebar. An ActionPreview component reads current selections and shows what will happen on submit. Vote/PeaceVote get larger styled buttons.

**Tech Stack:** React 16, Ant Design 4, CSS custom properties, Google Fonts (Geist, JetBrains Mono)

**Spec:** `docs/superpowers/specs/2026-04-15-design-system-implementation.md`

**Key discovery:** The proposal rondel flow is already fully wired. ProposalApp passes `mapMode="select-rondel"` to OptionSelect, which calls `setRondelInteraction` via `useMapTerritorySelect`. Rondel clicks flow back through the callback. Tests exist in `MapInteraction.test.js`. No work needed on Phase 2 from the spec.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/TurnControlContext.js` | React context: `{ submitHandler, submitLabel, submitEnabled, previewText }` |
| `src/ActionPreview.js` | Reads TurnControlContext.previewText, renders human-readable action summary |
| `src/SidebarSubmit.js` | Reads TurnControlContext, renders persistent submit button at sidebar bottom |

### Modified Files
| File | Change |
|------|--------|
| `public/index.html` | Add Google Fonts link for Geist + JetBrains Mono |
| `src/MapOverlay.css` | Add DESIGN.md CSS variable tokens, repoint `--imp-*` aliases |
| `src/App.css` | May need minor token updates (most handled by legacy aliases) |
| `src/GameApp.js` | Wrap app in TurnControlContext.Provider |
| `src/Sidebar.js` | Render ActionPreview + SidebarSubmit in Turn tab |
| `src/ComponentTemplates.js` | ActionFlow registers submit handler in TurnControlContext |
| `src/VoteApp.js` | Replace RadioSelect with large styled vote buttons |
| `src/PeaceVoteApp.js` | Style Accept/Reject buttons larger |

All paths relative to `public/client/` unless noted.

---

## Task 1: Load Geist and JetBrains Mono Fonts

**Files:**
- Modify: `public/client/public/index.html`

- [ ] **Step 1: Add Google Fonts preconnect and stylesheet links**

In `public/client/public/index.html`, add these lines inside `<head>`, after the Font Awesome script tag (line 27) and before `<title>` (line 28):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Verify fonts load**

Run: `cd public/client && npm start`

Open http://localhost:3000 in the browser. Open DevTools > Network tab, filter by "font". Confirm Geist and JetBrains Mono woff2 files are loading. They won't be used yet (no CSS references) but should appear in the network log.

- [ ] **Step 3: Commit**

```bash
git add public/client/public/index.html
git commit -m "feat: load Geist and JetBrains Mono from Google Fonts"
```

---

## Task 2: Add DESIGN.md CSS Variable Tokens

**Files:**
- Modify: `public/client/src/MapOverlay.css`

- [ ] **Step 1: Add new tokens and repoint aliases in `:root`**

In `public/client/src/MapOverlay.css`, replace the existing `:root` block (lines 6-23) with:

```css
:root {
	/* ── DESIGN.md color tokens ── */
	--bg-primary: #090b0f;
	--bg-surface: #12141a;
	--bg-elevated: #1a1d24;
	--accent-gold: #c9a84c;
	--accent-teal: #13a8a8;
	--text-primary: rgba(255, 255, 255, 0.87);
	--text-secondary: rgba(255, 255, 255, 0.7);
	--text-muted: rgba(255, 255, 255, 0.38);
	--success: #49aa19;
	--error: #d32029;
	--warning: #d8bd14;
	--info: #177ddc;

	/* ── Spacing tokens (4px base) ── */
	--space-1: 4px;
	--space-2: 8px;
	--space-3: 12px;
	--space-4: 16px;
	--space-6: 24px;
	--space-8: 32px;
	--space-12: 48px;

	/* ── Border radius tokens ── */
	--radius-sm: 2px;
	--radius-md: 4px;
	--radius-lg: 6px;
	--radius-round: 50%;

	/* ── Font tokens ── */
	--font-display: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	--font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	--font-mono: 'JetBrains Mono', monospace;

	/* ── Legacy aliases (existing --imp-* refs keep working) ── */
	--imp-panel-bg: rgba(18, 20, 26, 0.88);
	--imp-panel-border: rgba(255, 255, 255, 0.08);
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

Note: `--imp-panel-bg` stays as a literal rgba value (not `var(--bg-surface)`) because the panel bg uses transparency for the frosted-glass effect, while `--bg-surface` is opaque. Same for `--imp-topbar-bg`.

- [ ] **Step 2: Run tests to verify no CSS regressions**

Run: `cd public/client && npm test -- --watchAll=false --ci`

Expected: All 644+ tests pass. CSS variable changes should not affect test results (tests don't render real CSS).

- [ ] **Step 3: Visual verification**

Run the dev server, load the app. Verify:
- Colors should look almost identical (the `--imp-*` aliases repoint through the new tokens)
- No broken backgrounds, text, or borders
- Country colors unchanged

- [ ] **Step 4: Commit**

```bash
git add public/client/src/MapOverlay.css
git commit -m "feat: add DESIGN.md CSS variable tokens with legacy aliases"
```

---

## Task 3: Apply Typography Tokens

**Files:**
- Modify: `public/client/src/MapOverlay.css`

- [ ] **Step 1: Update heading/title styles to use Geist**

Find all `.imp-topbar__title`, `.imp-sidebar__tab-label`, `.imp-state__card-header`, and other heading classes in MapOverlay.css. For each, ensure the `font-family` uses `var(--font-display)`.

The key selectors to update (search for each in MapOverlay.css and change the `font-family` line):

```css
.imp-topbar__title {
	font-family: var(--font-display);
	font-weight: 600;
}

.imp-state__card-header {
	font-family: var(--font-display);
	font-weight: 600;
}

.imp-sidebar__tab-label {
	font-family: var(--font-display);
}
```

If any of these selectors don't have an explicit `font-family`, add one.

- [ ] **Step 2: Apply JetBrains Mono to financial data**

Add or update these rules in MapOverlay.css:

```css
.imp-state__key-stat,
.imp-state__card-header-extra {
	font-family: var(--font-mono);
	font-variant-numeric: tabular-nums;
}
```

This targets treasury values and point totals in country cards.

- [ ] **Step 3: Visual verification**

Run the dev server. Verify:
- Turn title in the top bar renders in Geist (geometric sans, slightly different from system font)
- Country card headers render in Geist
- Treasury `$X.XX` values and point totals render in JetBrains Mono (monospaced, aligned numbers)
- Body text and labels still render in system sans-serif

- [ ] **Step 4: Run tests**

Run: `cd public/client && npm test -- --watchAll=false --ci`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add public/client/src/MapOverlay.css
git commit -m "feat: apply Geist for headings and JetBrains Mono for financial data"
```

---

## Task 4: Create TurnControlContext

**Files:**
- Create: `public/client/src/TurnControlContext.js`
- Modify: `public/client/src/GameApp.js`

- [ ] **Step 1: Create the context**

Create `public/client/src/TurnControlContext.js`:

```js
import React from 'react';

const TurnControlContext = React.createContext({
	submitHandler: null,
	submitLabel: 'Submit',
	submitEnabled: false,
	submitting: false,
	previewText: '',
	registerSubmit: () => {},
	clearSubmit: () => {},
});

export default TurnControlContext;
```

- [ ] **Step 2: Add provider state to GameApp.js**

In `public/client/src/GameApp.js`, add the import and state. After the existing imports (around line 14), add:

```js
import TurnControlContext from './TurnControlContext.js';
```

Inside the `GameApp` function, after the existing `mapInteractionValue` block (around line 186), add:

```js
const [turnSubmitHandler, setTurnSubmitHandler] = useState(null);
const [turnSubmitLabel, setTurnSubmitLabel] = useState('Submit');
const [turnSubmitEnabled, setTurnSubmitEnabled] = useState(false);
const [turnSubmitting, setTurnSubmitting] = useState(false);
const [turnPreviewText, setTurnPreviewText] = useState('');

const registerSubmit = useCallback(({ handler, label, enabled, preview }) => {
	setTurnSubmitHandler(() => handler);
	if (label !== undefined) setTurnSubmitLabel(label);
	if (enabled !== undefined) setTurnSubmitEnabled(enabled);
	if (preview !== undefined) setTurnPreviewText(preview);
}, []);

const clearSubmit = useCallback(() => {
	setTurnSubmitHandler(null);
	setTurnSubmitLabel('Submit');
	setTurnSubmitEnabled(false);
	setTurnSubmitting(false);
	setTurnPreviewText('');
}, []);

const turnControlValue = useMemo(
	() => ({
		submitHandler: turnSubmitHandler,
		submitLabel: turnSubmitLabel,
		submitEnabled: turnSubmitEnabled,
		submitting: turnSubmitting,
		setSubmitting: setTurnSubmitting,
		previewText: turnPreviewText,
		registerSubmit,
		clearSubmit,
	}),
	[turnSubmitHandler, turnSubmitLabel, turnSubmitEnabled, turnSubmitting, turnPreviewText, registerSubmit, clearSubmit]
);
```

Wrap the existing JSX with the new provider. In the return statement, add `TurnControlContext.Provider` inside the existing `MapInteractionContext.Provider`:

```jsx
<MapInteractionContext.Provider value={mapInteractionValue}>
	<TurnControlContext.Provider value={turnControlValue}>
		{/* existing children */}
	</TurnControlContext.Provider>
</MapInteractionContext.Provider>
```

- [ ] **Step 3: Run tests**

Run: `cd public/client && npm test -- --watchAll=false --ci`

Expected: All tests pass. The new provider is passive — nothing reads from it yet.

- [ ] **Step 4: Commit**

```bash
git add public/client/src/TurnControlContext.js public/client/src/GameApp.js
git commit -m "feat: add TurnControlContext for sidebar submit coordination"
```

---

## Task 5: Create SidebarSubmit Component

**Files:**
- Create: `public/client/src/SidebarSubmit.js`
- Modify: `public/client/src/MapOverlay.css` (add styles)

- [ ] **Step 1: Create the component**

Create `public/client/src/SidebarSubmit.js`:

```js
import React, { useContext } from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import TurnControlContext from './TurnControlContext.js';
import UserContext from './UserContext.js';
import { getCountryColorPalette } from './countryColors.js';
import SoundManager from './SoundManager.js';

function SidebarSubmit() {
	const turnControl = useContext(TurnControlContext);
	const context = useContext(UserContext);
	const palette = getCountryColorPalette(context.colorblindMode);

	if (!turnControl.submitHandler) return null;

	let bgColor = '#13a8a8'; // default teal
	if (context.country && palette.mid[context.country]) {
		bgColor = palette.mid[context.country];
	}

	async function handleClick() {
		if (!turnControl.submitEnabled || turnControl.submitting) return;
		turnControl.setSubmitting(true);
		SoundManager.playSubmit();
		try {
			await turnControl.submitHandler(context);
		} finally {
			turnControl.setSubmitting(false);
		}
	}

	return (
		<div className="imp-sidebar-submit">
			<button
				className="imp-sidebar-submit__btn"
				style={{ backgroundColor: bgColor }}
				disabled={!turnControl.submitEnabled || turnControl.submitting}
				onClick={handleClick}
			>
				{turnControl.submitting ? (
					<LoadingOutlined style={{ marginRight: 8 }} />
				) : null}
				{turnControl.submitLabel}
			</button>
		</div>
	);
}

export default SidebarSubmit;
```

- [ ] **Step 2: Add styles to MapOverlay.css**

Append to `public/client/src/MapOverlay.css`:

```css
/* ── Sidebar Submit (anchored at bottom) ── */
.imp-sidebar-submit {
	position: sticky;
	bottom: 0;
	padding: var(--space-3) var(--space-4);
	background: linear-gradient(to top, var(--bg-surface) 60%, transparent);
	z-index: 5;
}

.imp-sidebar-submit__btn {
	width: 100%;
	padding: var(--space-3) var(--space-4);
	border: none;
	border-radius: var(--radius-md);
	color: #fff;
	font-family: var(--font-display);
	font-weight: 600;
	font-size: 15px;
	cursor: pointer;
	transition: opacity 0.15s ease-out;
}

.imp-sidebar-submit__btn:hover:not(:disabled) {
	opacity: 0.85;
}

.imp-sidebar-submit__btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}
```

- [ ] **Step 3: Run tests**

Run: `cd public/client && npm test -- --watchAll=false --ci`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add public/client/src/SidebarSubmit.js public/client/src/MapOverlay.css
git commit -m "feat: add SidebarSubmit component with sticky positioning"
```

---

## Task 6: Create ActionPreview Component

**Files:**
- Create: `public/client/src/ActionPreview.js`
- Modify: `public/client/src/MapOverlay.css` (add styles)

- [ ] **Step 1: Create the component**

Create `public/client/src/ActionPreview.js`:

```js
import React, { useContext } from 'react';
import TurnControlContext from './TurnControlContext.js';

function ActionPreview() {
	const turnControl = useContext(TurnControlContext);

	if (!turnControl.previewText) return null;

	return (
		<div className="imp-action-preview">
			<div className="imp-action-preview__label">Preview</div>
			<div className="imp-action-preview__text">{turnControl.previewText}</div>
		</div>
	);
}

export default ActionPreview;
```

- [ ] **Step 2: Add styles to MapOverlay.css**

Append to `public/client/src/MapOverlay.css`:

```css
/* ── Action Preview ── */
.imp-action-preview {
	margin: var(--space-3) 0;
	padding: var(--space-3);
	background: var(--bg-elevated);
	border-radius: var(--radius-md);
	border-left: 3px solid var(--accent-gold);
}

.imp-action-preview__label {
	font-family: var(--font-mono);
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--text-muted);
	margin-bottom: var(--space-1);
}

.imp-action-preview__text {
	font-family: var(--font-body);
	font-size: 14px;
	color: var(--text-secondary);
	line-height: 1.5;
}
```

- [ ] **Step 3: Commit**

```bash
git add public/client/src/ActionPreview.js public/client/src/MapOverlay.css
git commit -m "feat: add ActionPreview component for sidebar action summary"
```

---

## Task 7: Wire ActionFlow to TurnControlContext

**Files:**
- Modify: `public/client/src/ComponentTemplates.js`

This is the key integration point. ActionFlow currently renders its own submit button. We need it to also register its submit handler in TurnControlContext so SidebarSubmit can render a persistent button at the sidebar bottom.

- [ ] **Step 1: Import TurnControlContext in ComponentTemplates.js**

At the top of `public/client/src/ComponentTemplates.js`, add:

```js
import TurnControlContext from './TurnControlContext.js';
```

- [ ] **Step 2: Register submit handler in ActionFlow**

Inside the `ActionFlow` function (starts around line 961), add `useContext` for TurnControlContext and registration effects.

After the existing `const context = useContext(UserContext);` line, add:

```js
const turnControl = useContext(TurnControlContext);
```

Add an effect that registers the submit handler and updates enabled/label state. Place it after the existing `useEffect` blocks in ActionFlow:

```js
useEffect(() => {
	if (!submit || !submitMethod) return;

	let allVisible = flowState.visibleLayers.every((v) => v);
	let label = 'Submit';
	if (type === 'proposal') label = 'Submit Proposal';
	else if (type === 'vote') label = 'Submit Vote';
	else if (type === 'buy') label = 'Buy Stock';
	else if (type === 'bid') label = 'Submit Bid';

	turnControl.registerSubmit({
		handler: submitMethod,
		label: label,
		enabled: allVisible,
	});

	return () => {
		turnControl.clearSubmit();
	};
}, [submit, submitMethod, type, flowState.visibleLayers, turnControl]);
```

- [ ] **Step 3: Hide ActionFlow's own submit button when SidebarSubmit is active**

In ActionFlow's render, find where the SubmitButton is rendered (around line 1043). Wrap it so it only renders if no TurnControlContext handler is registered:

Change the submit button rendering from:

```js
{submit && allVisible ? <SubmitButton data={handleSubmit} /> : null}
```

to:

```js
{submit && allVisible && !turnControl.submitHandler ? <SubmitButton data={handleSubmit} /> : null}
```

This hides the inline submit button when SidebarSubmit is handling it. If TurnControlContext has no provider (e.g., in tests), `turnControl.submitHandler` is `null` and the inline button still renders.

- [ ] **Step 4: Run tests**

Run: `cd public/client && npm test -- --watchAll=false --ci`

Expected: All tests pass. Tests render ActionFlow without a TurnControlContext.Provider, so the default context value (`submitHandler: null`) means the inline button still renders in tests.

- [ ] **Step 5: Commit**

```bash
git add public/client/src/ComponentTemplates.js
git commit -m "feat: ActionFlow registers submit handler in TurnControlContext"
```

---

## Task 8: Render ActionPreview and SidebarSubmit in Sidebar

**Files:**
- Modify: `public/client/src/Sidebar.js`

- [ ] **Step 1: Import the new components**

At the top of `public/client/src/Sidebar.js`, add:

```js
import ActionPreview from './ActionPreview.js';
import SidebarSubmit from './SidebarSubmit.js';
```

- [ ] **Step 2: Add ActionPreview and SidebarSubmit to the Turn tab**

In the `renderTabContent` function (around line 290), find the `'turn'` case (around line 292). It currently renders `StaticTurnApp` and `DisplayMode`. After the `DisplayMode` component and before the closing of the turn tab content, add `ActionPreview`. Then add `SidebarSubmit` at the very bottom of the sidebar scroll area.

The turn tab section should look like:

```jsx
case 'turn':
	return (
		<>
			<StaticTurnApp />
			<DisplayMode mode={state.mode} />
			<ActionPreview />
		</>
	);
```

For `SidebarSubmit`, it should render outside the tab content scroll area so it sticks to the bottom. In the main sidebar render (around line 362), add it after the scrollable content div and before the sidebar closing tag:

```jsx
<div className="imp-sidebar__content" /* existing scrollable area */>
	{renderTabHeader()}
	{renderTabContent()}
</div>
<SidebarSubmit />
```

The exact placement depends on the sidebar structure. The key is: `SidebarSubmit` should be inside the sidebar but outside the scrollable content area, so its `position: sticky; bottom: 0` anchors it at the bottom.

- [ ] **Step 3: Visual verification**

Run the dev server. Load a game where it's your turn. Verify:
- The submit button appears at the bottom of the sidebar (not inline in the form)
- The button label matches the action type ("Submit Proposal", "Submit Vote", etc.)
- The button is colored with the active country's color
- Clicking the button submits the turn
- The button shows a loading spinner during submit
- When it's not your turn, no submit button appears

- [ ] **Step 4: Run tests**

Run: `cd public/client && npm test -- --watchAll=false --ci`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add public/client/src/Sidebar.js
git commit -m "feat: render ActionPreview and SidebarSubmit in sidebar"
```

---

## Task 9: Add Preview Text Registration to Mode Components

**Files:**
- Modify: `public/client/src/ProposalApp.js`
- Modify: `public/client/src/VoteApp.js`
- Modify: `public/client/src/BuyApp.js`
- Modify: `public/client/src/BidApp.js`

Each mode component should register preview text in TurnControlContext so ActionPreview can display it.

- [ ] **Step 1: Add preview text to ProposalApp sub-flows**

In `public/client/src/ProposalApp.js`, import TurnControlContext:

```js
import TurnControlContext from './TurnControlContext.js';
```

In each sub-flow component (TaxFlow, ProduceFlow, ImportFlow, FactoryFlow, ManeuverFlow, InvestorFlow), add a `useContext(TurnControlContext)` call and a `useEffect` that registers preview text based on the current selections.

For example, in `TaxFlow` (around line 16):

```js
function TaxFlow(props) {
	const turnControl = useContext(TurnControlContext);

	useEffect(() => {
		turnControl.registerSubmit({
			preview: 'Propose: Taxation',
		});
	}, []);

	return (
		/* existing JSX */
	);
}
```

For `ProduceFlow`, the preview should reflect which territories are selected for production. Since ProduceSelect tracks selections in UserContext, read those and build a preview string:

```js
function ProduceFlow(props) {
	const context = useContext(UserContext);
	const turnControl = useContext(TurnControlContext);

	useEffect(() => {
		let selections = context.produceArmy || [];
		let fleetSelections = context.produceFleet || [];
		let parts = [];
		if (selections.length) parts.push('Armies: ' + selections.join(', '));
		if (fleetSelections.length) parts.push('Fleets: ' + fleetSelections.join(', '));
		turnControl.registerSubmit({
			preview: 'Propose: Produce' + (parts.length ? ' — ' + parts.join('; ') : ''),
		});
	}, [context.produceArmy, context.produceFleet]);

	return (
		/* existing JSX */
	);
}
```

Apply similar patterns to ImportFlow, FactoryFlow, ManeuverFlow. The exact UserContext fields for each selection need to be read from the component's existing code. The preview text should be a simple human-readable string.

Note: `registerSubmit` merges — calling it with just `{ preview }` updates only the preview field without clearing handler/label/enabled.

- [ ] **Step 2: Add preview text to VoteApp**

In `public/client/src/VoteApp.js`, the ActionFlow's RadioSelect captures the vote selection. Since ActionFlow already calls `registerSubmit` with handler/label/enabled, the preview needs to come from the vote option selected. This can be added as a `data` callback on the RadioSelect that also updates preview text.

For now, a simple static preview is sufficient:

```js
// In VoteApp's ActionFlow, add type="vote" (already present)
// The preview will show "Vote on: [proposal]" once we wire it
```

- [ ] **Step 3: Run tests**

Run: `cd public/client && npm test -- --watchAll=false --ci`

Expected: All tests pass.

- [ ] **Step 4: Visual verification**

Run the dev server. Start a proposal turn. Select "Produce" on the rondel, then select some factories. Verify the ActionPreview shows "Propose: Produce — Armies: Vienna, Budapest" (or similar based on selections).

- [ ] **Step 5: Commit**

```bash
git add public/client/src/ProposalApp.js public/client/src/VoteApp.js public/client/src/BuyApp.js public/client/src/BidApp.js
git commit -m "feat: mode components register preview text in TurnControlContext"
```

---

## Task 10: Restyle Vote Buttons

**Files:**
- Modify: `public/client/src/VoteApp.js`
- Modify: `public/client/src/MapOverlay.css`

- [ ] **Step 1: Replace RadioSelect with large styled buttons in VoteApp**

In `public/client/src/VoteApp.js`, replace the ActionFlow that uses RadioSelect with a custom render that shows large vote option buttons.

Replace the entire VoteApp component:

```js
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import UserContext from './UserContext.js';
import TurnControlContext from './TurnControlContext.js';
import * as miscAPI from './backendFiles/miscAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import useGameState from './useGameState.js';

function VoteApp() {
	const context = useContext(UserContext);
	const turnControl = useContext(TurnControlContext);
	const [options, setOptions] = useState([]);
	const [selected, setSelected] = useState(null);
	const contextRef = useRef(context);
	contextRef.current = context;

	const { gameState } = useGameState();

	const loadOptions = useCallback(async () => {
		let opts = await miscAPI.getVoteOptions(contextRef.current);
		setOptions(opts || []);
	}, []);

	useEffect(() => {
		loadOptions();
	}, [gameState, loadOptions]);

	useEffect(() => {
		turnControl.registerSubmit({
			handler: submitAPI.submitVote,
			label: 'Submit Vote',
			enabled: selected !== null,
			preview: selected ? 'Vote: ' + selected : '',
		});
		return () => turnControl.clearSubmit();
	}, [selected, turnControl]);

	function handleSelect(option) {
		setSelected(option);
		context.setVote(option);
	}

	return (
		<div className="imp-vote-buttons">
			{options.map((opt) => (
				<button
					key={opt}
					className={
						'imp-vote-buttons__option' + (selected === opt ? ' imp-vote-buttons__option--selected' : '')
					}
					onClick={() => handleSelect(opt)}
				>
					{opt}
				</button>
			))}
		</div>
	);
}

export default VoteApp;
```

- [ ] **Step 2: Add vote button styles to MapOverlay.css**

Append to `public/client/src/MapOverlay.css`:

```css
/* ── Vote Buttons ── */
.imp-vote-buttons {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: var(--space-3) 0;
}

.imp-vote-buttons__option {
	padding: var(--space-4) var(--space-4);
	background: var(--bg-elevated);
	border: 2px solid rgba(255, 255, 255, 0.1);
	border-radius: var(--radius-md);
	color: var(--text-primary);
	font-family: var(--font-body);
	font-size: 16px;
	font-weight: 500;
	text-align: left;
	cursor: pointer;
	transition: border-color 0.15s ease-out, background 0.15s ease-out;
}

.imp-vote-buttons__option:hover {
	border-color: var(--accent-teal);
	background: rgba(19, 168, 168, 0.08);
}

.imp-vote-buttons__option--selected {
	border-color: var(--accent-teal);
	background: rgba(19, 168, 168, 0.15);
}
```

- [ ] **Step 3: Run tests**

Run: `cd public/client && npm test -- --watchAll=false --ci`

Some existing VoteApp tests may need updating since we replaced the component internals. If `ModeComponents.test.js` has smoke tests that render VoteApp, check that they still pass. If they fail due to missing ActionFlow render, update them to provide TurnControlContext.

- [ ] **Step 4: Visual verification**

Run the dev server. Get to a vote turn (requires a democracy proposal cycle). Verify:
- Large buttons appear for each vote option
- Selecting a button highlights it with teal border
- SidebarSubmit shows "Submit Vote" at the bottom
- Submitting works

- [ ] **Step 5: Commit**

```bash
git add public/client/src/VoteApp.js public/client/src/MapOverlay.css
git commit -m "feat: restyle VoteApp with large option buttons"
```

---

## Task 11: Restyle PeaceVoteApp Buttons

**Files:**
- Modify: `public/client/src/PeaceVoteApp.js`
- Modify: `public/client/src/MapOverlay.css`

- [ ] **Step 1: Update PeaceVoteApp button styles**

PeaceVoteApp already has custom Accept/Reject buttons (not using ActionFlow). Update the button styling to match the new design. In `public/client/src/PeaceVoteApp.js`, add the CSS classes to the existing buttons:

Find the Accept/Reject button rendering (around lines 94-107). Update the button elements to use the new classes:

```jsx
<button
	className="imp-vote-buttons__option imp-vote-buttons__option--accept"
	onClick={() => submitVote('accept')}
	disabled={submitting}
>
	Accept Peace
</button>
<button
	className="imp-vote-buttons__option imp-vote-buttons__option--reject"
	onClick={() => submitVote('reject')}
	disabled={submitting}
>
	Reject Peace
</button>
```

- [ ] **Step 2: Add peace vote button styles**

Append to `public/client/src/MapOverlay.css`:

```css
.imp-vote-buttons__option--accept {
	border-color: var(--success);
}

.imp-vote-buttons__option--accept:hover,
.imp-vote-buttons__option--accept.imp-vote-buttons__option--selected {
	border-color: var(--success);
	background: rgba(73, 170, 25, 0.12);
}

.imp-vote-buttons__option--reject {
	border-color: var(--error);
}

.imp-vote-buttons__option--reject:hover,
.imp-vote-buttons__option--reject.imp-vote-buttons__option--selected {
	border-color: var(--error);
	background: rgba(211, 32, 41, 0.12);
}
```

- [ ] **Step 3: Run tests**

Run: `cd public/client && npm test -- --watchAll=false --ci`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add public/client/src/PeaceVoteApp.js public/client/src/MapOverlay.css
git commit -m "feat: restyle PeaceVoteApp with larger vote buttons"
```

---

## Task 12: Final Verification

**Files:** None (testing only)

- [ ] **Step 1: Run full test suite**

```bash
cd public/client && npm test -- --watchAll=false --ci
```

Expected: All tests pass.

- [ ] **Step 2: Run format check**

```bash
cd public/client && npm run format:check
```

If formatting fails, run `npm run format` and commit.

- [ ] **Step 3: Run build**

```bash
cd public/client && npm run build
```

Expected: Build succeeds with zero warnings.

- [ ] **Step 4: Run verify.sh**

```bash
cd public/client && bash verify.sh
```

Expected: All checks pass.

- [ ] **Step 5: Visual smoke test**

Run the dev server and verify these flows:
1. **Lobby:** App loads, fonts render (Geist for headings)
2. **Proposal turn:** Rondel sectors are clickable, sub-actions activate on map, submit button at sidebar bottom
3. **Vote turn:** Large vote buttons appear, submit works
4. **Maneuver:** Existing ManeuverPlannerApp unchanged, still works
5. **Financial data:** Treasury values render in JetBrains Mono

- [ ] **Step 6: Commit any formatting fixes**

```bash
git add -u
git commit -m "chore: format code"
```
