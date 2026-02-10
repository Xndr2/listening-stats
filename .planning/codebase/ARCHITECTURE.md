# Architecture

**Analysis Date:** 2026-02-10

## Pattern Overview

**Overall:** Plugin-based provider pattern with delegated stats calculation. The extension is a Spicetify custom app that uses an abstract provider interface to support multiple data sources (Local IndexedDB, Last.fm, stats.fm). All stats operations delegate to the active provider, enabling seamless switching between data sources at runtime.

**Key Characteristics:**
- Three independent data providers (Local, Last.fm, stats.fm) implementing a common interface
- Real-time event tracking via Spicetify player listeners
- Two-layer caching: stats cache (2min TTL) and API caches (5min TTL)
- localStorage for user preferences and polling data
- IndexedDB for local play event persistence
- React class component for UI state management

## Layers

**Provider Layer:**
- Purpose: Pluggable data source adapters implementing the `TrackingProvider` interface
- Location: `src/services/providers/`
- Contains: `types.ts` (interface), `index.ts` (registry), `local.ts`, `lastfm.ts`, `statsfm.ts` (implementations)
- Depends on: Storage, Spotify API, Last.fm API, stats.fm API
- Used by: stats.ts, StatsPage component

**Storage & Persistence Layer:**
- Purpose: Manage data persistence across sessions
- Location: `src/services/storage.ts`, `src/services/tracker.ts`
- Contains: IndexedDB play events, polling data in localStorage, event listener hooks
- Depends on: idb library, Spicetify Player API
- Used by: Local provider, tracker initialization

**Data Service Layer:**
- Purpose: High-level stats calculation, caching, and transformation
- Location: `src/services/stats.ts`
- Contains: calculateStats(), formatters (formatDuration, generateShareText), cache invalidation
- Depends on: Active provider, cache management
- Used by: StatsPage, utilities, export services

**Tracking Layer:**
- Purpose: Real-time player event monitoring and aggregation
- Location: `src/services/tracker.ts`
- Contains: Player event listeners (songchange, onplaypause), play event recording, polling data accumulation
- Depends on: Spicetify Player API, Storage service
- Used by: Local provider init/destroy, background monitoring

**API Clients:**
- Purpose: External service integrations
- Location: `src/services/spotify-api.ts`, `src/services/lastfm.ts`, `src/services/statsfm.ts`
- Contains: API requests, caching, rate limit handling, data normalization
- Depends on: Spicetify CosmosAsync, external APIs
- Used by: Last.fm/stats.fm providers

**UI Layer:**
- Purpose: React components rendering stats and provider UI
- Location: `src/app/index.tsx`, `src/app/components/`
- Contains: StatsPage (root), functional components for charts/lists/settings, modals
- Depends on: Data service, components, styles
- Used by: Spicetify custom app registration

**Extension Layer:**
- Purpose: Background initialization and global API exposure
- Location: `src/app.tsx`
- Contains: Global window.ListeningStats, provider auto-activation on startup
- Depends on: Provider registry
- Used by: Spicetify extension initialization

## Data Flow

**Initialization Flow:**

1. Spicetify loads extension bundle (`src/app.tsx`)
2. `main()` checks for selected provider in localStorage
3. Auto-activates "local" provider if existing data exists and no selection
4. Calls `activateProvider(type)` → creates provider instance → calls `init()`
5. For Local: `initPoller()` registers Spicetify player listeners
6. For Last.fm/stats.fm: `initPoller()` registers listeners but skips polling

**Stats Loading Flow:**

1. StatsPage mounts → calls `loadStats()`
2. `calculateStats(period)` → checks stats cache
3. If miss, calls `activeProvider.calculateStats(period)`
4. Provider queries its data source (Local: IndexedDB, Last.fm: API, stats.fm: API)
5. Provider aggregates data into `ListeningStats` shape
6. Cache stores result with 2min TTL
7. Component renders with stats, prefetches adjacent periods

**Play Tracking Flow (Local Provider):**

1. Spicetify player fires "songchange" event
2. `handleSongChange()` calculates total play time for previous track
3. Compares against skip threshold (30s) to filter skips
4. Calls `addPlayEvent(event)` → writes to IndexedDB
5. Emits `listening-stats:updated` event
6. StatsPage listener calls `clearStatsCache()` + `loadStats()`

**Provider Switch Flow:**

1. User selects new provider in SettingsPanel
2. Calls `activateProvider(newType)`
3. Current provider's `destroy()` called (removes listeners, cleanup)
4. New provider instance created and `init()` called
5. `clearStatsCache()` invalidates all cached stats
6. `loadStats()` refetches with new provider

**State Management:**

