# Security Policy

## Supported Versions

| Version  | Supported          |
| -------- | ------------------ |
| Latest   | :white_check_mark: |
| < Latest | :x:                |

Only the latest release is supported with security updates. Please update to the latest version before reporting issues.

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to the maintainer directly <business@xndr.site>

Please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You should receive a response within 72 hours. If the vulnerability is confirmed, a fix will be released as soon as possible and you will be credited in the release notes (unless you prefer to remain anonymous).

## Scope

This policy covers the Listening Stats Spicetify custom app, including:

- The extension code (`listening-stats.js`)
- The custom app code (`index.js`)
- The install scripts (`install.ps1`, `install.sh`)
- Any data handling related to provider integrations (stats.fm, Last.fm, local tracking)

## Data & Privacy

Listening Stats stores all user data locally:

- **Local provider**: IndexedDB in the Spotify client, no external calls beyond `api.spotify.com` (your existing session)
- **stats.fm provider**: calls to `api.stats.fm` (public API) and `api.spotify.com` for enrichment
- **Last.fm provider**: calls to `ws.audioscrobbler.com` (Last.fm API) and `api.spotify.com` for enrichment

No proxy, no analytics, no data collection. API keys and usernames are stored in `localStorage` on your machine only.
