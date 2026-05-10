## [2.0.0] - 10-05-2026

### Added

- Progressive stats loading: overview, lists, and activity resolve in waves so the dashboard populates as data arrives instead of waiting on one giant gate.
- Per-section error cards: a failure in one block (for example top lists) no longer clears the whole page.
- Provider **capability** model so labels, badges, and hidden sections match what **local** vs **stats.fm** can actually return.
- **Re-validate** stats.fm inside settings menu.
- **World Charts** page: global or territory charts via the **Last.fm** API key field in **Settings** (this is separate from picking a dashboard provider; main stats remain **local** or **stats.fm**).
- Click a **genre** on the Top Genres chart or an artist row to filter the dashboard - major WIP
- In-app **update** check improvements, including optional **prerelease** visibility in preferences.
- **Remote announcement** support (`ANNOUNCEMENT.md` on the default branch) in addition to bundled per-version banners.
- **Settings > Display**: drag handles to reorder **dashboard sections**, the **overview** detail tiles (order respects local vs stats.fm availability), and **Top Lists** columns. Layout persists across sessions.
- Visibility toggles for sections and tiles without a second set of conflicting controls inside the dashboard.
- Full rewrite as a maintained **dual-bundle** extension (background tracking + dashboard UI).
- **Local tracking** backed by IndexedDB migrations, dedupe windows, repeat-one handling, skip-repeat toggle, pause-without-delete, watchdog refresh of player hooks, and a **health** summary you can sanity-check at a glance.
- Stats engine: TTL cache keyed by provider and period, **prefetch** of neighbors, Cosmos batch **artist enrichment**, API cache, and **backoff** when Spotify rate-limits.
- Dashboard: overview cards, ranked **top tracks, artists, albums**, activity chart, **recently played** scroller, skeletons, empty states, inline retries.
- **Settings**: tracking, display, providers shell, **data** tools (exports, wipe with confirm, forced refresh hooks).
- **Share** images (**story** and **landscape** PNG) from live stats.
- **Guided tour** on fresh installs and a release **update** prompt with snooze.
- Safe **IndexedDB migration** from v1 with backup and integrity checks before writes.
- **CSV** and **JSON** import flows for **v1 export shapes**, duplicate detection on import, progress UI, and a background pass that resolves synthetic URIs to real Spotify IDs when possible.
- **Per-provider period memory**: each provider remembers its last timeframe.
- **Listening streak** on the overview for local history; stats.fm uses API-backed streak data when present.
- **Listening patterns** for **stats.fm Plus** (hourly and weekday breakdowns).
- Tooltips on overview metrics and a **segmented** control for **play threshold** (skip vs count).
- **stats.fm** provider: parallel fetches, tier-aware periods, albums derived on free tiers, genres weighted from artist tags, periodic Plus re-validation.
- **Providers** setup tab and **first-run wizard** for choosing **local** or **stats.fm** and finishing username entry.
- Period tabs rebuilt from whichever provider is active.

### Changed

- Overview **hero** layout: large listening time, header-level period control, and provider-specific stat tiles (for example **new artists** and compare hints where data exists).
- **stats.fm** overview grid prefers **tracks**, **unique artists**, **top genre**, and **estimated payout**; **listening streak** is hidden on stats.fm because the API does not mirror the local streak story.
- Up to **three genre chips** on dense top-list rows, styled from Spicetify theme variables.
- UI pass: card borders and hover states, clearer type scale, redesigned top list rows and rank badges, **Top Genres** bar chart placement, single-column responsive collapse
- Sections that require local-only signals (examples: 24-hour activity bars from device, skip rate) hide or simplify automatically on stats.fm.

### Fixed

- One-time silent removal of leftover **localStorage** keys from old 1.x or early 2.x installs so storage stays predictable.
- **Liked** state and API calls updated for current Spotify library endpoints, including safe behavior for missing or synthetic URIs.
- **Health** dot moved beside the provider name with copy that reflects local tracking vs stats.fm status.
