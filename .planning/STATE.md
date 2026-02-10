# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** Accurate, reliable listening statistics that match what the source services report
**Current focus:** Phase 5 - Onboarding and Tour

## Current Position

Phase: 5 of 6 (Onboarding and Tour) -- COMPLETE
Plan: 3 of 3 in current phase
Status: Phase Complete
Last activity: 2026-02-10 -- Completed 05-03 (tour integration)

Progress: [█████████░] 90%

## Performance Metrics

**Velocity:**
- Total plans completed: 13
- Average duration: 2min
- Total execution time: 0.45 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-integrity | 2 | 4min | 2min |
| 02-settings-and-display | 3 | 6min | 2min |
| 03-data-accuracy-and-api-resilience | 3 | 6min | 2min |
| 04-drag-and-drop-layout | 2 | 4min | 2min |
| 05-onboarding-and-tour | 3 | 6min | 2min |

**Recent Trend:**
- Last 5 plans: 04-01 (1min), 04-02 (3min), 05-01 (2min), 05-02 (1min), 05-03 (3min)
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Custom implementations for DnD and Tour (no new runtime deps) -- libraries as contingency only
- [Roadmap]: Data integrity bugs before feature work -- migration and double-counting fixes are blockers
- [01-01]: Backup tries localStorage first, falls back to separate IndexedDB on QuotaExceededError
- [01-01]: Stale backups always replaced (never skipped) in backupBeforeMigration
- [01-01]: PlayEvent type field optional and backward-compatible (undefined = play)
- [01-02]: onprogress handler only activates loop detection when getRepeat() === 2 (repeat-one) for near-zero overhead
- [01-02]: 90%/10% position thresholds for loop boundary detection to avoid false positives from seeking
- [01-02]: SKIP_THRESHOLD_MS retained for backward compat; handleSongChange uses getPlayThreshold() for all new logic
- [02-01]: Only new display/UI preferences in unified service; existing localStorage keys stay where they are
- [02-01]: Module-level Intl.NumberFormat instance (no locale arg) -- browser default, cached at import time
- [02-01]: formatHour reads preference on every call (not cached) to react to preference changes without re-import
- [02-02]: Tooltip text is descriptive/informational rather than playful (matches tooltip UX conventions)
- [02-02]: Dynamic tooltip text on newArtists/listenedDays card based on which stat is currently displayed
- [02-03]: SettingsCategory is internal helper (not exported) to keep settings panel self-contained
- [02-03]: Layout category is a stub placeholder for Phase 4 drag-and-drop
- [02-03]: URI enrichment runs after artist image enrichment in both calculateRecentStats and calculateRankedStats
- [Phase 03]: Timezone offset negates JS getTimezoneOffset() to match stats.fm convention (minutes east of UTC)
- [Phase 03]: dateStats hourly distribution falls back to recent-50-streams for non-Plus users whose endpoint may 400/403
- [03-02]: No new runtime deps for resilience -- CircuitBreaker, batch coalescer, retry all hand-rolled per project convention
- [03-02]: Circuit breaker: 5 failures / 60s reset; batch coalescer: 50ms window / 50 max batch
- [03-02]: ApiError marks 429+5xx retryable, 4xx non-retryable to avoid hammering permanent failures
- [03-03]: ImageWithRetry uses 3 retries with 1s/2s/4s backoff and ?retry=N cache-busting
- [03-03]: Error discrimination uses instanceof ApiError + name fallback for cross-bundle safety
- [04-01]: Drag handle positioned absolutely at left edge (-32px) for clean separation from section content
- [04-01]: Only drag handle is draggable (not wrapper div) to preserve child click interactions
- [04-01]: useSectionOrder validates stored order on init: removes stale IDs, appends missing for forward compat
- [04-02]: DashboardSections extracted as functional component from class StatsPage to enable hooks
- [04-02]: Custom event (listening-stats:reset-layout) bridges Settings and hook without prop-drilling
- [04-02]: Container-level drag detection via querySelectorAll — no dead zones in gaps between sections
- [04-02]: Auto-scroll at 80px viewport edge zone during drag for long-distance reordering
- [05-02]: TourProvider renders overlay via createPortal to document.body (avoids ancestor transform breaking fixed positioning)
- [05-02]: Spotlight uses box-shadow 9999px rgba(0,0,0,0.6) technique for full-viewport dimming
- [05-02]: Tooltip auto-flips placement when it would overflow viewport bounds
- [05-02]: 300ms delay after scrollIntoView before measuring target rect (scroll settle time)
- [05-01]: Wizard uses separate function components per step (ChooseStep, ConfigureStep, ValidateStep, SuccessStep)
- [05-01]: Validation runs automatically on mount via useEffect, not on button click
- [05-01]: Local tracking bypasses wizard entirely (single click activateProvider + onComplete)
- [05-03]: Tour auto-triggers with 500ms delay after mount to let sections render
- [05-03]: shouldShowTour returns full/update/none based on localStorage tour-seen and tour-version keys
- [05-03]: Custom event listening-stats:start-tour bridges Settings button to DashboardSections hook
- [05-03]: Settings modal closes before tour starts (300ms delay) so tour targets are visible

### Pending Todos

None yet.

### Blockers/Concerns

- ~~Destructive IndexedDB migration pattern in storage.ts~~ RESOLVED in 01-01 (safe incremental migration with backup)
- ~~Dual-bundle event listener duplication may cause double-counted play events~~ RESOLVED in 01-01 (write-time dedup guard) + 01-02 (global handler cleanup pattern extended to onprogress)
- ~~Repeat-one loops not tracked as separate plays~~ RESOLVED in 01-02 (onprogress position reset detection)

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 05-03-PLAN.md (tour integration) -- Phase 5 complete
Resume file: None
