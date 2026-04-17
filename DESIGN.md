# Design System — Imperial Game

## Core Principle

The original pre-map-interaction design was well-liked by players. This document
codifies that aesthetic and extends it with new capabilities. **Do not deviate from
this spec without explicit user approval.** Do not "improve" styles, "clean up"
layouts, or "modernize" components on your own initiative.

## Product Context
- **What this is:** Multiplayer online strategy board game (Imperial variant)
- **Who it's for:** Mix of casual friend groups and serious strategy gamers
- **Space:** Online board game adaptations (Diplomacy, wargames, economic strategy)
- **Project type:** Real-time web app (React + Ant Design + Firebase)
- **Design posture:** Refine and extend, don't replace. The game already has good bones.

## Aesthetic Direction
- **Direction:** Strategic Cartography — modern, dark, precise. A refined ops room, not fantasy.
- **Decoration:** Minimal. Typography and color do the work. The map IS the decoration.
- **Mood:** Serious enough for strategy gamers, approachable enough for friends. Clean, not flashy.
- **What this is NOT:** Parchment textures, coat-of-arms icons, fantasy flourishes, retro terminal, maximalist.

## Typography

| Role | Font | Weight | Size | Notes |
|------|------|--------|------|-------|
| Display/Headings | Geist | 700 | 24-48px | Sharp geometric sans. Turn titles, page headings. |
| Body/UI | System sans-serif | 400/500 | 16px body, 14px UI | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |
| Data/Financial | JetBrains Mono | 400/600 | 14-22px | Treasury, scores, stock prices. Must use `tabular-nums`. |
| Code | JetBrains Mono | 400 | 13px | Debug info only |

**Rules:**
- Max 2 loaded font families (Geist + JetBrains Mono). Body uses system stack.
- No serif fonts anywhere.
- No decorative or display-only fonts.
- Body text minimum 16px. UI labels can be 14px.
- Key financial values (treasury, points, stock prices) should be 18-22px bold mono.
- Line-height: 1.5 for body, 1.2 for headings.
- Load via Google Fonts: `Geist:wght@400;500;600;700` and `JetBrains+Mono:wght@400;500;600`

**Modular scale (px):**
12 / 13 / 14 / 16 / 18 / 22 / 28 / 36 / 48

## Color

### Core Palette
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#090B0F` | Main background (deep blue-black) |
| `--bg-surface` | `#12141A` | Cards, panels, sidebar |
| `--bg-elevated` | `#1A1D24` | Hover states, raised elements, popovers |
| `--accent-gold` | `#C9A84C` | Signature accent — borders, highlights, headings |
| `--accent-teal` | `#13A8A8` | Interactive — buttons, focus rings, submit |
| `--text-primary` | `rgba(255,255,255,0.87)` | Primary text |
| `--text-secondary` | `rgba(255,255,255,0.70)` | Secondary text, labels |
| `--text-muted` | `rgba(255,255,255,0.38)` | Disabled text ONLY — never for readable labels |

### Country Colors (sacred — do not modify)
| Country | Color | Hex |
|---------|-------|-----|
| Austria | Yellow | `#D4A843` |
| Italy | Green | `#49AA19` |
| France | Blue | `#4DAADB` |
| Germany | Gray | `#888888` |
| Russia | Pink | `#CC79A7` |
| England | Red | `#D32029` |

Country colors are used on the map, score track, stock badges, country card accents,
and action buttons. They are the primary source of visual identity in the game.

### Semantic Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--success` | `#49AA19` | Positive actions, confirmations |
| `--error` | `#D32029` | Errors, destructive actions |
| `--warning` | `#D8BD14` | Cautions, timer warnings |
| `--info` | `#177DDC` | Informational messages |

**Rules:**
- Labels use `--text-secondary` (0.70 opacity) minimum. Never use `--text-muted` for readable text.
- Gold accent for borders, dividers, and heading emphasis. Not for interactive elements.
- Teal for all interactive controls (buttons, links, focus states).
- Country colors override teal on country-specific action buttons.

## Spacing

