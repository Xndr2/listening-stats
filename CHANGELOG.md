## [2.0.1] - 2026-05-14

### Added

- Turn the play count **Off** in Display settings.
- Optional second line on the playbar for stats.fm period plays or a “new play” hint when local history does not have the track yet; it updates when you change the dashboard period.
- When stats.fm world charts fail, the app loads a daily backup list from **mytopspotify.io**.
- **Discord** and **Buy me a coffee** links in the footer.

### Changed

- **World** sits on the period tab row with Today, Week, and the rest; the old separate Dashboard / World switch is gone.
- **World charts** use stats.fm for the whole globe; territory tabs tied to Last.fm (US / UK / JP) are removed. Two-column layout, clearer labels, better cover art, less noise when rank change does not apply, and a short note that the page is still evolving.
- **Playbar** stats.fm lifetime counts search more thoroughly so less common tracks still match; if stats.fm has nothing you still see your local number.
- **Layout** The filter, title, and period row sits flush at the top while you scroll and no longer uses the heavy drop shadow under the bar.
- **stats.fm & overview** Refreshing the dashboard picks up profile and Plus after re-validate. Top genres can come straight from stats.fm when your account has them. **New artists** always shows a number, including zero when there is nothing to compare.
- **Share** Wrapped and story cards use a cleaner layout: correct period names, better album and artist art, less overlap (including the square Wrapped style). Share stays on the dashboard, not on World.
- **Settings** Modal is slightly wider; stats.fm shows **Re-validate** and **Disconnect** side by side; shorter help text under Display.
- **Guided tour** One step shorter; **World** is explained in the same beat as choosing a time range.

### Fixed

- **Local tracking** Listening through most of a song counts as a play; skips stay out of totals so tiny false doubles stop happening.
- **Covers** Odd Spotify image references now show as normal pictures in recent plays, top lists, and what we store when you listen.
- **Windows installer** The PowerShell script handles extra console formatting and banner text from Spicetify better so path detection fails less often.
