# Changelog

## 1.2.0

### Added

- **Provider system** — choose between multiple data sources instead of being locked to one
  - **Last.fm provider** — connect your Last.fm account for accurate play counts and cross-device tracking with 7 time periods (7 days, 1/3/6/12 months, overall)
  - **Local provider** — on-device tracking via IndexedDB (renamed from the previous default)
  - **Spotify provider** — uses Spotify's top items and recently played APIs
- **Setup screen** — first-launch flow to choose a data provider with Last.fm validation
- **Share cards** — generate shareable stat images (story 1080x1350 or landscape 1200x630) with top tracks, artists, and stats summary. Export via clipboard, download, or native share. Shows provider source label
- **Data export** — export stats as JSON or CSV from the settings panel. Local provider can also export raw listening history
- **Genre timeline** — stacked bar visualization showing genre proportions across multiple time periods
- **Animated numbers** — overview card values count up with eased animation on load
- **Loading skeleton** — shimmer placeholder shown while stats are loading
- **Header component** — dedicated top bar with share button, settings toggle, and provider indicator
- **Last.fm banner** — link to your Last.fm profile shown in the footer when using Last.fm provider
- **Empty state** — informational screen when no data is available for the selected period
- **Period prefetching** — adjacent time periods are prefetched in the background for faster switching

### Changed

- **Stats engine rewritten** — delegates to the active provider instead of directly querying APIs. 5-minute cache keyed by provider and period
- **Tracker rewritten** — unified poller with skip detection for all providers, IndexedDB writes for local, configurable poll interval
- **Spotify API service** — added request queue with concurrency limiting (3 concurrent), automatic retry with exponential backoff on 429s, LRU response cache (200 entries, 5-min TTL)
- **Settings panel overhaul** — provider switching, Last.fm account management, cache controls, export buttons, separated into sections
- **Activity chart** — supports both local hourly distribution and Last.fm play counts per hour
- **Overview cards** — new layout with hero card, period tabs integrated, payout estimates
- **Top lists** — like buttons (hidden for Last.fm), play count display, click-to-play
- **Type system** — moved from single `src/types.ts` to modular `src/types/` directory with separate files for Spotify API types and listening stats types
- **Styles** — complete CSS overhaul with CSS custom properties for accent color theming, improved responsive layout, portal-based modals

### Fixed

- Rate limit handling — proper 429 backoff instead of hammering the API
- Event listener cleanup — stored handler references for proper `removeEventListener`
- Session recovery on extension restart
- Skip detection accuracy improved

### Removed

- Removed deprecated Spotify Audio Features API calls (deprecated by Spotify Nov 2024)
- Removed unused preference service and feature expansion types (heatmap, goals, milestones, moods)

## 1.1.0

Initial public release with local IndexedDB tracking, top tracks/artists/albums, activity chart, streak tracking, skip rate, and auto-update notifications.
