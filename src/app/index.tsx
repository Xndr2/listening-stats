import { calculateStats, clearStatsCache } from "../services/stats";
import {
  checkForUpdates,
  copyInstallCommand,
  getCurrentVersion,
  getInstallCommand,
  UpdateInfo,
} from "../services/updater";
import { ListeningStats, ProviderType } from "../types/listeningstats";
import {
  getSelectedProviderType,
  getActiveProvider,
  activateProvider,
} from "../services/providers";
import { onStatsUpdated } from "../services/tracker";
import {
  ActivityChart,
  EmptyState,
  Footer,
  GenreTimeline,
  LoadingSkeleton,
  OverviewCards,
  RecentlyPlayed,
  SetupScreen,
  SettingsPanel,
  TopLists,
  UpdateBanner,
} from "./components";
import { Header } from "./components/Header";
import { injectStyles } from "./styles";
import { ShareCardModal } from "./components/ShareCardModal";
import { checkLikedTracks, toggleLike } from "./utils";

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
    };
  }

  componentDidMount() {
    injectStyles();

    if (!this.state.needsSetup) {
      this.loadStats();
      this.checkForUpdateOnLoad();
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
        const adjacent = [provider.periods[idx - 1], provider.periods[idx + 1]].filter(Boolean);
        for (const p of adjacent) {
          provider.prefetchPeriod(p);
        }
      }
    } catch (e: any) {
      console.error("[ListeningStats] Load failed:", e);
      this.setState({ loading: false, error: e.message || "Failed to load stats" });
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

  handleProviderSelected = () => {
    const provider = getActiveProvider();
    if (provider) {
      this.setState({
        needsSetup: false,
        providerType: provider.type,
        period: provider.defaultPeriod,
        loading: true,
      }, () => {
        this.loadStats();
        this.checkForUpdateOnLoad();
      });
    }
  };

  handleProviderChanged = () => {
    clearStatsCache();
    const provider = getActiveProvider();
    if (provider) {
      this.setState({
        providerType: provider.type,
        period: provider.defaultPeriod,
        stats: null,
        loading: true,
        showSettings: false,
      }, () => {
        this.loadStats();
      });
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

    if (showUpdateBanner && updateInfo) {
      return (
        <UpdateBanner
          updateInfo={updateInfo}
          commandCopied={commandCopied}
          onDismiss={this.dismissUpdateBanner}
          onCopyCommand={this.copyUpdateCommand}
        />
      );
    }

    if (loading) {
      return <LoadingSkeleton />;
    }

    if (error && !stats) {
      return (
        <div className="stats-page">
          <Header
            onToggleSettings={() => this.setState({ showSettings: !showSettings })}
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
        </div>
      );
    }

    const settingsModal = showSettings ? Spicetify.ReactDOM.createPortal(
      <div className="settings-overlay" onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains("settings-overlay")) {
          this.setState({ showSettings: false });
        }
      }}>
        <SettingsPanel
          onRefresh={this.loadStats}
          onCheckUpdates={this.checkUpdatesManual}
          onProviderChanged={this.handleProviderChanged}
          onClose={() => this.setState({ showSettings: false })}
          stats={stats}
          period={period}
        />
      </div>,
      document.body,
    ) : null;

    if (!stats || (stats.topTracks.length === 0 && stats.recentTracks.length === 0)) {
      return (
        <div className="stats-page">
          <Header
            onShare={stats ? this.handleShare : undefined}
            onToggleSettings={() => this.setState({ showSettings: !showSettings })}
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
          onToggleSettings={() => this.setState({ showSettings: !showSettings })}
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

        <GenreTimeline />

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

        {showShareModal && stats && Spicetify.ReactDOM.createPortal(
          <ShareCardModal
            stats={stats}
            period={period}
            providerType={providerType}
            onClose={() => this.setState({ showShareModal: false })}
          />,
          document.body,
        )}
      </div>
    );
  }
}

export default StatsPage;
