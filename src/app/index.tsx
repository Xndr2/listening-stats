// Main Stats Page Component - Rebuilt UI
import {
  clearApiCaches,
  getRateLimitRemaining,
  isApiAvailable,
  resetRateLimit,
} from "../services/spotify-api";
import {
  calculateStats,
  formatDuration,
  formatDurationLong,
  getPeriodDisplayName,
} from "../services/stats";
import { clearAllData } from "../services/storage";
import { runBackgroundEnrichment } from "../services/tracker";
import {
  checkForUpdates,
  copyInstallCommand,
  getCurrentVersion,
  getInstallCommand,
  UpdateInfo,
} from "../services/updater";
import { ListeningStats, TimePeriod } from "../types";
import { Icons } from "./icons";
import { injectStyles } from "./styles";
import {
  checkLikedTracks,
  estimateArtistPayout,
  fetchArtistImages,
  formatHour,
  formatMinutes,
  getRankClass,
  navigateToUri,
  toggleLike,
} from "./utils";

const VERSION = getCurrentVersion();
const TOP_ITEMS_COUNT = 6;

interface State {
  period: TimePeriod;
  stats: ListeningStats | null;
  loading: boolean;
  likedTracks: Map<string, boolean>;
  artistImages: Map<string, string>;
  updateInfo: UpdateInfo | null;
  showUpdateBanner: boolean;
  commandCopied: boolean;
  showSettings: boolean;
  apiAvailable: boolean;
  lastUpdateTimestamp: number;
}

class StatsPage extends Spicetify.React.Component<{}, State> {
  private pollInterval: number | null = null;

  constructor(props: {}) {
    super(props);
    this.state = {
      period: "today",
      stats: null,
      loading: true,
      likedTracks: new Map(),
      artistImages: new Map(),
      updateInfo: null,
      showUpdateBanner: false,
      commandCopied: false,
      showSettings: false,
      apiAvailable: true,
      lastUpdateTimestamp: 0,
    };
  }

  componentDidMount() {
    injectStyles();
    this.loadStats();
    this.checkForUpdateOnLoad();

    this.pollInterval = window.setInterval(() => {
      const ts = localStorage.getItem("listening-stats:lastUpdate");
      if (ts) {
        const t = parseInt(ts, 10);
        if (t > this.state.lastUpdateTimestamp) {
          this.setState({ lastUpdateTimestamp: t });
          this.loadStats();
        }
      }
      this.setState({ apiAvailable: isApiAvailable() });
    }, 2000);
  }

  componentWillUnmount() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  componentDidUpdate(_: {}, prev: State) {
    if (prev.period !== this.state.period) this.loadStats();
  }

  // Check for updates when the stats page loads
  checkForUpdateOnLoad = async () => {
    const info = await checkForUpdates();
    if (info.available) {
      this.setState({ updateInfo: info, showUpdateBanner: true });
    }
  };

  // Manual check for updates (from settings button)
  checkUpdatesManual = async () => {
    const info = await checkForUpdates();
    this.setState({ updateInfo: info, commandCopied: false });

    if (info.available) {
      this.setState({ showUpdateBanner: true });
    } else {
      Spicetify.showNotification("You are on the latest version!");
    }
  };

  // Copy update command to clipboard
  copyUpdateCommand = async () => {
    const copied = await copyInstallCommand();
    if (copied) {
      this.setState({ commandCopied: true });
      Spicetify.showNotification("Command copied! Paste in your terminal.");
    } else {
      Spicetify.showNotification(
        "Failed to copy. Check console for command.",
        true,
      );
      console.log("[ListeningStats] Install command:", getInstallCommand());
    }
  };

  // Dismiss the update banner for this session
  dismissUpdateBanner = () => {
    this.setState({ showUpdateBanner: false });
  };

  loadStats = async () => {
    this.setState({ loading: true });
    try {
      const data = await calculateStats(this.state.period);
      this.setState({ stats: data, loading: false });

      if (data.topTracks.length > 0) {
        const uris = data.topTracks.map((t) => t.trackUri);
        const liked = await checkLikedTracks(uris);
        this.setState({ likedTracks: liked });
      }

      if (data.topArtists.length > 0) {
        const uris = data.topArtists.map((a) => a.artistUri).filter(Boolean);
        const images = await fetchArtistImages(uris);
        this.setState({ artistImages: images });
      }
    } catch (e) {
      console.error("[ListeningStats] Load failed:", e);
      this.setState({ loading: false });
    }
  };

