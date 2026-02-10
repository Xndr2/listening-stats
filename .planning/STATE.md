# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** Accurate, reliable listening statistics that match what the source services report
**Current focus:** Phase 2 - Settings and Display

## Current Position

Phase: 2 of 6 (Settings and Display)
Plan: 2 of 3 in current phase
Status: Executing
Last activity: 2026-02-10 -- Completed 02-02 (display formatting wiring + tooltips)

Progress: [████░░░░░░] 33%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 2min
- Total execution time: 0.13 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-integrity | 2 | 4min | 2min |
| 02-settings-and-display | 2 | 3min | 1.5min |

**Recent Trend:**
- Last 5 plans: 01-01 (2min), 01-02 (2min), 02-01 (1min), 02-02 (2min)
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

### Pending Todos

None yet.

### Blockers/Concerns

- ~~Destructive IndexedDB migration pattern in storage.ts~~ RESOLVED in 01-01 (safe incremental migration with backup)
- ~~Dual-bundle event listener duplication may cause double-counted play events~~ RESOLVED in 01-01 (write-time dedup guard) + 01-02 (global handler cleanup pattern extended to onprogress)
- ~~Repeat-one loops not tracked as separate plays~~ RESOLVED in 01-02 (onprogress position reset detection)

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 02-02-PLAN.md
Resume file: None
