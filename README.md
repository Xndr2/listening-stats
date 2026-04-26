# Listening Stats - Spicetify Custom App

A real-time listening statistics dashboard for Spotify, powered by Spicetify.  
   
---
**I am reworking the entire project from the ground up. This will take some time, and a lot of testing.  
Please leave feedback on the current system in my discord server: https://discord.gg/XtqbFAHk6a  
Thanks for all the support - Xander**

---

![GitHub release](https://img.shields.io/github/v/release/Xndr2/Listening-Stats)
![Spicetify](https://img.shields.io/badge/spicetify-2.x-1DB954)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/Xndr2/listening-stats/total)

<img width="600" height="" alt="image" src="https://github.com/user-attachments/assets/b66daa0e-4d08-4eb2-b5ff-6b693ce4dbdc" />

## Features

- **Multiple data providers:** stats.fm (recommended), Last.fm, or local on-device tracking
- **Top tracks, artists, albums & genres:** ranked by play count or listening time
- **Activity chart:** visualize listening patterns by hour
- **Share cards:** generate shareable stat images in story or landscape format
- **Tracking controls:** pause tracking, skip repeat detection, auto-updating playlists
- **Customizable dashboard:** drag-and-drop layout, section visibility, full Spicetify theme support
- **Data export:** export stats as JSON or CSV

For the full feature list, setup guides, and troubleshooting, see the [Wiki](https://github.com/Xndr2/listening-stats/wiki).

## Installation

Make sure you have [Spicetify](https://spicetify.app/) installed and working.

**Linux / macOS:**

```bash
curl -fsSL https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.ps1 | iex
```

**Manual install:** Download from [Releases](https://github.com/Xndr2/listening-stats/releases), extract to your Spicetify CustomApps folder, then run `spicetify config custom_apps listening-stats && spicetify apply`.

## Privacy

All data stored locally. No proxy, no analytics, no data collection. API calls only go to the providers you choose (Spotify, stats.fm, or Last.fm).

## Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes, test locally
4. Open PR

## License

MIT
