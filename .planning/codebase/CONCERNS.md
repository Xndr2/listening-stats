# Codebase Concerns

**Analysis Date:** 2026-02-10

## Tech Debt

**Global state management without cleanup guarantees:**
- Issue: Two separate bundles (`app.tsx` and `index.tsx`) write to shared globals (`window.__lsSongHandler`, `window.__lsPauseHandler`) which can lead to duplicate listeners or stale handlers if bundles unload independently
- Files: `src/services/tracker.ts` (lines 240-268), `src/app.tsx` (lines 9-15)
- Impact: Can cause double-tracking of play events, memory leaks from unreachable event listeners, or orphaned handlers after reload
- Fix approach: Implement proper cleanup by tracking bundle version or using a more robust registry pattern with versioning; consider merging into single bundle or using SharedWorker

**Oversized monolithic component:**
- Issue: `src/app/index.tsx` is 580 lines with extensive state management (12 state properties), lifecycle hooks, and event handling all in one class component
- Files: `src/app/index.tsx`
- Impact: Difficult to test, maintain, and reason about state changes; harder to reuse logic; potential for unintended side effects across features
- Fix approach: Break into smaller functional components with custom hooks (e.g., useStatsLoading, useProviderSwitching, useAutoUpdate); extract state logic into context provider

**Canvas rendering complexity monolith:**
- Issue: `src/services/share-card.ts` is 1309 lines with multiple canvas rendering functions for different card types, all tightly coupled
- Files: `src/services/share-card.ts`
- Impact: Difficult to add new card formats, modify styling, or test individual visual elements; side effects from shared canvas state
- Fix approach: Extract canvas utilities into separate modules; use a canvas builder pattern; separate concerns (layout, text, images, effects)

**Uncaught promise rejections in provider methods:**
- Issue: `calculateStats()` in provider implementations can reject, but callers in `src/app/index.tsx` (line 169) only wrap one call, not all provider calls during initialization
- Files: `src/services/providers/local.ts` (line 40), `src/services/providers/lastfm.ts` (line 42), `src/services/providers/statsfm.ts` (line 30), `src/app/index.tsx` (line 169)
- Impact: Provider errors during async aggregation may not be properly caught, leaving component in inconsistent state
- Fix approach: Ensure all provider methods catch and transform errors consistently; add error boundaries around provider calls

**localStorage quota mismanagement:**
- Issue: `src/services/tracker.ts` saves large polling data objects (trackPlayCounts, artistPlayCounts) without quota checking; simple size limits (2000 tracks, 1000 artists) don't account for quota pressure on large payloads
- Files: `src/services/tracker.ts` (lines 79-101)
- Impact: Can silently fail when quota exceeded (80-100MB limit per domain), causing data loss; truncation strategy (line 82) is reactive, not proactive
- Fix approach: Pre-check available quota before save; implement gradual eviction; consider moving to IndexedDB for larger datasets

**Missing null/undefined validation on nested data:**
- Issue: Multiple providers assume nested data structures exist without validation (e.g., `item.track.albums?.[0]?.name` vs plain `item.albums[0].name`)
- Files: `src/services/providers/statsfm.ts` (lines 63-64, 140-143), `src/services/providers/lastfm.ts` (line 99)
- Impact: Inconsistent null handling can cause undefined values in stats, breaking components that expect defined strings
- Fix approach: Add validation layer at provider boundary; normalize all response data before returning from `calculateStats()`

## Known Bugs

**Race condition in provider switching:**
- Symptoms: Stats cache not invalidated when switching providers; old data visible briefly after provider switch
- Files: `src/services/stats.ts` (lines 22-26), `src/app/index.tsx` (line 113-114)
- Trigger: User switches provider while stats are loading, then immediately views different period
- Workaround: Manually refresh stats (settings > "Refresh stats")
- Root cause: `clearStatsCache()` called after `setState()`, not before provider change

**Hourly distribution calculation includes 12am as hour 0:**
- Symptoms: "12am" appears as hour 0 in activity charts, but formatting in `src/services/share-card.ts` (line 102) handles it specially, causing inconsistency with local provider calculations
- Files: `src/services/providers/local.ts` (lines 219-223), `src/services/share-card.ts` (line 101-106)
- Trigger: View hourly distribution then generate share card
- Workaround: None; purely cosmetic inconsistency
- Root cause: Mixed use of 0-indexed hours (JS Date.getHours()) vs 12-hour format labels

**Empty array max() error:**
- Symptoms: Potential crash with error "Math.max called on empty array" when stats object is computed with no events
- Files: `src/services/providers/local.ts` (line 283), `src/services/providers/statsfm.ts` (line 194)
- Trigger: New user with local provider, no plays yet; click "This Month" period
- Workaround: Log some play data first, or manually refresh
- Root cause: `Math.max(...hourlyDistribution)` when array is empty

**Last.fm API rate limiting not exposed to UI:**
- Symptoms: User sees "Failed to load stats" message but no indication that Last.fm API is being rate limited or recovering
- Files: `src/services/spotify-api.ts` (lines 39-59), `src/app/index.tsx` (lines 191-197)
- Trigger: Heavy usage or API quota exceeded
- Workaround: Wait ~1 minute and refresh, or clear cache in settings
- Root cause: Rate limit state managed silently in `spotify-api.ts`; no provider-level exposure

