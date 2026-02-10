# Testing Patterns

**Analysis Date:** 2026-02-10

## Test Framework

**Runner:**
- Not detected
- No test framework configured (vitest, jest, mocha, etc.)

**Assertion Library:**
- Not applicable

**Run Commands:**
- No test commands in package.json
- Only `typecheck` script: `tsc --noEmit`

## Test File Organization

**Location:**
- No test files found in codebase
- `find . -name "*.test.*" -o -name "*.spec.*"` returns no matches in src/

**Naming:**
- Not applicable (no tests present)

**Structure:**
- Not applicable (no tests present)

## Test Coverage

**Requirements:**
- None enforced (no CI/CD pipeline configured)

**View Coverage:**
- Not applicable

## Testing Strategy (Current State)

**Approach:**
- Manual testing via browser extension in Spicetify
- TypeScript compiler (`tsc --noEmit`) for type checking
- No automated unit, integration, or E2E tests

**Why No Tests:**
This is a browser extension built with:
- Spicetify global object dependency (mocking complex)
- Browser APIs: localStorage, IndexedDB, CustomEvent
- External API integrations: Spotify, Last.fm, stats.fm (would need mocking)
- React via global Spicetify.React (not standard React import)

## Testability Analysis

**Easily Testable Services:**
The following modules have clear input/output and minimal external dependencies:

**Pure Utility Functions:**
- `src/app/utils.ts`: formatting functions (`formatHour()`, `formatMinutes()`, `estimateArtistPayout()`)
- `src/services/stats.ts`: `formatDuration()`, `formatDurationLong()`, `generateShareText()` (takes data as params)
- Type definitions: everything in `src/types/`

**Example - Could be tested:**
```typescript
// src/app/utils.ts
export function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}
// Easy to test: inputs 0-23, verify string output
```

**Hard to Test (Require Mocking):**
- `src/services/storage.ts`: IndexedDB operations (requires idb mock)
- `src/services/tracker.ts`: localStorage + polling + CustomEvent (requires global state mock)
- `src/services/lastfm.ts`: HTTP requests to Last.fm API (requires network mock)
- `src/services/spotify-api.ts`: `Spicetify.CosmosAsync` calls (requires Spicetify global mock)
- `src/services/providers/`: Provider implementations with `init()`, `destroy()`, `calculateStats()` (interdependent)
- React components: All require Spicetify.React mock + props + state management

**Very Hard to Test:**
- `src/app/index.tsx`: Class component with lifecycle, event listeners, multiple provider types
- Polling mechanisms: `initPoller()` in tracker.ts with rate limiting and caching
- Provider switch logic: state mutations, cleanup, re-initialization

## Gaps & Risks

**Critical Untested Areas:**
1. **Provider switching**: `activateProvider()` in `src/services/providers/index.ts` (line 43-66)
   - Destroys old provider, activates new, inits
   - No tests for cleanup on failure or re-entry
   - Risk: Memory leaks if destroy not called, duplicate listeners

2. **Rate limiting**: `setRateLimit()` in `src/services/spotify-api.ts` (line 39-59)
   - Parses retry-after headers, sets exponential backoff
   - No tests for edge cases (malformed headers, overflow, NaN parsing)
   - Risk: API calls during rate limit window, wrong backoff calculation

3. **Data migration**: IndexedDB upgrade in `src/services/storage.ts` (line 12-26)
   - Deletes old store if version < 3
   - No tests for data loss or schema version mismatch
   - Risk: User data lost on broken upgrade

4. **Stats calculation**: `calculateStats()` in `src/services/stats.ts` (line 14-31)
   - Delegates to provider, caches result
   - No tests for cache hits, TTL expiry, provider errors
   - Risk: Stale stats returned, errors not caught

5. **Last.fm matching**: `normalize()` function (exported for stats.ts matching)
   - Strips special chars, normalization logic not tested
   - Risk: Artist/track mismatches due to inconsistent normalization

6. **Event listener cleanup**: `onStatsUpdated()` in `src/services/tracker.ts` (line 32-36)
   - Adds listener, returns unsubscribe function
   - No tests for proper removal or memory leaks
   - Risk: Listeners accumulate on component remount

7. **Error scenarios**: No tests for:
   - localStorage quota exceeded
   - IndexedDB operations failing
   - Spotify API timeouts/errors
   - Invalid user input in setup forms

**Test Coverage Priority (High to Low):**
1. **Provider switching** — Core feature, impacts everything
2. **Stats calculation and caching** — Main user-facing feature
3. **Rate limiting** — Prevents API errors
4. **Data migration** — Prevents data loss
5. **Error scenarios** — User experience impact
6. **Event cleanup** — Memory leaks and performance

## Mocking Strategy (If Tests Were Added)

**localStorage Mock:**
```typescript
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;
```

**IndexedDB Mock (idb package):**
Would need mock for `openDB()`, `add()`, `getAllFromIndex()`, etc.

**Spicetify Global Mock:**
```typescript
global.Spicetify = {
  React: {
    useState: require('react').useState,
    useEffect: require('react').useEffect,
    Component: require('react').Component,
    createElement: require('react').createElement,
    Fragment: require('react').Fragment,
  },
  CosmosAsync: { get: jest.fn(), post: jest.fn() },
  Platform: { History: { push: jest.fn() }, LibraryAPI: {...} },
  Player: { getContext: jest.fn() },
};
```

**API Response Mocking:**
```typescript
const mockSpotifyResponse = {
  body: { items: [...] },
  headers: { "retry-after": "60" },
};
jest.spyOn(Spicetify.CosmosAsync, 'get').mockResolvedValue(mockSpotifyResponse);
```

## Testing Checklist (For Future Implementation)

**Unit Tests to Add:**
- [ ] `formatDuration()` — Various time ranges
- [ ] `formatHour()` — All hours 0-23
- [ ] `estimateArtistPayout()` — Basic math, edge cases
- [ ] `normalize()` in lastfm.ts — Special char handling
- [ ] `generateShareText()` — With/without data
- [ ] `setRateLimit()` — Header parsing, backoff calculation
- [ ] `getCached()` — TTL expiry, missing entries

**Integration Tests to Add:**
- [ ] Provider activation/deactivation
- [ ] Stats calculation with mocked provider
- [ ] Cache invalidation on provider switch
- [ ] localStorage persistence
- [ ] Event listener subscription/unsubscription

**Component Tests to Add:**
- [ ] SetupScreen — Provider selection flow
- [ ] TopLists — Rendering with mock stats
- [ ] SettingsPanel — State changes, export functions
- [ ] Header — Props rendering

**E2E Tests (Manual):**
- [ ] Install extension, first run setup
- [ ] Switch between providers
- [ ] Clear data and verify reset
- [ ] Check stats accuracy with known data
- [ ] Rate limit handling (trigger 429)

---

*Testing analysis: 2026-02-10*