**Base unit:** 4px

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight gaps (icon padding, badge gaps) |
| `--space-2` | 8px | Default gap between related items |
| `--space-3` | 12px | Panel internal padding |
| `--space-4` | 16px | Section spacing, card padding |
| `--space-6` | 24px | Major section breaks |
| `--space-8` | 32px | Page-level spacing |
| `--space-12` | 48px | Large separations |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 2px | Inputs, badges, small elements |
| `--radius-md` | 4px | Cards, panels, buttons |
| `--radius-lg` | 6px | Modals, large containers |
| `--radius-round` | 50% | Avatars, circular markers |

Conservative and appropriate for the serious tone. No large bubbly radii.

## Layout

### Overall Structure
The game has a **map-dominant layout with a persistent sidebar.**

```
+--------------------------------------------------+--------+
|                                                  |        |
|                                                  | Player |
|              Interactive Map (SVG)               | Cards  |
|              + Rondel overlay                    |        |
|              + Unit markers                      | Country|
|              + Territory hotspots                | Cards  |
|                                                  |        |
|                                                  | Stock  |
|    [contextual popovers at click locations]      | Info   |
|                                                  |        |
|                                                  |--------|
|                                                  | Submit |
+--------------------------------------------------+--------+
```

- **Map area** takes ~70% of viewport width. Always visible. Never shrinks.
- **Sidebar** takes ~30% (or fixed ~320px). Always visible. Shows persistent game state.
- The map is the primary interaction surface for spatial decisions.
- The sidebar is the persistent reference for financial/ownership data.

### Sidebar Contents
The sidebar shows game state that players need to reference continuously:
- **Player cards** — each player's score, money, stock portfolio (colored badges)
- **Country cards** — each country's points, treasury, last tax, wheel position, government type, leadership, available stock, ownership
- **Submit button** — anchored at the bottom of the sidebar. Always in the same location.

The sidebar also provides **secondary controls** for the current action. These mirror
and sync with map interactions. When you click on the map, the sidebar updates. When
you change something in the sidebar, the map reflects it.

The sidebar should include an **action preview** showing what will happen when you submit.

### Rondel
The rondel (action wheel) is a first-class visual element. It lives on or near the map.
It shows all 8 sectors (Taxation, Factory, Produce x2, Maneuver x2, Investor, Import)
and the current position of each country.

The rondel is both:
- **A reference** — where is each country on the wheel?
- **An interaction** — click a sector to choose your action during proposal turns

## Interaction Model

### The Map-First Principle
The map is always full-size. Controls adapt their prominence based on whether the
map matters for the current decision.

### Decision Control Locations

| Decision Type | Primary Control | Secondary Control | Map Relevance |
|---------------|-----------------|-------------------|---------------|
| **Proposal** (wheel action) | Click rondel sector | Sidebar shows action options | High — rondel is on/near map |
| **Maneuver** | Click unit, click destination on map | Sidebar shows move list + preview | High — spatial |
| **Produce** | Toggle factories on map | Sidebar shows production choices | High — spatial |
| **Import** | Click factory cities on map | Sidebar shows import choices | High — spatial |
| **Factory** | Click territory on map | Sidebar shows build location | High — spatial |
| **Taxation** | (Simple action, no spatial input) | Sidebar shows tax preview + submit | Low — but map stays visible |
| **Buy stock** | TBD (future redesign) | Sidebar-based | Low — financial |
| **Bid** | TBD (future redesign) | Sidebar-based | Low — financial |
| **Vote** | Controls can be more prominent | Sidebar or dedicated area | Low — non-spatial |
| **Peace Vote** | Controls can be more prominent | Same as vote | Low — non-spatial |

### Proposal Flow (detail)
1. Player clicks a rondel sector → immediately enters that action's sub-selection mode
2. Map highlights relevant interactive elements (units, factories, territories)
3. Sidebar updates to show secondary controls + action preview
4. Player can click a different rondel sector at any time to switch (non-destructive)
5. Sub-selections happen on the map (primary) or sidebar (secondary), both synced
6. Submit button at bottom of sidebar locks in the proposal

### Sub-Decision Popovers
When a spatial action requires a sub-decision (e.g., action type during maneuver,
army vs fleet during import), a **contextual popover appears at the click location**
on the map. This keeps the player's eyes on the board.

