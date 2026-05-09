import { GITHUB_RAW_MAIN_BASE } from "./github-repo";

/** One-liner: downloads `install.sh` from `main`, installs into Spicetify CustomApps, runs `spicetify apply`. */
export const INSTALL_COMMAND_BASH = `curl -fsSL ${GITHUB_RAW_MAIN_BASE}/install.sh | bash`;

/** One-liner for Windows PowerShell (same behavior as the bash script). */
export const INSTALL_COMMAND_POWERSHELL = `irm ${GITHUB_RAW_MAIN_BASE}/install.ps1 | iex`;

/** Prerelease zip channel (GitHub API lookup); bash needs jq or python3. */
export const INSTALL_COMMAND_BASH_PRERELEASE = `LISTENING_STATS_PRERELEASE=1 curl -fsSL ${GITHUB_RAW_MAIN_BASE}/install.sh | bash`;

/** Prerelease zip channel for PowerShell. */
export const INSTALL_COMMAND_POWERSHELL_PRERELEASE = `$env:LISTENING_STATS_PRERELEASE = "1"; irm ${GITHUB_RAW_MAIN_BASE}/install.ps1 | iex`;
