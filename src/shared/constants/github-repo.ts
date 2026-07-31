/** Upstream repo (install script, announcements). */
const GITHUB_REPO_OWNER = "Xndr2";
const GITHUB_REPO_NAME = "listening-stats";

const GITHUB_REPO_SLUG = `${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;

export const GITHUB_REPO_WEB_URL = `https://github.com/${GITHUB_REPO_SLUG}`;

/** Stable channel: asset attached to the repo’s latest non-prerelease GitHub Release (redirect URL). */
export const GITHUB_RELEASE_LATEST_ZIP_URL = `${GITHUB_REPO_WEB_URL}/releases/latest/download/listening-stats.zip`;

/** Raw files on the default branch (`ANNOUNCEMENT.md`, `CHANGELOG.md`, `install.sh`, …). */
export const GITHUB_RAW_MAIN_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO_SLUG}/main`;

/**
 * Optional `latest-release.json` on the `dist` branch (Marketplace metadata mirror).
 * App updates / zip installs use `main`; this URL is only a fallback for version metadata.
 */
export const GITHUB_DIST_META_URL = `https://raw.githubusercontent.com/${GITHUB_REPO_SLUG}/dist/latest-release.json`;

export const JSDELIVR_DIST_META_URL = `https://cdn.jsdelivr.net/gh/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}@dist/latest-release.json`;

/** GitHub REST API  -  works from Spotify/xpui (`api.github.com`). */
export const GITHUB_API_REPO_BASE = `https://api.github.com/repos/${GITHUB_REPO_SLUG}`;