- **Provider Selection:** localStorage key "listening-stats:provider"
- **Stats Cache:** In-memory Map, keyed by "provider:period"
- **API Caches:** Per-service in-memory Maps with 5min TTL
- **Play Data (Local):** IndexedDB "listening-stats" database with "playEvents" store, indexed by startedAt and trackUri
- **Polling Data (Local):** localStorage "listening-stats:pollingData" aggregated counts
- **User Preferences:** localStorage scattered keys (logging, Last.fm config, setup state)

## Key Abstractions

**TrackingProvider Interface:**
- Purpose: Abstracts data source, enables provider swappability
- Location: `src/services/providers/types.ts`
- Properties: type, periods, periodLabels, defaultPeriod
- Methods: init(), destroy(), calculateStats(period), prefetchPeriod?(), clearData?()
- Pattern: Factory functions create instances (createLocalProvider, createLastfmProvider, createStatsfmProvider)

**ListeningStats Data Shape:**
- Purpose: Standardized stats output across all providers
- Location: `src/types/listeningstats.ts`
- Fields: topTracks, topArtists, topAlbums, hourlyDistribution, recentTracks, genres, metrics (totalTimeMs, streakDays, skipRate, etc.)
- Key: All providers must normalize data to this shape

**PlayEvent:**
- Purpose: Atomic tracking unit for local provider
- Location: `src/types/listeningstats.ts`
- Fields: trackUri, trackName, artistName, artistUri, albumName, albumUri, durationMs, playedMs, startedAt, endedAt
- Storage: IndexedDB STORE_NAME = "playEvents"

**PollingData:**
- Purpose: Accumulated session statistics for local provider
- Location: `src/types/listeningstats.ts`
- Fields: hourlyDistribution (24-bucket array), trackPlayCounts, artistPlayCounts, skipEvents, totalPlays, lastPollTimestamp
- Storage: localStorage "listening-stats:pollingData", capped at 2000 tracks, 1000 artists

## Entry Points

**Extension Entry (`src/app.tsx`):**
- Location: `src/app.tsx`
- Triggers: Spicetify loads extension manifest
- Responsibilities:
  - Polls for Spicetify.Player/Platform/CosmosAsync availability
  - Reads selected provider from localStorage
  - Auto-activates provider if data exists
  - Exposes `window.ListeningStats.resetLastfmKey()` for debugging

**Custom App Entry (`src/app/index.tsx`):**
- Location: `src/app/index.tsx`, class `StatsPage`
- Triggers: Spicetify registers custom app route
- Responsibilities:
  - Root React component managing full page state
  - Handles provider setup, stats loading, caching
  - Manages modals (settings, share card, update banner)
  - Renders conditional UI (setup screen, loading, empty, error, main)
  - Coordinates component tree (Header, TopLists, ActivityChart, Footer, etc.)

**Provider Initialization:**
- Location: `src/services/providers/index.ts` function `activateProvider()`
- Called by: app.tsx main(), StatsPage constructor, SettingsPanel provider change
- Process: Creates provider instance → saves selection to localStorage → calls init()

## Error Handling

**Strategy:** Try-catch blocks around localStorage access (quota exceeded, disabled), IndexedDB operations (quota, version mismatch), API calls (network, 429 rate limits)

**Patterns:**

- **Storage Access:** Wrapped in try-catch, logs warning, falls back to defaults (`getConfig()`, `getPollingData()`)
- **API Rate Limiting:** Detects 429 responses, extracts Retry-After header, stores backoff deadline in localStorage, blocks further requests until deadline
- **Provider Init:** Guard against missing Spicetify globals via timeout retry loop in app.tsx
- **Stats Calculation:** Top-level catch in loadStats() updates component error state, shows user-facing message
- **Event Listeners:** removeEventListener references stored to handle multiple bundle loads (app.tsx vs index.tsx)

## Cross-Cutting Concerns

**Logging:** Optional console logging via localStorage "listening-stats:logging" = "1", controlled by `isLoggingEnabled()` and `setLoggingEnabled()` in `tracker.ts`

**Validation:**
- Provider type validated enum in registry (string literal "local" | "lastfm" | "statsfm")
- Period labels from provider.periodLabels ensure valid display names
- Last.fm track normalization: strip brackets, parentheses, "feat." for matching

**Authentication:**
- Local: No auth needed
- Last.fm: username + apiKey stored in localStorage "listening-stats:lastfm"
- stats.fm: username stored in localStorage "listening-stats:statsfm"
- All configs wrapped in getConfig()/saveConfig()/clearConfig() functions

**Rate Limiting:** Managed globally in spotify-api.ts via `rateLimitedUntil` variable, queues requests while limited, extracts Retry-After from response headers

**Caching Strategy:**
- Stats: 2min TTL, keyed by "provider:period", cleared on provider switch or manual refresh
- API results: 5min TTL per service, used for artist/album lookups
- Last.fm responses: 5min TTL with cache key = full request URL

---

*Architecture analysis: 2026-02-10*
