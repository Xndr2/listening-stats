# External Integrations

**Analysis Date:** 2026-02-10

## APIs & External Services

**Spotify Web API:**
- Top Tracks endpoint: `/v1/me/top/tracks` (time_range: short_term, medium_term, long_term)
- Top Artists endpoint: `/v1/me/top/artists` (time_range: short_term, medium_term, long_term)
- Recently Played endpoint: `/v1/me/player/recently-played` (limit 50)
- Search endpoints: `/v1/search?q=...&type=track|artist|album`
- Artists batch endpoint: `/v1/artists?ids=...` (max batch size 50)
- Recommendations endpoint: `/v1/recommendations` (used for "Play Similar" feature)
  - SDK/Client: `Spicetify.CosmosAsync.get()` - Spicetify's wrapped HTTP client with built-in rate limiting
  - Auth: Uses Spotify user's existing session token (no separate API key required)
  - Rate limit: Shared with Spicetify client; 429 responses trigger exponential backoff (default 60s, max 10m)
  - Cache: 5-minute TTL on responses with URL-based cache key
  - File: `src/services/spotify-api.ts`
  - Limitation: Recently-played limited to ~50 items; per-user play counts not available via API

**Last.fm API:**
- Base URL: `https://ws.audioscrobbler.com/2.0/`
- Endpoints: User info validation, top tracks/artists/albums, recent tracks per period
- SDK/Client: Native `fetch()`
- Auth: API key + username (stored in localStorage)
- Storage key: `listening-stats:lastfm` (contains `{ apiKey: string; username: string }`)
- Cache: 5-minute TTL per request
- Error handling: 403 (invalid key), 429 (rate limited), 404 (user not found)
- File: `src/services/lastfm.ts`
- Implementation: `src/services/providers/lastfm.ts`

**stats.fm API (formerly Spotify Stats):**
- Base URL: `https://api.stats.fm/api/v1`
- Endpoints: User validation, top tracks/artists/albums/genres, recent streams, stream stats
- SDK/Client: Native `fetch()`
- Auth: Username only (no API key required for public data)
- Storage key: `listening-stats:statsfm` (contains `{ username: string; isPlus: boolean }`)
- Cache: 2-minute TTL per request
- Error handling: 404 (user not found), 403 (private profile), 429 (rate limited)
- File: `src/services/statsfm.ts`
- Implementation: `src/services/providers/statsfm.ts`
- Data extraction: Spotify URIs extracted from `track.externalIds.spotify[]`, `artist.externalIds.spotify[]`, `album.externalIds.spotify[]`
- Plus feature: Albums endpoint returns 400 for non-Plus users; fallback to aggregating from recent streams

## Data Storage

**Databases:**
- IndexedDB (browser storage)
  - Database name: "listening-stats"
  - Version: 3
  - Object store: "playEvents" (auto-increment key "id")
  - Indexes:
    - `by-startedAt`: sorted by play timestamp
    - `by-trackUri`: lookup by track Spotify URI
    - `by-artistUri`: lookup by artist Spotify URI
  - Client: `idb` (npm package 8.0.3)
  - Used by: Local provider for persistent play event storage
  - File: `src/services/storage.ts`

**File Storage:**
- Local filesystem only - no cloud storage
- Deployment: Manual copy to `~/.config/spicetify/CustomApps/listening-stats/` via `npm run deploy`

**Caching:**
- In-memory cache: Map-based caches with TTL in multiple services
  - Spotify API cache: 5-minute TTL (URL-keyed)
  - Last.fm cache: 5-minute TTL (URL-keyed)
  - stats.fm cache: 2-minute TTL (URL-keyed)
  - Search cache: Persisted to localStorage, 500-entry limit
- localStorage cache: Spotify search results (`listening-stats:searchCache` with max 500 entries)

## Authentication & Identity

**Auth Provider:**
- Custom implementation - No OAuth or third-party auth service
- Spotify: Uses existing Spicetify session (user already logged into Spotify)
- Last.fm: Manual API key + username entry (stored in localStorage)
- stats.fm: Manual username entry (stored in localStorage)

## Monitoring & Observability

**Error Tracking:**
- None - No external error service integrated
- Local logging: Console-based with optional debug mode (`listening-stats:logging` localStorage flag)

**Logs:**
- Browser console only
- Custom prefix: `[ListeningStats]` and `[Listening Stats]`
- File: Logging utilities in `src/services/tracker.ts` (`isLoggingEnabled()`, `setLoggingEnabled()`)

## CI/CD & Deployment

**Hosting:**
- Spicetify Custom App installation
- Installed to `~/.config/spicetify/CustomApps/listening-stats/` on local machine
- No remote hosting or CDN

**CI Pipeline:**
- None detected - Manual build and deploy process
- Build command: `npm run build` (runs ext + app builds + copies manifest)
- Apply command: `npm run apply` (builds and runs `spicetify apply`)
- Deploy command: `npm run deploy` (builds, copies files, registers with Spicetify, applies)

**Version Management:**
- Manual version bump: `npm run prebuild` script increments patch version in package.json
- Version injected at build time: `__APP_VERSION__` via esbuild `--define` flag
- Accessible at runtime: `getCurrentVersion()` function in `src/services/updater.ts`

## Environment Configuration

**Required env vars:**
- None - Configuration entirely via localStorage/browser storage
- Spotify API: Automatic (reuses Spicetify's authenticated session)
- Last.fm: Requires manual entry of API key + username in UI
- stats.fm: Requires manual entry of username in UI

**Secrets location:**
- All secrets stored in browser localStorage under `listening-stats:` namespace
- No `.env` files used
- Not committed to repository

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- Custom event system: `listening-stats:updated` window event fired when stats calculation completes
- Used by `src/services/tracker.ts` to notify listeners of state changes
- Event listener registration: `onStatsUpdated(callback)` function
- Also updates localStorage `listening-stats:lastUpdate` timestamp

## Provider System

**Multi-provider architecture:**
- Three providers available: Local, Last.fm, stats.fm
- Selected via UI on first run, stored in `listening-stats:provider` localStorage key
- Interface: `TrackingProvider` with `init()`, `destroy()`, `calculateStats(period)` methods
- Provider registry: `src/services/providers/index.ts`
- Provider implementations:
  - Local: `src/services/providers/local.ts` - uses IndexedDB + poller tracking
  - Last.fm: `src/services/providers/lastfm.ts` - Last.fm API for historical data
  - stats.fm: `src/services/providers/statsfm.ts` - stats.fm API for historical data

## Polling System

**Local Provider Polling:**
- Active only when Local provider is selected
- Tracks current Spotify playback via `Spicetify.Player` API
- Stores play events in IndexedDB
- Skip detection: Tracks plays <30s duration as skips
- Polling data persisted to `listening-stats:pollingData` localStorage (includes hourly distribution, activity dates, artist URIs, play counts)
- File: `src/services/tracker.ts`

---

*Integration audit: 2026-02-10*
