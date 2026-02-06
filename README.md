# Listening Stats - Spicetify Custom App

A real-time listening statistics dashboard for Spotify, powered by Spicetify.

![Version](https://img.shields.io/github/v/release/Xndr2/listening-stats)
![Spicetify](https://img.shields.io/badge/spicetify-2.x-1DB954)
![Downloads](https://img.shields.io/github/downloads/Xndr2/listening-stats/total)

<img alt="image" src="https://github.com/user-attachments/assets/6bfdeb96-2e81-4ae0-9a41-1bf647bac215" />

## Features

- **Multiple data providers** — choose between Last.fm, local tracking, or Spotify's API
- **Last.fm integration** — accurate play counts and listening history across all your devices with 7 time periods
- **Local tracking** — on-device tracking via IndexedDB, no account needed
- **Top tracks, artists & albums** — view your most played content with play counts and listening time
- **Activity chart** — visualize your listening patterns by hour
- **Genre timeline** — see how your genre preferences shift across time periods
- **Share cards** — generate shareable stat images in story or landscape format
- **Data export** — export your stats as JSON or CSV
- **Artist payout estimate** — see how much you've contributed to artists
- **Streak tracking** — track consecutive listening days
- **Skip rate** — track how often you skip songs
- **Animated dashboard** — smooth number animations and loading states
- **Auto-update notifications** — get notified when updates are available

## Installation

### Quick Install (Recommended)

Make sure you have Spicetify installed and working.
https://spicetify.app/

Then run the following command for your operating system:

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

Listening Stats will notify you when a new version is available. A non-intrusive popup will appear with update instructions.

**To update:**

1. Click "Copy Install Command" in the update popup
2. Open a terminal
3. Paste and run the command
4. Restart Spotify

Alternatively, run the install command again - it handles updates automatically.

## Usage

After installation, you'll find "Listening Stats" in Spotify's sidebar. On first launch, you'll be asked to choose a data provider:

- **Last.fm** — connect your Last.fm account for accurate play counts across all devices. Requires a Last.fm username and API key ([get one here](https://www.last.fm/api/account/create))
- **Local Tracking** — tracks on this device only, no account needed

Once set up, the dashboard shows:

- Time listened with track/artist/unique counts
- Estimated artist payout
- Listening streak and skip rate
- Top tracks, artists, and albums
- Genre timeline across periods
- Hourly activity chart
- Recently played tracks

Use the period tabs to switch between time ranges. Available periods depend on your provider.

**Settings panel** (gear icon in the header):

- Switch data provider
- Export stats (JSON / CSV)
- Refresh stats and clear cache
- Check for updates
- Manage Last.fm account (when using Last.fm)

**Share cards** (share icon in the header):

- Generate a shareable image of your stats
- Choose between story (vertical) and landscape formats
- Copy to clipboard, download, or share directly

## Troubleshooting

**"Spicetify is not defined"**

- Extension loaded before Spicetify initialized
- Check the init loop in `app.tsx` waits for APIs

**Stats not updating**

- Check DevTools console for errors
- Verify tracker is running: should log "Now tracking: ..."
- For local provider: check IndexedDB has data

**Rate limit errors (429)**

- Normal for heavy usage
- Extension backs off automatically with exponential retry
- Settings → "Clear Cache" resets state

**Last.fm connection issues**

- Verify your API key is valid at [last.fm/api](https://www.last.fm/api)
- Check that your username is correct
- See the [Last.fm Setup Guide](https://github.com/Xndr2/listening-stats/wiki/Last.fm-Setup-Guide) for help

## Privacy

All data stored locally. Nothing sent to external servers beyond the APIs you choose to use:

- **Local provider**: all data in IndexedDB, API calls go to `api.spotify.com` using your existing session
- **Last.fm provider**: calls go to `ws.audioscrobbler.com` (Last.fm API) and `api.spotify.com` for enrichment

No proxy, no analytics, no data collection.

## AI

AI was only used to write documentation (like this readme, english is not my main language so it's easier to let AI do this), write the install scripts and generate the svg icons.
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
