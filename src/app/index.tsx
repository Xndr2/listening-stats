import {
  activateProvider,
  getActiveProvider,
  getSelectedProviderType,
} from "../services/providers";
import { ApiError } from "../services/api-resilience";
import { onPreferencesChanged } from "../services/preferences";
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
  DraggableSection,
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
import { useSectionOrder } from "./hooks/useSectionOrder";
import { TourProvider, useTour, TourStep } from "./hooks/useTour";
import { injectStyles } from "./styles";
import { checkLikedTracks, toggleLike } from "./utils";

const { useRef, useState, useCallback, useEffect } = Spicetify.React;

const SFM_PROMO_KEY = "listening-stats:sfm-promo-dismissed";

const VERSION = getCurrentVersion();

const TOUR_SEEN_KEY = 'listening-stats:tour-seen';
const TOUR_VERSION_KEY = 'listening-stats:tour-version';

const FULL_TOUR_STEPS: TourStep[] = [
  { target: '.overview-row', title: 'Overview', content: 'Your key stats at a glance — total listening time, track count, and more. Use the period tabs above to switch time ranges.', placement: 'bottom' },
  { target: '.top-lists-section', title: 'Top Lists', content: 'Your most played tracks, artists, albums, and genres ranked by play count.', placement: 'bottom' },
  { target: '.activity-section', title: 'Activity', content: 'Your listening patterns by hour of day. Find when you listen the most.', placement: 'top' },
  { target: '.recent-section', title: 'Recently Played', content: 'Your most recent tracks. Click any card to open it in Spotify.', placement: 'top' },
  { target: '.section-drag-handle', title: 'Reorder Sections', content: 'Drag these handles to rearrange your dashboard layout to your liking.', placement: 'right' },
  { target: '.header-actions', title: 'Share & Settings', content: 'Share your stats as an image or open settings to customize your experience.', placement: 'bottom' },
];

const UPDATE_TOUR_STEPS: TourStep[] = [
  { target: '.section-drag-handle', title: 'New: Drag to Reorder', content: 'You can now drag sections to customize your dashboard layout. Grab these handles to rearrange.', placement: 'right' },
];

function shouldShowTour(): 'full' | 'update' | 'none' {
  try {
    const seen = localStorage.getItem(TOUR_SEEN_KEY);
    if (!seen) return 'full';
    const lastVersion = localStorage.getItem(TOUR_VERSION_KEY);
    if (lastVersion !== VERSION) return 'update';
    return 'none';
  } catch { return 'none'; }
}

function markTourComplete(): void {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, '1');
    localStorage.setItem(TOUR_VERSION_KEY, VERSION);
  } catch { /* ignore */ }
}

interface DashboardSectionsProps {
  stats: ListeningStats;
  period: string;
  periods: string[];
  periodLabels: Record<string, string>;
  onPeriodChange: (period: string) => void;
  likedTracks: Map<string, boolean>;
  onLikeToggle: (uri: string, e: React.MouseEvent) => void;
  showLikeButtons: boolean;
}

const SECTION_REGISTRY: Record<
  string,
  (props: DashboardSectionsProps) => React.ReactElement
> = {
  overview: (p) => (
    <OverviewCards
      stats={p.stats}
      period={p.period}
      periods={p.periods}
      periodLabels={p.periodLabels}
      onPeriodChange={p.onPeriodChange}
    />
  ),
  toplists: (p) => (
    <TopLists
      stats={p.stats}
      likedTracks={p.likedTracks}
      onLikeToggle={p.onLikeToggle}
      showLikeButtons={p.showLikeButtons}
      period={p.period}
    />
  ),
  activity: (p) => (
    <ActivityChart
      hourlyDistribution={p.stats.hourlyDistribution}
      peakHour={p.stats.peakHour}
      hourlyUnit={p.stats.hourlyUnit}
    />
  ),
  recent: (p) => <RecentlyPlayed recentTracks={p.stats.recentTracks} />,
};

