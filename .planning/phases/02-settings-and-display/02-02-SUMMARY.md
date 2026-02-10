---
phase: 02-settings-and-display
plan: 02
subsystem: ui
tags: [number-formatting, intl, tooltips, css, 24h-time, preferences]

# Dependency graph
requires:
  - phase: 02-01
    provides: "formatNumber, formatHour utilities and preferences service with onPreferencesChanged"
provides:
  - "All numeric displays use locale-aware thousand separators via formatNumber"
  - "ActivityChart axis labels respond to 24h time preference"
  - "Stat card hover tooltips with descriptive text"
  - "StatsPage re-renders immediately when preferences change"
affects: [02-03, display-components, preferences-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "format={formatNumber} prop on AnimatedNumber for formatted animation frames"
    - "CSS-only hover tooltips via .stat-tooltip-wrapper + .stat-tooltip"
    - "onPreferencesChanged subscription pattern for reactive preference updates"

key-files:
  created: []
  modified:
    - src/app/components/OverviewCards.tsx
    - src/app/components/TopLists.tsx
    - src/app/components/ActivityChart.tsx
    - src/app/index.tsx
    - src/app/styles.css

key-decisions:
  - "Tooltip text is descriptive/informational rather than playful (e.g. 'Estimated amount...' not 'From you listening!')"
  - "Dynamic tooltip text for newArtists/listenedDays card based on which stat is displayed"

patterns-established:
  - "CSS-only tooltips: .stat-tooltip-wrapper (relative) + .stat-tooltip (absolute, opacity transition)"
  - "Preference reactivity: subscribe to onPreferencesChanged in componentDidMount, forceUpdate, cleanup in componentWillUnmount"

# Metrics
duration: 2min
completed: 2026-02-10
---

# Phase 2 Plan 2: Display Formatting Wiring Summary

**Locale-aware number formatting across all stats, 24h-aware chart labels, and CSS hover tooltips on all stat cards**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-10T20:25:08Z
- **Completed:** 2026-02-10T20:27:39Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- All numeric play counts and stat values display with locale-aware thousand separators (formatNumber)
- AnimatedNumber receives format prop so animation frames also show separators (no visual jump)
- Activity chart axis labels and tooltips now dynamic via formatHour (responds to 24h preference)
- Every overview stat card shows a descriptive hover tooltip on mouseover
- StatsPage subscribes to preference changes and re-renders immediately when toggles flip

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire formatNumber into OverviewCards and TopLists, add stat card tooltips** - `96cee6c` (feat)
2. **Task 2: Wire formatHour into ActivityChart and subscribe StatsPage to preference changes** - `c7fefa7` (feat)

## Files Created/Modified
- `src/app/components/OverviewCards.tsx` - Added formatNumber to all numeric displays, format prop on AnimatedNumber, tooltip wrappers with descriptive text
- `src/app/components/TopLists.tsx` - Wrapped playCount and trackCount displays with formatNumber
- `src/app/components/ActivityChart.tsx` - Switched formatHour import from utils to format.ts, dynamic chart labels
- `src/app/index.tsx` - Added onPreferencesChanged subscription and cleanup
- `src/app/styles.css` - Appended .stat-tooltip-wrapper and .stat-tooltip CSS rules

## Decisions Made
- Tooltip text changed from playful/casual to descriptive/informational (e.g., "Estimated amount Spotify paid artists from your streams ($0.004/stream)" instead of "From you listening to their music!")
- The newArtists/listenedDays card uses dynamic tooltip text matching which stat is currently displayed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All display formatting wired and reactive to preferences
- Ready for 02-03 (remaining settings/display features)

## Self-Check: PASSED

All 5 modified files verified on disk. Both task commits (96cee6c, c7fefa7) verified in git log.

---
*Phase: 02-settings-and-display*
*Completed: 2026-02-10*
