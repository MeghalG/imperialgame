# TODOs

## Drag-to-Reorder in Plan List
**What:** Replace up/down arrow buttons with drag handles and drag-to-reorder behavior in ManeuverPlanList.
**Why:** More intuitive UX for reordering unit moves, especially on mobile (long-press + drag).
**Context:** Currently uses `ArrowUpOutlined`/`ArrowDownOutlined` buttons. Would need a drag library (react-beautiful-dnd, @dnd-kit/sortable). The codebase doesn't currently use any drag libraries.
**Depends on:** Maneuver redesign integration complete.
**Added:** 2026-03-17
