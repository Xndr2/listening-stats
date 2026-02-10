# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** Accurate, reliable listening statistics that match what the source services report
**Current focus:** Phase 3 - Data Accuracy and API Resilience

## Current Position

Phase: 3 of 6 (Data Accuracy and API Resilience)
Plan: 2 of 3 in current phase
Status: Executing
Last activity: 2026-02-10 -- Completed 03-02 (API resilience utilities and queue refactor, 2 tasks, 2 commits)

Progress: [████░░░░░░] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 2min
- Total execution time: 0.25 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-integrity | 2 | 4min | 2min |
| 02-settings-and-display | 3 | 6min | 2min |
| 03-data-accuracy-and-api-resilience | 2 | 4min | 2min |

**Recent Trend:**
- Last 5 plans: 02-01 (1min), 02-02 (2min), 02-03 (3min), 03-01 (1min), 03-02 (3min)
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

### Pending Todos

None yet.

### Blockers/Concerns

- ~~Destructive IndexedDB migration pattern in storage.ts~~ RESOLVED in 01-01 (safe incremental migration with backup)
- ~~Dual-bundle event listener duplication may cause double-counted play events~~ RESOLVED in 01-01 (write-time dedup guard) + 01-02 (global handler cleanup pattern extended to onprogress)
- ~~Repeat-one loops not tracked as separate plays~~ RESOLVED in 01-02 (onprogress position reset detection)

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 03-02-PLAN.md
Resume file: None
