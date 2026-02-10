# Listening Stats — Spicetify Extension

## What This Is

A Spicetify custom app that tracks and visualizes listening statistics from multiple data sources (local IndexedDB tracking, Last.fm, stats.fm). Users pick a provider and see their top tracks, artists, albums, listening patterns, and other metrics directly inside Spotify.

## Core Value

Accurate, reliable listening statistics that match what the source services report — if the numbers don't match stats.fm/Last.fm/local reality, nothing else matters.

## Requirements

### Validated

- ✓ Multi-provider architecture (Local, Last.fm, stats.fm) — existing
- ✓ Local play event tracking via IndexedDB — existing
- ✓ Runtime provider switching with cache invalidation — existing
- ✓ Stats calculation with 2min TTL cache — existing
- ✓ Period selection (provider-specific time ranges) — existing
- ✓ Top tracks/artists/albums display — existing
- ✓ Activity by hour chart — existing
- ✓ Recently played section — existing
- ✓ Share card generation — existing
- ✓ Settings panel — existing
- ✓ First-run setup screen with provider selection — existing
- ✓ Export functionality — existing
- ✓ Mood sessions — existing
- ✓ Goals & milestones tracking — existing
- ✓ Update checker — existing
- ✓ Accent color theming — existing
- ✓ Compact mode — existing
- ✓ Skip detection (30s threshold) — existing

### Active

**Bugs:**
- [ ] Fix duplicate entries in recently played (Local provider)
- [ ] Fix looped song tracking (Local provider ignores replays)
- [ ] Fix IndexedDB migration — old data lost after version upgrade
- [ ] Fix stats.fm wrong numbers for 4Weeks/6Months/Lifetime (total time always same)
- [ ] Fix Last.fm track/artist/album cards not clickable
- [ ] Fix paid-to-artist card not filtered by selected time period
- [ ] Fix data mismatches — app numbers don't match source service websites
- [ ] Fix activity by hour not scoped to selected time period

**Features:**
- [ ] Dynamic stats.fm time period detection (premium: today, this week, year)
- [ ] Number formatting with commas (64143 → 64,143)
- [ ] Drag-and-drop card layout with localStorage persistence + reset button
- [ ] Stable Spotify API cover art fetching (resilient to 429 rate limits)
- [ ] 24-hour / military time toggle (applies to all time displays)
- [ ] Redesigned settings menu with more options and better organization
- [ ] Step-by-step in-app setup tutorials for stats.fm and Last.fm
- [ ] Tooltip walkthrough tour of the stats app (post-setup or post-update)
- [ ] Codebase optimization pass (security, performance, API patterns)

### Out of Scope

- Mobile app — Spicetify is desktop-only
- Backend server — all data stays client-side
- Spotify official API play counts — API doesn't expose per-user counts
- Audio Features API — deprecated by Spotify Nov 2024

## Context

- Existing brownfield codebase with ~15 services and ~20 UI components
- Spicetify environment: React provided as global, CosmosAsync shares Spotify client rate limits
- Three providers with very different data shapes that normalize to `ListeningStats`
- stats.fm has free and premium tiers with different available time periods
- Last.fm/Local providers need Spotify search API for cover art/URIs — rate limiting is a real problem
- IndexedDB schema changes have previously caused data loss
- esbuild IIFE bundles — no code splitting, two separate outputs (ext + app)
- Codebase map available at `.planning/codebase/`

## Constraints

- **Platform**: Must run in Spicetify extension environment (Chromium, ES2020)
- **No backend**: All computation and storage client-side (localStorage + IndexedDB)
- **Rate limits**: Spicetify.CosmosAsync shares rate pool with Spotify client — aggressive batching/caching required
- **Bundle format**: esbuild IIFE, no dynamic imports or code splitting
- **React**: Must use `Spicetify.React` global — no separate React install
- **Backwards compatibility**: Must preserve existing IndexedDB data and localStorage settings

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Provider pattern for multi-source stats | Decouples data sources from UI, enables runtime switching | ✓ Good |
| IndexedDB via `idb` for local tracking | Structured storage with indexes, handles large datasets | ✓ Good |
| localStorage for config/preferences | Simple key-value, no schema migrations needed | ✓ Good |
| Drag-and-drop for card layout | User wants visual rearrangement, not just toggle checkboxes | — Pending |
| In-app step-by-step tutorials | More helpful than external links, keeps users in flow | — Pending |
| Tooltip walkthrough for app tour | Less intrusive than overlay cards, more informative than banners | — Pending |
| 24h time as global toggle | User wants it everywhere, not just activity chart | — Pending |

---
*Last updated: 2026-02-10 after initialization*
