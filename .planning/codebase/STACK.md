# Technology Stack

**Analysis Date:** 2026-02-10

## Languages

**Primary:**
- TypeScript 5.9.3 - All source code in `src/`
- TSX (JSX in TypeScript) - React components in `src/app/components/` and `src/app/index.tsx`

**Secondary:**
- JavaScript - Build scripts and configuration

## Runtime

**Environment:**
- Browser (Spicetify extension environment)
- No Node.js runtime required at runtime; build-time only

**Package Manager:**
- npm (with package-lock.json or yarn.lock expected)
- Lockfile: Present in repository

## Frameworks

**Core:**
- React 19.2.10 - UI framework via Spicetify global React instance
- Spicetify 1.0.17+ - Spotify extension platform (provides `Spicetify.React`, `Spicetify.CosmosAsync`, `Spicetify.Player`, etc.)

**Build/Dev:**
- esbuild 0.27.2 - Bundler for extension and custom app
  - Two separate IIFE bundles: `dist/listening-stats.js` (~62kb) and `dist/index.js` (~222kb)
  - Target: ES2020
  - Format: IIFE with global name for app bundle
- TypeScript 5.9.3 - Type checking compiler
- Prettier 3.8.1 - Code formatter

## Key Dependencies

**Critical:**
- idb 8.0.3 - IndexedDB wrapper library for local data storage
  - Used in `src/services/storage.ts` for play event persistence
  - Database: "listening-stats" with object store "playEvents"

**No external HTTP libraries:**
- Uses native `fetch()` for Last.fm and stats.fm APIs
- Uses `Spicetify.CosmosAsync.get()` for Spotify API calls (Spicetify's rate-limited HTTP client)

## Configuration

**Environment:**
- No `.env` files used; all configuration via `localStorage`
- API keys stored in browser storage under `listening-stats:` prefix
- Settings persisted locally in browser for:
  - Provider selection (`listening-stats:provider`)
  - Last.fm credentials (`listening-stats:lastfm`)
  - stats.fm credentials (`listening-stats:statsfm`)
  - Polling data (`listening-stats:pollingData`)
  - Search cache (`listening-stats:searchCache`)
  - Last.fm API rate limit state (`listening-stats:rateLimitedUntil`)

**Build:**
- `tsconfig.json`:
  - Target: ES2020
  - Module: ESNext
  - JSX factory: `Spicetify.React.createElement`
  - JSX fragment factory: `Spicetify.React.Fragment`
  - Strict mode: false
  - Module resolution: bundler
- Dual build script:
  - Extension: `npm run build:ext` → `dist/listening-stats.js` with `--external:react --external:react-dom`
  - App: `npm run build:app` → `dist/index.js` with global name export
- Version injection: `__APP_VERSION__` defined at build time from `package.json`
- CSS loader: Inline CSS as text strings

## Platform Requirements

**Development:**
- Node.js (no specific version pinned)
- npm or equivalent
- TypeScript 5.9.3+ installed
- Spicetify CLI installed locally (for `spicetify apply` and deployment)

**Production:**
- Spotify running with Spicetify extension enabled
- Modern browser (Chromium-based) with ES2020 support
- IndexedDB API support (all modern browsers)
- Fetch API support (all modern browsers)

**Browser Storage Limits:**
- localStorage: ~5-10MB per origin (used for config, polling data, search cache)
- IndexedDB: 50MB+ quota (used for play event persistence)

---

*Stack analysis: 2026-02-10*