  handleLikeToggle = async (uri: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = this.state.likedTracks.get(uri) || false;
    const newVal = await toggleLike(uri, current);
    const m = new Map(this.state.likedTracks);
    m.set(uri, newVal);
    this.setState({ likedTracks: m });
  };

  render() {
    const {
      period,
      stats,
      loading,
      likedTracks,
      artistImages,
      updateInfo,
      showUpdateBanner,
      commandCopied,
      showSettings,
      apiAvailable,
    } = this.state;
    const React = Spicetify.React;

    // Update UI takes absolute priority - render ONLY this when update is available and not dismissed
    if (showUpdateBanner && updateInfo) {
      return (
        <div className="stats-page">
          <div className="update-banner-container">
            <div className="update-banner">
              <div className="update-banner-header">
                <div className="update-banner-icon">🎉</div>
                <div className="update-banner-title">Update Available!</div>
                <div className="update-banner-version">
                  v{updateInfo.currentVersion} → v{updateInfo.latestVersion}
                </div>
              </div>
              {updateInfo.changelog && (
                <div className="update-banner-changelog">
                  {updateInfo.changelog}
                </div>
              )}
              <div className="update-banner-actions">
                <button
                  className="update-banner-btn secondary"
                  onClick={this.dismissUpdateBanner}
                >
                  I'll do this later
                </button>
                <button
                  className={`update-banner-btn primary ${commandCopied ? "copied" : ""}`}
                  onClick={this.copyUpdateCommand}
                >
                  {commandCopied ? "✓ Copied!" : "📋 Copy Command"}
                </button>
              </div>
              <div className="updating-text">
                Paste the command in your terminal, then restart Spotify.
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="stats-page">
          <div className="loading">Loading...</div>
        </div>
      );
    }

    const periodTabs = (
      <div className="period-tabs">
        {(["today", "week", "month", "allTime"] as TimePeriod[]).map((p) => (
          <button
            key={p}
            className={`period-tab ${period === p ? "active" : ""}`}
            onClick={() => this.setState({ period: p })}
          >
            {p === "today"
              ? "Today"
              : p === "week"
                ? "This Week"
                : p === "month"
                  ? "This Month"
                  : "All Time"}
          </button>
        ))}
      </div>
    );

    // Empty state
    if (!stats || stats.trackCount === 0) {
      return (
        <div className="stats-page">
          <div className="stats-header">
            <h1 className="stats-title">Listening Stats</h1>
            <p className="stats-subtitle">Your personal music analytics</p>
          </div>

          {/* Overview Cards Row */}
          <div className="overview-row">
            {/* Hero - Time Listened */}
            <div className="overview-card hero">
              <div className="overview-value">
                {formatDurationLong(stats.totalTimeMs)}
              </div>
              <div className="overview-label">
                No data for {getPeriodDisplayName(period)}
              </div>
              {periodTabs}
              <div className="overview-secondary">
                Start listening to see your stats!
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="stats-footer">
            <div className="footer-left">
              <button
                className="settings-toggle"
                onClick={() => this.setState({ showSettings: !showSettings })}
              >
                <span dangerouslySetInnerHTML={{ __html: Icons.settings }} />
                Settings
              </button>
              {updateInfo?.available && (
                <button
                  className="footer-btn primary"
                  onClick={() => this.setState({ showUpdateBanner: true })}
                >
                  Update v{updateInfo.latestVersion}
                </button>
              )}
            </div>
            <span className="version-text">
              v{VERSION} - ❤️ made with love by{" "}
              <a href="https://github.com/Xndr2/listening-stats">Xndr</a>
            </span>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="settings-panel">
              <div className="settings-row">
                <button className="footer-btn" onClick={() => this.loadStats()}>
                  Refresh
                </button>
                <button
                  className="footer-btn"
                  onClick={async () => {
                    await runBackgroundEnrichment(true);
                    this.loadStats();
                    Spicetify.showNotification("Data enriched");
                  }}
                >
                  Enrich Data
                </button>
                <button
                  className="footer-btn"
                  onClick={() => {
                    resetRateLimit();
                    clearApiCaches();
                    Spicetify.showNotification("Cache cleared");
                  }}
                >
                  Clear Cache
                </button>
                <button
                  className="footer-btn"
                  onClick={this.checkUpdatesManual}
                >
                  Check Updates
                </button>
                <button
                  className="footer-btn danger"
                  onClick={async () => {
                    if (confirm("Delete all listening data?")) {
                      await clearAllData();
                      this.setState({ stats: null });
                    }
                  }}
                >
                  Reset Data
                </button>
              </div>
              <div className="api-status">
                <span
                  className={`status-dot ${apiAvailable ? "green" : "red"}`}
                />
                API:{" "}
                {apiAvailable
                  ? "Available"
                  : `Limited (${Math.ceil(getRateLimitRemaining() / 60)}m)`}
              </div>
            </div>
          )}
        </div>
      );
    }

    const payout = estimateArtistPayout(stats.trackCount);

    return (
      <div className="stats-page">
        {/* Update Banner */}
        {showUpdateBanner && updateInfo && (
          <div className="update-banner-backdrop">
            <div className="update-banner">
              <div className="update-banner-header">
                <div className="update-banner-icon">🎉</div>
                <div className="update-banner-title">Update Available!</div>
                <div className="update-banner-version">
                  v{updateInfo.currentVersion} → v{updateInfo.latestVersion}
                </div>
              </div>
              {updateInfo.changelog && (
                <div className="update-banner-changelog">
                  {updateInfo.changelog}
                </div>
              )}
              <div className="update-banner-actions">
                <button
                  className="update-banner-btn secondary"
                  onClick={this.dismissUpdateBanner}
                >
                  I'll do this later
                </button>
                <button
                  className={`update-banner-btn primary ${commandCopied ? "copied" : ""}`}
                  onClick={this.copyUpdateCommand}
                >
                  {commandCopied ? "✓ Copied!" : "📋 Copy Command"}
                </button>
              </div>
              {commandCopied && (
                <div className="update-banner-hint">
                  Paste the command in your terminal, then restart Spotify.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="stats-header">
          <h1 className="stats-title">Listening Stats</h1>
          <p className="stats-subtitle">Your personal music analytics</p>
        </div>

        {/* Overview Cards Row */}
        <div className="overview-row">
          {/* Hero - Time Listened */}
          <div className="overview-card hero">
            <div className="overview-value">
              {formatDurationLong(stats.totalTimeMs)}
            </div>
            <div className="overview-label">Time Listened</div>
            {periodTabs}
            <div className="overview-secondary">
              <div className="overview-stat">
                <div className="overview-stat-value">{stats.trackCount}</div>
                <div className="overview-stat-label">Tracks</div>
              </div>
              <div className="overview-stat">
                <div className="overview-stat-value">
                  {stats.uniqueArtistCount}
                </div>
                <div className="overview-stat-label">Artists</div>
              </div>
              <div className="overview-stat">
                <div className="overview-stat-value">
                  {stats.uniqueTrackCount}
                </div>
                <div className="overview-stat-label">Unique</div>
              </div>
            </div>
          </div>

          {/* 4 info cards */}
          <div className="overview-card-list">
            {/* Payout */}
            <div className="overview-card">
              <div className="stat-colored">
                {/* <div
                className="stat-icon green"
                dangerouslySetInnerHTML={{ __html: Icons.money }}
              /> */}
                <div className="stat-text">
                  <div className="overview-value green">${payout}</div>
                  <div className="overview-label">Spotify paid artists</div>
                  <div className="overview-label-tooltip">
                    From you listening to their music!
                  </div>
                </div>
              </div>
            </div>

            {/* Streak */}
            <div className="overview-card">
              <div className="stat-colored">
                {/* <div
                className="stat-icon orange"
                dangerouslySetInnerHTML={{ __html: Icons.fire }}
              /> */}
                <div className="stat-text">
                  <div className="overview-value orange">
                    {stats.streakDays}
                  </div>
                  <div className="overview-label">Day Streak</div>
                  <div className="overview-label-tooltip">
                    Resets at midnight local time.
                  </div>
                </div>
              </div>
            </div>

            {/* New Artists */}
            <div className="overview-card">
              <div className="stat-colored">
                {/* <div
                className="stat-icon purple"
                dangerouslySetInnerHTML={{ __html: Icons.users }}
              /> */}
                <div className="stat-text">
                  <div className="overview-value purple">
                    {stats.newArtistsCount}
                  </div>
                  <div className="overview-label">New Artists</div>
                  <div className="overview-label-tooltip">
                    You're cool if this is high!
                  </div>
                </div>
              </div>
            </div>

            {/* Skip Rate */}
            <div className="overview-card">
              <div className="stat-colored">
                {/* <div
                className="stat-icon purple"
                dangerouslySetInnerHTML={{ __html: Icons.users }}
              /> */}
                <div className="stat-text">
                  <div className="overview-value red">
                    {Math.floor(stats.skipRate * 100)}%
                  </div>
                  <div className="overview-label">Skip Rate</div>
                  <div className="overview-label-tooltip">
                    Get this as low as possible!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Lists Section */}
        <div className="top-lists-section">
          {/* Top Tracks */}
          <div className="top-list">
            <div className="top-list-header">
              <h3 className="top-list-title">
                <span dangerouslySetInnerHTML={{ __html: Icons.music }} />
                Top Tracks
              </h3>
            </div>
            <div className="item-list">
              {stats.topTracks.slice(0, TOP_ITEMS_COUNT).map((t, i) => (
                <div
                  key={t.trackUri}
                  className="item-row"
                  onClick={() => navigateToUri(t.trackUri)}
                >
                  <span className={`item-rank ${getRankClass(i)}`}>
                    {i + 1}
                  </span>
                  {t.albumArt && (
                    <img src={t.albumArt} className="item-art" alt="" />
                  )}
                  <div className="item-info">
                    <div className="item-name">{t.trackName}</div>
                    <div className="item-meta">{t.artistName}</div>
                  </div>
                  <div className="item-stats">
                    <span className="item-plays">{t.playCount} plays</span>
                    <span className="item-time">
                      {formatDuration(t.totalTimeMs)}
                    </span>
                  </div>
                  <button
                    className={`heart-btn ${likedTracks.get(t.trackUri) ? "liked" : ""}`}
                    onClick={(e) => this.handleLikeToggle(t.trackUri, e)}
                    dangerouslySetInnerHTML={{
                      __html: likedTracks.get(t.trackUri)
                        ? Icons.heartFilled
                        : Icons.heart,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Top Artists */}
          <div className="top-list">
            <div className="top-list-header">
              <h3 className="top-list-title">
                <span dangerouslySetInnerHTML={{ __html: Icons.users }} />
                Top Artists
              </h3>
            </div>
            <div className="item-list">
              {stats.topArtists.slice(0, TOP_ITEMS_COUNT).map((a, i) => {
                const img = artistImages.get(a.artistUri) || a.artistImage;
                return (
                  <div
                    key={a.artistUri || a.artistName}
                    className="item-row"
                    onClick={() => a.artistUri && navigateToUri(a.artistUri)}
                  >
                    <span className={`item-rank ${getRankClass(i)}`}>
                      {i + 1}
                    </span>
                    {img && <img src={img} className="item-art round" alt="" />}
                    <div className="item-info">
                      <div className="item-name">{a.artistName}</div>
                      <div className="item-meta">{a.playCount} plays</div>
                    </div>
                    <div className="item-stats">
                      <span className="item-time">
                        {formatDuration(a.totalTimeMs)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Albums */}
          <div className="top-list">
            <div className="top-list-header">
              <h3 className="top-list-title">
                <span dangerouslySetInnerHTML={{ __html: Icons.album }} />
                Top Albums
              </h3>
            </div>
            <div className="item-list">
              {stats.topAlbums.slice(0, TOP_ITEMS_COUNT).map((a, i) => (
                <div
                  key={a.albumUri}
                  className="item-row"
                  onClick={() => navigateToUri(a.albumUri)}
                >
                  <span className={`item-rank ${getRankClass(i)}`}>
                    {i + 1}
                  </span>
                  {a.albumArt && (
                    <img src={a.albumArt} className="item-art" alt="" />
                  )}
                  <div className="item-info">
                    <div className="item-name">{a.albumName}</div>
                    <div className="item-meta">{a.artistName}</div>
                  </div>
                  <div className="item-stats">
                    <span className="item-plays">{a.playCount} plays</span>
                    <span className="item-time">
                      {formatDuration(a.totalTimeMs)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Chart */}
        {stats.hourlyDistribution.some((h) => h > 0) && (
          <div className="activity-section">
            <div className="activity-header">
              <h3 className="activity-title">Activity by Hour</h3>
              <div className="activity-peak">
                Peak: <strong>{formatHour(stats.peakHour)}</strong>
              </div>
            </div>
            <div className="activity-chart">
              {stats.hourlyDistribution.map((val, hr) => {
                const max = Math.max(...stats.hourlyDistribution, 1);
                const h = val > 0 ? Math.max((val / max) * 100, 5) : 0;
                return (
                  <div
                    key={hr}
                    className={`activity-bar ${hr === stats.peakHour && val > 0 ? "peak" : ""}`}
                    style={{ height: `${h}%` }}
                  >
                    <div className="activity-bar-tooltip">
                      {formatHour(hr)}: {formatMinutes(val)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="chart-labels">
              <span>12am</span>
              <span>6am</span>
              <span>12pm</span>
              <span>6pm</span>
              <span>12am</span>
            </div>
          </div>
        )}

        {/* Recently Played */}
        {stats.recentTracks.length > 0 && (
          <div className="recent-section">
            <div className="recent-header">
              <h3 className="recent-title">Recently Played</h3>
            </div>
            <div className="recent-scroll">
              {stats.recentTracks.slice(0, 12).map((t) => (
                <div
                  key={`${t.trackUri}-${t.startedAt}`}
                  className="recent-card"
                  onClick={() => navigateToUri(t.trackUri)}
                >
                  {t.albumArt ? (
                    <img src={t.albumArt} className="recent-art" alt="" />
                  ) : (
                    <div className="recent-art" />
                  )}
                  <div className="recent-name">{t.trackName}</div>
                  <div className="recent-meta">{t.artistName}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="stats-footer">
          <div className="footer-left">
            <button
              className="settings-toggle"
              onClick={() => this.setState({ showSettings: !showSettings })}
            >
              <span dangerouslySetInnerHTML={{ __html: Icons.settings }} />
              Settings
            </button>
            {updateInfo?.available && (
              <button
                className="footer-btn primary"
                onClick={() =>
                  this.setState({
                    showUpdateBanner: true,
                    commandCopied: false,
                  })
                }
              >
                Update v{updateInfo.latestVersion}
              </button>
            )}
          </div>
          <span className="version-text">
            v{VERSION} - ❤️ made with love by{" "}
            <a href="https://github.com/Xndr2/listening-stats">Xndr</a>
          </span>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="settings-panel">
            <div className="settings-row">
              <button className="footer-btn" onClick={() => this.loadStats()}>
                Refresh
              </button>
              <button
                className="footer-btn"
                onClick={async () => {
                  await runBackgroundEnrichment(true);
                  this.loadStats();
                  Spicetify.showNotification("Data enriched");
                }}
              >
                Enrich Data
              </button>
              <button
                className="footer-btn"
                onClick={() => {
                  resetRateLimit();
                  clearApiCaches();
                  Spicetify.showNotification("Cache cleared");
                }}
              >
                Clear Cache
              </button>
              <button className="footer-btn" onClick={this.checkUpdatesManual}>
                Check Updates
              </button>
              <button
                className="footer-btn danger"
                onClick={async () => {
                  if (confirm("Delete all listening data?")) {
                    await clearAllData();
                    this.setState({ stats: null });
                  }
                }}
              >
                Reset Data
              </button>
            </div>
            <div className="api-status">
              <span
                className={`status-dot ${apiAvailable ? "green" : "red"}`}
              />
              API:{" "}
              {apiAvailable
                ? "Available"
                : `Limited (${Math.ceil(getRateLimitRemaining() / 60)}m)`}
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default StatsPage;