### Submit Pattern
- Submit button always at the bottom of the sidebar, same location every time.
- Button labeled with the specific action ("Submit Proposal", "Confirm Move", "Collect Tax")
- Button color matches the active country's color when appropriate.

## Component Patterns

### Country Card
- Country-colored accent bar at top (3px)
- Country name (left) + points (right, country color, mono font)
- Key-value grid: Treasury, Last Tax, Wheel, Gov
- Available stock badges (numbered, country-colored)
- Ownership list (who owns what stock)

### Player Card
- Player name + total score
- Money display (mono font)
- Stock portfolio as colored numbered badges
- Investor/Swiss banker indicators

### Stock Badges
Colored numbered squares per player — compact portfolio visualization.
This pattern is well-liked and should be preserved exactly.

### Score Track
Horizontal 0-25 track with country-colored markers.

## Motion
- **Approach:** Minimal-functional. Only transitions that aid comprehension.
- **Duration:** 150ms for state changes, 250ms for panel open/close.
- **Easing:** ease-out for entrances, ease-in for exits.
- **Properties:** Only animate `transform` and `opacity`.
- **Accessibility:** Respect `prefers-reduced-motion`.

## Guard Rails

**DO NOT without explicit user approval:**
- Change the font stack (no serif fonts, no decorative fonts)
- Modify country colors
- Add textures, gradients, or ornamental decoration
- Increase border-radius beyond 6px
- Remove or reorganize sidebar content
- Replace the stock badge pattern
- Add animations beyond the minimal spec above
- "Clean up" or "modernize" working components
- Rewrite existing UI text

**These patterns are PROTECTED:**
- Stock badges (colored numbered squares)
- Country card layout (accent bar + stats + stock info)
- Dark theme with gold accent
- Map-dominant layout with sidebar
- Ant Design as the component library

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-15 | Fresh design system created | Previous DESIGN.md was from audit, starting clean |
| 2026-04-15 | Geist + system sans + JetBrains Mono | Sharp, modern, no serif per user preference |
| 2026-04-15 | Map-dominant layout with sidebar | Map is primary interaction, sidebar is persistent reference |
| 2026-04-15 | Dual-input pattern (map primary, sidebar secondary) | All spatial actions can be input via map or sidebar, synced |
| 2026-04-15 | Contextual popovers for sub-decisions | Keep player's eyes on the map, not a separate panel |
| 2026-04-15 | Submit button anchored at bottom of sidebar | Consistent location, muscle memory |
| 2026-04-15 | Guard rails section added | Previous Claude sessions purged well-liked design without approval |
| 2026-04-16 | **OVERRIDE:** Portfolio row removed from sidebar; Players tab removed | Replaced by always-on PlayersColumn (own column between map and Sidebar) — user's info is visually highlighted in that column (3px gold accent bar + elevated background + aria-current). Old portfolio + Players tab became redundant. See `~/.gstack/projects/MeghalG-imperialgame/aok-main-design-20260416-162421.md` for the full review. |
| 2026-04-16 | **OVERRIDE:** Submit button moved from sidebar bottom to floating FAB over the map (bottom-right) | Sidebar bottom-space reclaimed for info. FAB preserves muscle-memory by being consistently anchored at the map's bottom-right corner. Action preview pill attaches above the FAB. Guard rail language preserved — this is a named exception, not a pattern-change. |
| 2026-04-16 | Countries is the sidebar's default tab (Turn during `continue-man` only) | Reference > input priority during a turn. Maneuver mode is the one exception because the maneuver planner needs the tab's full space. |
| 2026-04-16 | CountryCard: "Owned" row removed; gov display replaced with DEM/DICT pill + flag-icon chips | Ownership is now visible in the PlayersColumn's stock badges (no duplication). Old `Gov Dem: aok/agrebe` line was illegible — replaced with a small uppercase pill + named chips using country-colored flag icons (FlagFilled for leader, FlagOutlined for opposition). |
| 2026-04-16 | PlayersColumn reading order: name → leadership flags → stock badges → right-aligned money + muted score | User ranked field priority explicitly during /office-hours — leadership and stock are high-priority reference; money/score low. |