function DashboardSections(props: DashboardSectionsProps) {
  const { order, reorder } = useSectionOrder();
  const { startTour } = useTour();

  // Auto-trigger tour on first mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const tourType = shouldShowTour();
      if (tourType === 'full') {
        startTour(FULL_TOUR_STEPS);
        markTourComplete();
      } else if (tourType === 'update') {
        startTour(UPDATE_TOUR_STEPS);
        markTourComplete();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Listen for restart-tour event from Settings
  useEffect(() => {
    const handler = () => {
      startTour(FULL_TOUR_STEPS);
    };
    window.addEventListener('listening-stats:start-tour', handler);
    return () => window.removeEventListener('listening-stats:start-tour', handler);
  }, [startTour]);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragItemRef = useRef<string | null>(null);
  const dragOverRef = useRef<string | null>(null);
  const insertBeforeRef = useRef<boolean>(true);
  const scrollRafRef = useRef<number>(0);

  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: "before" | "after";
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragStart = useCallback((id: string) => {
    dragItemRef.current = id;
    setDraggingId(id);
  }, []);

  // Find nearest section boundary from mouse Y, scanning all sections
  const computeDropTarget = useCallback(
    (clientY: number) => {
      if (!containerRef.current || !dragItemRef.current) return;
      const sections =
        containerRef.current.querySelectorAll<HTMLElement>(".draggable-section");
      let bestId: string | null = null;
      let bestBefore = true;
      let bestDist = Infinity;

      sections.forEach((el) => {
        const id = el.dataset.sectionId;
        if (!id || id === dragItemRef.current) return;
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        // Distance to top edge vs bottom edge
        const distTop = Math.abs(clientY - rect.top);
        const distBot = Math.abs(clientY - rect.bottom);
        const dist = Math.min(distTop, distBot);
        // Use midpoint to decide before/after
        const before = clientY < mid;

        if (dist < bestDist) {
          bestDist = dist;
          bestId = id;
          bestBefore = before;
        }
      });

      if (bestId) {
        dragOverRef.current = bestId;
        insertBeforeRef.current = bestBefore;
        setDropTarget({
          id: bestId,
          position: bestBefore ? "before" : "after",
        });
      }
    },
    [],
  );

  // Auto-scroll when dragging near viewport edges
  const autoScroll = useCallback((clientY: number) => {
    cancelAnimationFrame(scrollRafRef.current);
    const EDGE = 80; // px from edge to start scrolling
    const MAX_SPEED = 18; // px per frame
    const scrollContainer = document.querySelector(
      ".main-view-container__scroll-node",
    ) as HTMLElement | null;
    const target = scrollContainer || document.documentElement;

    let speed = 0;
    if (clientY < EDGE) {
      speed = -MAX_SPEED * (1 - clientY / EDGE);
    } else if (clientY > window.innerHeight - EDGE) {
      speed = MAX_SPEED * (1 - (window.innerHeight - clientY) / EDGE);
    }

    if (speed !== 0) {
      const tick = () => {
        target.scrollTop += speed;
        scrollRafRef.current = requestAnimationFrame(tick);
      };
      scrollRafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const handleContainerDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      computeDropTarget(e.clientY);
      autoScroll(e.clientY);
    },
    [computeDropTarget, autoScroll],
  );

  const executeDrop = useCallback(() => {
    cancelAnimationFrame(scrollRafRef.current);
    const draggedId = dragItemRef.current;
    const overId = dragOverRef.current;
    const before = insertBeforeRef.current;

    if (draggedId && overId && draggedId !== overId) {
      const newOrder = order.filter((id) => id !== draggedId);
      const targetIdx = newOrder.indexOf(overId);
      if (targetIdx !== -1) {
        const insertIdx = before ? targetIdx : targetIdx + 1;
        newOrder.splice(insertIdx, 0, draggedId);
        reorder(newOrder);
      }
    }

    dragItemRef.current = null;
    dragOverRef.current = null;
    insertBeforeRef.current = true;
    setDropTarget(null);
    setDraggingId(null);
  }, [order, reorder]);

  const handleContainerDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      executeDrop();
    },
    [executeDrop],
  );

  const handleDragEnd = useCallback(() => {
    cancelAnimationFrame(scrollRafRef.current);
    dragItemRef.current = null;
    dragOverRef.current = null;
    insertBeforeRef.current = true;
    setDropTarget(null);
    setDraggingId(null);
  }, []);

  // Passthrough handlers for DraggableSection (events bubble to container)
  const noop = useCallback(
    (_e: React.DragEvent<HTMLDivElement>, _id: string) => {},
    [],
  );

  return (
    <div
      ref={containerRef}
      className="dashboard-sections"
      onDragOver={handleContainerDragOver}
      onDrop={handleContainerDrop}
    >
      {order.map((sectionId) => {
        const renderFn = SECTION_REGISTRY[sectionId];
        if (!renderFn) return null;
        const sectionDropPosition =
          dropTarget && dropTarget.id === sectionId
            ? dropTarget.position
            : null;
        return (
          <DraggableSection
            key={sectionId}
            id={sectionId}
            onDragStart={handleDragStart}
            onDragOver={noop}
            onDrop={noop}
            onDragEnd={handleDragEnd}
            isDragging={draggingId === sectionId}
            dropPosition={sectionDropPosition}
          >
            {renderFn(props)}
          </DraggableSection>
        );
      })}
    </div>
  );
}

interface State {
  period: string;
  stats: ListeningStats | null;
  loading: boolean;
  error: string | null;
  errorType: "api" | "generic" | null;
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
  private unsubPrefs: (() => void) | null = null;

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
      errorType: null,
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

    this.unsubPrefs = onPreferencesChanged(() => {
      this.forceUpdate();
    });
  }

  componentWillUnmount() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.unsubStatsUpdate?.();
    this.unsubPrefs?.();
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
    this.setState({ loading: true, error: null, errorType: null });
    try {
      const data = await calculateStats(this.state.period);
      this.setState({ stats: data, loading: false, errorType: null });

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
      const isApiError = e instanceof ApiError || e?.name === "ApiError";
      this.setState({
        loading: false,
        error: e.message || "Failed to load stats",
        errorType: isApiError ? "api" : "generic",
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
      Statsfm.saveConfig({ username: info.customId, isPlus: info.isPlus });
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
      const isApiFailure = this.state.errorType === "api";
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
              <h3>{isApiFailure ? "Could not fetch data" : "Something went wrong"}</h3>
              <p>
                {isApiFailure
                  ? "The data source is temporarily unavailable. This is usually caused by rate limiting — please wait a moment and try again."
                  : error}
              </p>
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
        <TourProvider>
          <Header
            onShare={this.handleShare}
            onToggleSettings={() =>
              this.setState({ showSettings: !showSettings })
            }
            providerType={providerType}
          />

          <DashboardSections
            stats={stats}
            period={period}
            periods={periods}
            periodLabels={periodLabels}
            onPeriodChange={this.handlePeriodChange}
            likedTracks={likedTracks}
            onLikeToggle={this.handleLikeToggle}
            showLikeButtons={showLikeButtons}
          />

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
        </TourProvider>
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