## Security Considerations

**Unvalidated external image URLs in canvas rendering:**
- Risk: `loadImage()` in `src/services/share-card.ts` (lines 38-47) loads album art from Spotify URLs with 5-second timeout; no CORS validation or origin check
- Files: `src/services/share-card.ts` (line 45)
- Current mitigation: Images loaded with `crossOrigin="anonymous"`, timeout fallback
- Recommendations: Add URL origin whitelist (spotify.com, scdn.co); log failed loads for debugging; consider pre-validating image URLs before canvas use

**localStorage data accessible to other extensions:**
- Risk: All user data (polling data, provider config, Last.fm API key fragments) stored in `localStorage` without encryption; any extension or malicious script can read
- Files: `src/services/tracker.ts` (line 97), `src/services/spotify-api.ts` (line 55), `src/services/lastfm.ts` (depends on user config)
- Current mitigation: Data stored under namespaced keys (`listening-stats:*`)
- Recommendations: Encrypt sensitive values (Last.fm API key, stats.fm username); consider sessionStorage for transient data; mark localStorage as non-essential

**Image data exfiltration via share card:**
- Risk: Generated share card canvas can be downloaded/copied by user; contains personal stats + album artwork
- Files: `src/services/share-card.ts` (entire file), `src/app/components/ShareCardModal.tsx`
- Current mitigation: User-initiated action only; no automatic upload
- Recommendations: Add privacy notice when generating share cards; clear canvas memory after download; provide option to anonymize stats

## Performance Bottlenecks

**Synchronous polling data serialization:**
- Problem: `savePollingData()` in `src/services/tracker.ts` (lines 79-101) runs synchronous sort on potentially 2000 tracks every time a song changes
- Files: `src/services/tracker.ts` (lines 87-95)
- Cause: Large object sort during hot path (song change); no batching or debouncing
- Improvement path: Batch writes (save every 5 plays instead of every play); move sort to async worker; use Map instead of object for faster lookups

**Synchronous stats aggregation on large datasets:**
- Problem: `aggregateEvents()` in `src/services/providers/local.ts` (lines 87-293) loops events multiple times to build top tracks, artists, albums; with 10k+ events, this can block UI thread
- Files: `src/services/providers/local.ts` (lines 91-217, 225-237)
- Cause: Multiple sequential passes over event array; no indexing or early termination
- Improvement path: Single-pass aggregation with pre-allocated maps; web worker for calculations over 1000 events; add progress indicator

**IndexedDB queries without bounds:**
- Problem: `getAllPlayEvents()` in `src/services/storage.ts` (line 49) fetches all records without pagination; can load 100k+ objects into memory
- Files: `src/services/storage.ts` (line 49)
- Cause: No limit/offset support in `idb` library usage
- Improvement path: Implement cursor-based pagination for "all time" queries; add batch size param to `calculateStats()`

**Canvas image loading blocks share card generation:**
- Problem: `loadImage()` in `src/services/share-card.ts` (line 38) waits sequentially for each image (album art, background) with 5-second timeout
- Files: `src/services/share-card.ts` (lines 38-47, 200-350)
- Cause: Promise.all() used for parallel fetches, but timeout is per-image and adds latency
- Improvement path: Parallel load with shared timeout; pre-cache common images; use placeholder if image slow

## Fragile Areas

**Provider activation contract violations:**
- Files: `src/services/providers/index.ts` (lines 43-66), all provider implementations
- Why fragile: `activateProvider()` calls `destroy()` on old provider, then `init()` on new one, but `skipInit` flag bypasses init entirely. No guarantee old provider cleanup finished before new one starts; shared global state (`activeProvider`) mutated during async init
- Safe modification: Always call `destroy()` before `init()`; return Promise from `init()` to ensure completion; use state machine instead of boolean flag
- Test coverage: No tests for provider switching edge cases; no tests for double-activation

**Polling data corruption risk on format change:**
- Files: `src/services/tracker.ts` (lines 57-77), defensive parsing (lines 62-70)
- Why fragile: JSON.parse() with no schema validation; if schema changes, old data silently gets invalid defaults (line 70: `parsed.trackPlayCounts = {}`). No migration path
- Safe modification: Use versioned schema format; add migration function for old versions; test with real old data
- Test coverage: No tests for schema migration or data recovery

**Share card rendering dependent on Spicetify React:**
- Files: `src/services/share-card.ts`, `src/app/components/ShareCardModal.tsx`
- Why fragile: Canvas rendering uses global `document.createElement()`, but modal is React component. If modal unmounts before canvas finishes rendering (5+ second image loads), dangling promises could write to detached DOM
- Safe modification: Add cleanup function that cancels pending image loads; store component ref to check mounted state before setState
- Test coverage: No tests for unmounting during share card generation

