# Listening Stats - Spicetify Extension

A real-time listening statistics dashboard for Spotify, powered by Spicetify.

![Version](https://img.shields.io/badge/version-1.0.42-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Spicetify](https://img.shields.io/badge/spicetify-2.x-1DB954)

<img width="2552" height="1373" alt="image" src="https://github.com/user-attachments/assets/6bfdeb96-2e81-4ae0-9a41-1bf647bac215" />

## Features

- **Track listening time**: See how much music you've listened to today, this week, this month, or all time
- **Top tracks, artists & albums**: View your most played content with play counts and listening time
- **Activity chart**: Visualize your listening patterns by hour
- **Artist payout estimate**: See how much you've contributed to artists
- **Streak tracking**: Track consecutive listening days
- **Skip rate**: Track how often you skip songs
- **New artists discovered**: See how many new artists you've listened to
- **Local storage**: All data stored locally in IndexedDB
- **Accurate tracking**: Handles pauses, skips, and session recovery
- **Auto-update notifications**: Get notified when updates are available

## Installation

### Quick Install (Recommended)

**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iwr -useb 'https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.ps1' | iex
```

The installer will automatically:
- Download the latest release
- Install to your Spicetify CustomApps folder
- Configure and apply Spicetify

### Manual Install

1. Download the latest release from [Releases](https://github.com/Xndr2/listening-stats/releases)
2. Extract to your Spicetify CustomApps folder:
   - **Linux/macOS:** `~/.config/spicetify/CustomApps/listening-stats`
   - **Windows:** `%APPDATA%\spicetify\CustomApps\listening-stats`
3. Enable and apply:
   ```bash
   spicetify config custom_apps listening-stats
   spicetify apply
   ```

### From Source

```bash
git clone https://github.com/Xndr2/listening-stats.git
cd listening-stats
npm install
npm run deploy
```

## Updating

Listening Stats will notify you when a new version is available. A non-intrusive popup will appear in the top-right corner with update instructions.

**To update:**
1. Click "Copy Install Command" in the update popup
2. Open a terminal
3. Paste and run the command
4. Restart Spotify

Alternatively, run the install command again - it handles updates automatically.

## Usage

After installation, you'll find "Listening Stats" in Spotify's sidebar. Click it to open the dashboard.

**Dashboard shows:**

- Time listened with track/artist/unique counts
- Estimated artist payout
- Listening streak
- Skip rate
- New artists discovered
- Top tracks, artists, and albums
- Hourly activity chart
- Recently played tracks

Use the period tabs to switch between **Today**, **This Week**, **This Month**, and **All Time**.

**Settings panel** (click Settings in footer):
- Refresh stats
- Enrich data (fetch missing album art, etc.)
- Clear cache
- Check for updates
- Reset all data

## Troubleshooting

**"Spicetify is not defined"**

- Extension loaded before Spicetify initialized
- Check the init loop in `app.tsx` waits for APIs

**Stats not updating**

- Check DevTools console for errors
- Verify tracker is running: should log "Now tracking: ..."
- Check IndexedDB has data

**Rate limit errors (429)**

- Normal for heavy usage
- Extension backs off automatically
- Settings → "Clear Cache" resets rate limit state

**CSS not applying**

- Styles inject at runtime; check `injectStyles()` called
- Inspect element to see if styles present

## Privacy

All data stored locally in IndexedDB. Nothing sent to external servers.

API calls go directly to `api.spotify.com` using your existing Spotify session, no proxy, no data collection.

## AI
AI was only used to write documentation (like this readme or comments, english is not my main language so it's easier to let AI do this), write the install scripts and generate the svg icons.
No AI was used to develop this project!

## Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes, test locally
4. Commit: `git commit -m "feat: add my feature"`
5. Push: `git push origin feature/my-feature`
6. Open PR

## License

MIT
