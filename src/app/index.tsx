import {
  activateProvider,
  getActiveProvider,
  getSelectedProviderType,
} from "../services/providers";
import { calculateStats, clearStatsCache } from "../services/stats";
import * as Statsfm from "../services/statsfm";
import { onStatsUpdated } from "../services/tracker";
import {
  checkForUpdates,
  copyInstallCommand,
  getCurrentVersion,
  getInstallCommand,
  UpdateInfo,
} from "../services/updater";
import { ListeningStats, ProviderType } from "../types/listeningstats";
import {
  ActivityChart,
  EmptyState,
  Footer,
  LoadingSkeleton,
  OverviewCards,
  RecentlyPlayed,
  SettingsPanel,
  SetupScreen,
  TopLists,
  UpdateBanner,
} from "./components";
import { Header } from "./components/Header";
import { ShareCardModal } from "./components/ShareCardModal";
import { injectStyles } from "./styles";
import { checkLikedTracks, toggleLike } from "./utils";

const SFM_PROMO_KEY = "listening-stats:sfm-promo-dismissed";

const VERSION = getCurrentVersion();

interface State {
  period: string;
  stats: ListeningStats | null;
  loading: boolean;
  error: string | null;
  likedTracks: Map<string, boolean>;
  updateInfo: UpdateInfo | null;
  showUpdateBanner: boolean;
  commandCopied: boolean;
  showSettings: boolean;
  lastUpdateTimestamp: number;
  needsSetup: boolean;
  providerType: ProviderType | null;
  showShareModal: boolean;
  showSfmPromo: boolean;
}

class StatsPage extends Spicetify.React.Component<{}, State> {
  private pollInterval: number | null = null;
  private unsubStatsUpdate: (() => void) | null = null;

  constructor(props: {}) {
    super(props);

    let providerType = getSelectedProviderType();
    let needsSetup = false;

    if (!providerType) {
      needsSetup = true;
    }

    if (providerType && !getActiveProvider()) {
      activateProvider(providerType, true);
    }

    const provider = getActiveProvider();

    this.state = {
      period: provider?.defaultPeriod || "recent",
      stats: null,
      loading: !needsSetup,
      error: null,
      likedTracks: new Map(),
      updateInfo: null,
      showUpdateBanner: false,
      commandCopied: false,
      showSettings: false,
      lastUpdateTimestamp: 0,
      needsSetup,
      providerType,
      showShareModal: false,
      showSfmPromo: false,
    };
  }

  componentDidMount() {
    injectStyles();

    if (!this.state.needsSetup) {
      this.loadStats();
      this.checkForUpdateOnLoad();

      if (this.state.providerType && this.state.providerType !== "statsfm") {
        try {
          if (!localStorage.getItem(SFM_PROMO_KEY)) {
            this.setState({ showSfmPromo: true });
          }
        } catch {
          /* ignore */
        }
      }
    }

    this.unsubStatsUpdate = onStatsUpdated(() => {
      if (!this.state.needsSetup && !this.state.loading) {
        clearStatsCache();
        this.loadStats();
      }
    });
  }