**Last.fm username normalization inconsistency:**
- Files: `src/services/lastfm.ts` (normalize function), `src/services/providers/lastfm.ts` (track matching)
- Why fragile: `normalize()` function exported from `lastfm.ts` is used for matching, but if regex pattern changes, cached stats become incorrect without rebuild
- Safe modification: Document normalize() behavior; add tests for normalization edge cases (feat. artists, special chars); consider storing raw + normalized keys
- Test coverage: No unit tests for normalize() function

## Scaling Limits

**IndexedDB storage quota:**
- Current capacity: 50MB+ (browser-dependent; ~1000 events ≈ 100KB)
- Limit: Browser quota (typically 10-50% of available disk); shared across all apps on domain
- Scaling path: Implement periodic archival (export old data as JSON, delete from IDB); add quota warning UI; support multiple databases by date range

**localStorage size for polling data:**
- Current capacity: ~2000 tracks + ~1000 artists (estimated 50-100KB serialized)
- Limit: 5-10MB typical limit; exceeding causes silent failures
- Scaling path: Move to IndexedDB; implement compression; archive historical polling data

**Canvas memory usage for share cards:**
- Current capacity: Single 1440x2560 (story) or 1920x1080 (landscape) canvas; ~2-4MB uncompressed
- Limit: Not explicit, but OOM possible on low-end devices
- Scaling path: Reduce canvas size on mobile; stream rendering in chunks; use WebGL for large images

**Event listener registration for double-bundle:**
- Current capacity: Two listeners per event type (app.tsx + index.tsx can both register)
- Limit: No hard limit, but causes duplicate tracking
- Scaling path: Implement bundle coordination (SharedWorker, postMessage); use mutation observer to detect duplicate handlers; document required setup

## Dependencies at Risk

**`idb` library lack of cursor support:**
- Risk: `idb` v7 doesn't expose cursor API for pagination; `getAllPlayEvents()` loads entire store into memory
- Impact: Can't efficiently process large datasets; memory bloat with 100k+ events
- Migration plan: Add wrapper utilities for cursor-based querying; consider IndexedDB directly or `dexie.js` for better API

**Spicetify API rate limiting unpredictable:**
- Risk: `CosmosAsync` shares quota with Spotify client; no formal SLA or rate limit headers exposed
- Impact: Last.fm enrichment, artist image fetching can fail with cryptic errors
- Migration plan: Implement Circuit Breaker pattern; add request queuing with backoff; document rate limit behavior for users

**Canvas API browser support:**
- Risk: Share card generation relies on `getImageData()` for color extraction (line 117 in `share-card.ts`), which fails in certain security contexts
- Impact: Share card generation silently fails on some browsers/configs
- Migration plan: Add feature detection; provide fallback colors; test on target browsers

## Missing Critical Features

**No data export/import:**
- Problem: Users can export stats as JSON/CSV, but no way to import or migrate between devices
- Blocks: Multi-device sync; data backup/restore; migrating from local to external provider
- Fix approach: Add import functionality that merges with existing data; implement cloud sync option (requires backend)

**No conflict resolution for duplicate play events:**
- Problem: If poller runs twice (double-bundle issue) or user manually adds events, no detection or deduplication
- Blocks: Data integrity for long-term stats; accurate skip rate calculation
- Fix approach: Add deduplication on write (check trackUri + timestamp window); implement event versioning

**No analytics on stats accuracy:**
- Problem: User has no way to know if local tracking is missing events or if Last.fm is complete
- Blocks: Building trust in data; debugging tracking issues
- Fix approach: Add "tracked vs. scrobbled" comparison; expose play event log in debug mode

## Test Coverage Gaps

**Provider switching edge cases:**
- What's not tested: Switching provider while stats loading; double-activation; destroy() exceptions
- Files: `src/services/providers/index.ts`, all provider implementations
- Risk: Silent state corruption; memory leaks; old provider events still firing
- Priority: High

**Share card generation with missing data:**
- What's not tested: Album art missing; artist images missing; very long names; empty top lists
- Files: `src/services/share-card.ts`
- Risk: Canvas crashes; text overflow; partial rendering
- Priority: Medium

**IndexedDB quota exceeded:**
- What's not tested: Behavior when quota full; recovery after quota freed; fallback to localStorage
- Files: `src/services/storage.ts`, `src/services/tracker.ts`
- Risk: Silent data loss; user unaware of quota issue
- Priority: High

**Rate limit recovery:**
- What's not tested: Spotify API 429 responses; retry-after headers; exponential backoff timing
- Files: `src/services/spotify-api.ts`
- Risk: User gets permanent errors if backoff calculation wrong
- Priority: Medium

**Last.fm API error responses:**
- What's not tested: Invalid API key; rate limited user; network errors; malformed responses
- Files: `src/services/lastfm.ts`
- Risk: Cryptic errors; app enters bad state; stats never load
- Priority: High

**localStorage data corruption:**
- What's not tested: JSON.parse() with corrupt data; missing keys; version mismatch
- Files: `src/services/tracker.ts`, `src/services/providers/index.ts`
- Risk: App crashes on load; data loss during recovery
- Priority: Medium

---

*Concerns audit: 2026-02-10*
