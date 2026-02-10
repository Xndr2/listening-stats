---
phase: 03-data-accuracy-and-api-resilience
plan: 03
subsystem: ui
tags: [image-retry, exponential-backoff, error-state, cover-art, api-error, resilience-ui]

# Dependency graph
requires:
  - phase: 03-data-accuracy-and-api-resilience
    plan: 02
    provides: "ApiError typed error class for error discrimination in UI"
provides:
  - "ImageWithRetry component with exponential backoff retry and cache-busting"
  - "Error state UI that distinguishes API failure from empty data"
  - "All cover art in TopLists and RecentlyPlayed uses retry-capable image loading"
affects: [cover-art-reliability, error-ux, api-resilience-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [image-retry-with-backoff, error-type-discrimination, cache-bust-on-retry]

key-files:
  created: [src/app/components/ImageWithRetry.tsx]
  modified: [src/app/components/TopLists.tsx, src/app/components/RecentlyPlayed.tsx, src/app/components/index.ts, src/app/index.tsx]

key-decisions:
  - "ImageWithRetry uses 3 retries with 1s/2s/4s exponential backoff (no jitter for image loads)"
  - "Cache-busting via ?retry=N query param to avoid browser serving cached 429 responses"
  - "Error discrimination uses instanceof ApiError plus name fallback for cross-bundle safety"

patterns-established:
  - "ImageWithRetry pattern: all cover art renders through retry-capable component, never raw <img>"
  - "Error type classification: errorType state field set on catch, cleared on success/reload"

# Metrics
duration: 2min
completed: 2026-02-10
---

# Phase 3 Plan 3: Cover Art Retry and Error State Discrimination Summary

**ImageWithRetry component with exponential backoff for resilient cover art loading, plus API failure vs empty data distinction in error state UI**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-10T21:15:02Z
- **Completed:** 2026-02-10T21:17:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created ImageWithRetry component with 3-retry exponential backoff (1s, 2s, 4s) and cache-busting
- Replaced all raw `<img>` tags for cover art in TopLists (tracks, artists, albums) and RecentlyPlayed with ImageWithRetry
- Added errorType state to StatsPage that classifies errors as "api" or "generic" using ApiError instanceof check
- API failures now show "Could not fetch data" with rate-limit context instead of raw error message

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ImageWithRetry component and wire into TopLists and RecentlyPlayed** - `0adaddf` (feat)
2. **Task 2: Distinguish API failure from empty data in StatsPage error rendering** - `807c8b7` (feat)

## Files Created/Modified
- `src/app/components/ImageWithRetry.tsx` - New: retry-capable image component with exponential backoff, placeholder fallback
- `src/app/components/TopLists.tsx` - Replaced 3 raw `<img>` tags with ImageWithRetry for tracks, artists, albums
- `src/app/components/RecentlyPlayed.tsx` - Replaced raw `<img>` tag with ImageWithRetry for album art
- `src/app/components/index.ts` - Added ImageWithRetry to barrel export
- `src/app/index.tsx` - Added errorType state, ApiError import, and distinct error messages for API vs generic failures

## Decisions Made
- ImageWithRetry uses 3 retries with 1s/2s/4s exponential backoff (simple doubling, no jitter -- image loads don't need jitter since they don't contend for a shared endpoint)
- Cache-busting via `?retry=N` query param appended to image URLs to bypass browser cache of failed responses
- Error type discrimination uses `instanceof ApiError` with `e?.name === "ApiError"` fallback for safety across bundle boundaries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All Phase 3 plans (01, 02, 03) are now complete
- API resilience layer is fully wired: timezone normalization (03-01), retry/circuit-breaker/batching (03-02), and UI resilience (03-03)
- Ready for Phase 4 (layout/UX enhancements)

## Self-Check: PASSED

- FOUND: src/app/components/ImageWithRetry.tsx
- FOUND: src/app/components/TopLists.tsx
- FOUND: src/app/components/RecentlyPlayed.tsx
- FOUND: src/app/index.tsx
- FOUND: 03-03-SUMMARY.md
- FOUND: 0adaddf (Task 1 commit)
- FOUND: 807c8b7 (Task 2 commit)

---
*Phase: 03-data-accuracy-and-api-resilience*
*Completed: 2026-02-10*