  componentWillUnmount() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.unsubStatsUpdate?.();
  }

  componentDidUpdate(_: {}, prev: State) {
    if (prev.period !== this.state.period && !this.state.needsSetup) {
      this.loadStats();
    }
  }

  checkForUpdateOnLoad = async () => {
    const info = await checkForUpdates();
    if (info.available) {
      this.setState({ updateInfo: info, showUpdateBanner: true });
    }
  };

  checkUpdatesManual = async () => {
    const info = await checkForUpdates();
    this.setState({ updateInfo: info, commandCopied: false });

    if (info.available) {
      this.setState({ showUpdateBanner: true });
    } else {
      Spicetify.showNotification("You are on the latest version!");
    }
  };

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

  dismissUpdateBanner = () => {
    this.setState({ showUpdateBanner: false });
  };

  loadStats = async () => {
    this.setState({ loading: true, error: null });
    try {
      const data = await calculateStats(this.state.period);
      this.setState({ stats: data, loading: false });

      if (data.topTracks.length > 0 && data.topTracks[0].trackUri) {
        const uris = data.topTracks.map((t) => t.trackUri).filter(Boolean);
        if (uris.length > 0) {
          const liked = await checkLikedTracks(uris);
          this.setState({ likedTracks: liked });
        }
      }

      const provider = getActiveProvider();
      if (provider?.prefetchPeriod) {
        const idx = provider.periods.indexOf(this.state.period);
        const adjacent = [
          provider.periods[idx - 1],
          provider.periods[idx + 1],
        ].filter(Boolean);
        for (const p of adjacent) {
          provider.prefetchPeriod(p);
        }
      }
    } catch (e: any) {
      console.error("[ListeningStats] Load failed:", e);
      this.setState({
        loading: false,
        error: e.message || "Failed to load stats",
      });
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

  handlePeriodChange = (period: string) => {
    this.setState({ period });
  };

  handleShare = () => {
    this.setState({ showShareModal: true });
  };

  dismissSfmPromo = () => {
    this.setState({ showSfmPromo: false });
    try {
      localStorage.setItem(SFM_PROMO_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  handleSfmSwitch = async (username: string) => {
    try {
      const info = await Statsfm.validateUser(username.trim());
      Statsfm.saveConfig({ username: info.customId });
      this.dismissSfmPromo();
      activateProvider("statsfm");
      this.handleProviderChanged();
    } catch (err: any) {
      throw err;
    }
  };

  handleReset = () => {
    this.setState({
      needsSetup: true,
      providerType: null,
      stats: null,
      loading: false,
      error: null,
      showSettings: false,
      showSfmPromo: false,
      likedTracks: new Map(),
    });
  };

  handleProviderSelected = () => {
    const provider = getActiveProvider();
    if (provider) {
      let showSfmPromo = false;
      if (provider.type !== "statsfm") {
        try {
          if (!localStorage.getItem(SFM_PROMO_KEY)) {
            showSfmPromo = true;
          }
        } catch {
          /* ignore */
        }
      }
      this.setState(
        {
          needsSetup: false,
          providerType: provider.type,
          period: provider.defaultPeriod,
          loading: true,
          showSfmPromo,
        },
        () => {
          this.loadStats();
          this.checkForUpdateOnLoad();
        },
      );
    }
  };

  handleProviderChanged = () => {
    clearStatsCache();
    const provider = getActiveProvider();
    if (provider) {
      this.setState(
        {
          providerType: provider.type,
          period: provider.defaultPeriod,
          stats: null,
          loading: true,
          showSettings: false,
        },
        () => {
          this.loadStats();
        },
      );
    }
  };

  render() {
    const {
      period,
      stats,
      loading,
      error,
      likedTracks,
      updateInfo,
      showUpdateBanner,
      commandCopied,
      showSettings,
      needsSetup,
      providerType,
      showShareModal,
      showSfmPromo,
    } = this.state;

    if (needsSetup) {
      return (
        <div className="stats-page">
          <SetupScreen onProviderSelected={this.handleProviderSelected} />
        </div>
      );
    }

    const provider = getActiveProvider();
    const periods = provider?.periods || ["recent"];
    const periodLabels = provider?.periodLabels || { recent: "Recent" };
    const showLikeButtons = providerType !== "lastfm";

    const sfmPromoPortal = showSfmPromo
      ? Spicetify.ReactDOM.createPortal(
          <SfmPromoPopup
            onDismiss={this.dismissSfmPromo}
            onSwitch={this.handleSfmSwitch}
          />,
          document.body,
        )
      : null;

    if (showUpdateBanner && updateInfo) {
      return (
        <>
          <UpdateBanner
            updateInfo={updateInfo}
            commandCopied={commandCopied}
            onDismiss={this.dismissUpdateBanner}
            onCopyCommand={this.copyUpdateCommand}
          />
          {sfmPromoPortal}
        </>
      );
    }

    if (loading) {
      return (
        <>
          <LoadingSkeleton />
          {sfmPromoPortal}
        </>
      );
    }

    const settingsModal = showSettings
      ? Spicetify.ReactDOM.createPortal(
          <div
            className="settings-overlay"
            onClick={(e) => {
              if (
                (e.target as HTMLElement).classList.contains("settings-overlay")
              ) {
                this.setState({ showSettings: false });
              }
            }}
          >
            <SettingsPanel
              onRefresh={this.loadStats}
              onCheckUpdates={this.checkUpdatesManual}
              onProviderChanged={this.handleProviderChanged}
              onClose={() => this.setState({ showSettings: false })}
              onReset={this.handleReset}
              stats={stats}
              period={period}
            />
          </div>,
          document.body,
        )
      : null;

    if (error && !stats) {
      return (
        <div className="stats-page">
          <Header
            onToggleSettings={() =>
              this.setState({ showSettings: !showSettings })
            }
            providerType={providerType}
          />
          <div className="error-state">
            <div className="error-message">
              <h3>Something went wrong</h3>
              <p>{error}</p>
              <button className="footer-btn primary" onClick={this.loadStats}>
                Try Again
              </button>
            </div>
          </div>
          <Footer
            version={VERSION}
            updateInfo={updateInfo}
            onShowUpdate={() => this.setState({ showUpdateBanner: true })}
          />
          {settingsModal}
        </div>
      );
    }

    if (
      !stats ||
      (stats.topTracks.length === 0 && stats.recentTracks.length === 0)
    ) {
      return (
        <div className="stats-page">
          <Header
            onShare={stats ? this.handleShare : undefined}
            onToggleSettings={() =>
              this.setState({ showSettings: !showSettings })
            }
            providerType={providerType}
          />
          <EmptyState
            stats={stats}
            period={period}
            periods={periods}
            periodLabels={periodLabels}
            onPeriodChange={this.handlePeriodChange}
          />
          <Footer
            version={VERSION}
            updateInfo={updateInfo}
            onShowUpdate={() => this.setState({ showUpdateBanner: true })}
          />
          {settingsModal}
        </div>
      );
    }

    return (
      <div className="stats-page">
        <Header
          onShare={this.handleShare}
          onToggleSettings={() =>
            this.setState({ showSettings: !showSettings })
          }
          providerType={providerType}
        />

        <OverviewCards
          stats={stats}
          period={period}
          periods={periods}
          periodLabels={periodLabels}
          onPeriodChange={this.handlePeriodChange}
        />

        <TopLists
          stats={stats}
          likedTracks={likedTracks}
          onLikeToggle={this.handleLikeToggle}
          showLikeButtons={showLikeButtons}
          period={period}
        />

        <ActivityChart
          hourlyDistribution={stats.hourlyDistribution}
          peakHour={stats.peakHour}
          hourlyUnit={stats.hourlyUnit}
        />

        <RecentlyPlayed recentTracks={stats.recentTracks} />

        <Footer
          version={VERSION}
          updateInfo={updateInfo}
          onShowUpdate={() =>
            this.setState({ showUpdateBanner: true, commandCopied: false })
          }
        />

        {settingsModal}

        {showShareModal &&
          stats &&
          Spicetify.ReactDOM.createPortal(
            <ShareCardModal
              stats={stats}
              period={period}
              providerType={providerType}
              onClose={() => this.setState({ showShareModal: false })}
            />,
            document.body,
          )}

        {sfmPromoPortal}
      </div>
    );
  }
}

function SfmPromoPopup({
  onDismiss,
  onSwitch,
}: {
  onDismiss: () => void;
  onSwitch: (username: string) => Promise<void>;
}) {
  const [username, setUsername] = Spicetify.React.useState("");
  const [loading, setLoading] = Spicetify.React.useState(false);
  const [error, setError] = Spicetify.React.useState("");

  const handleSwitch = async () => {
    if (!username.trim()) {
      setError("Username is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSwitch(username);
    } catch (err: any) {
      setError(err.message || "Connection failed");
      setLoading(false);
    }
  };

  return (
    <div
      className="settings-overlay"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains("settings-overlay")) {
          onDismiss();
        }
      }}
    >
      <div className="sfm-promo-popup">
        <h3>Switch to stats.fm?</h3>
        <p>
          We now support <strong>stats.fm</strong> as a data source. It provides
          accurate play counts, listening duration, and only needs your username
          to set up.
          <br />
          This is highly recommended for a better experience!
        </p>
        <div className="setup-lastfm-form">
          <input
            className="lastfm-input"
            type="text"
            placeholder="stats.fm username"
            value={username}
            onChange={(e: any) => setUsername(e.target.value)}
            disabled={loading}
          />
          {error && <div className="lastfm-error">{error}</div>}
        </div>
        <div className="sfm-promo-actions">
          <button
            className="footer-btn primary"
            onClick={handleSwitch}
            disabled={loading}
          >
            {loading ? "Connecting..." : "Switch to stats.fm"}
          </button>
          <button className="footer-btn" onClick={onDismiss}>
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}

export default StatsPage;
