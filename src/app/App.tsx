declare const __VERSION__: string;

import type { ParsedRemoteAnnouncement } from "../shared/announcements/remote-announcement";
import { fetchRemoteAnnouncement } from "../shared/announcements/remote-announcement";
import { EVENTS } from "../shared/constants/events";
import { LS_KEYS } from "../shared/constants/storage-keys";
import type { AppError } from "../shared/errors";
import { classifyStatsFmError, StatsFmError } from "../shared/errors";
import { initProviders } from "../shared/stats/init-providers";
import { LOCAL_PERIODS, WORLD_TAB_PERIOD, WORLD_TAB_PERIOD_ID } from "../shared/stats/periods";
import { allLoading, allResolved, EMPTY_STATS, type SectionSlots, slotKeyForWave } from "../shared/stats/progressive";
import type { ProviderRegistry } from "../shared/stats/provider";
import { providerRegistry } from "../shared/stats/provider";
import {
	restorePeriodForProvider,
	safeParseProviderPeriods,
	savePeriodForProvider,
} from "../shared/stats/provider-periods-storage";
import { statsCache } from "../shared/stats/stats-cache";
import type { Period, StatsResult } from "../shared/types/stats";
import type { UpdateCheckResult } from "../shared/update/update-check";
import { checkForAppUpdate, isUpdatePromptSnoozed } from "../shared/update/update-check";
import { resolveAnnouncementBanner } from "./banners";
import { getActivityMode, getSectionsForProvider } from "./capabilities";
import { ActivitySection } from "./components/ActivitySection";
import { AnnouncementBanner } from "./components/AnnouncementBanner";
import { AppFooter } from "./components/AppFooter";
import { ConsistencySection } from "./components/ConsistencySection";
import EmptyState from "./components/EmptyState";
import { clearActiveGenre, FilterPill, setActiveGenre } from "./components/FilterPill";
import { GuidedTour } from "./components/GuidedTour";
import Header from "./components/Header";
import { InlineErrorCard } from "./components/InlineErrorCard";
import OverviewSection from "./components/OverviewSection";
import { RecentlyPlayed } from "./components/RecentlyPlayed";
import { SetupWizard } from "./components/SetupWizard";
import { ShareModal } from "./components/ShareModal";
import type { SettingsTab } from "./components/settings/SettingsModal";
import { SettingsModal } from "./components/settings/SettingsModal";
import { TopGenres } from "./components/TopGenres";
import { TopLists } from "./components/TopLists";
import { UpdateModal } from "./components/UpdateModal";
import { WorldChartsPage } from "./components/WorldChartsPage";
import { getPreferences, setPreference } from "./preferences";
import { getTourSteps, shouldAutoStartTour } from "./tour";

export function buildCacheKey(activeProviderId: string, periodId: string): string {
	return `${activeProviderId}:${periodId}`;
}

export function shouldShowWizard(): boolean {
	return !localStorage.getItem(LS_KEYS.PROVIDER_WIZARD_SEEN);
}

export function markWizardSeen(): void {
	localStorage.setItem(LS_KEYS.PROVIDER_WIZARD_SEEN, "1");
}

export function buildProviderChangedState(registry: Pick<ProviderRegistry, "getActiveId">): {
	activeProviderId: string;
	isLocalProvider: boolean;
} {
	const id = registry.getActiveId() ?? "local";
	return { activeProviderId: id, isLocalProvider: id === "local" };
}

export { restorePeriodForProvider, safeParseProviderPeriods, savePeriodForProvider };

function getProviderPeriods(): Period[] {
	const provider = providerRegistry.getActive();
	return provider?.getSupportedPeriods() ?? LOCAL_PERIODS;
}

const { useState, useEffect, useCallback, useRef, useMemo } = Spicetify.React;

function App() {
	const [periods, setPeriods] = useState<Period[]>(LOCAL_PERIODS);
	const [activePeriod, setActivePeriod] = useState<Period>(LOCAL_PERIODS[0]);
	const [stats, setStats] = useState<StatsResult | null>(null);
	const [sectionSlots, setSectionSlots] = useState<SectionSlots>(allLoading());
	const [listColumnLoading, setListColumnLoading] = useState({
		tracks: true,
		artists: true,
		albums: true,
	});
	const [sectionErrors, setSectionErrors] = useState<Record<string, AppError | null>>({});
	const generationRef = useRef(0);
	const [activeRequestLabel, setActiveRequestLabel] = useState<string>("");
	const [showSettings, setShowSettings] = useState(false);
	const [initialized, setInitialized] = useState(false);
	const [prefsVersion, setPrefsVersion] = useState(0);
	const [activeProviderId, setActiveProviderId] = useState<string>(
		() => localStorage.getItem(LS_KEYS.ACTIVE_PROVIDER) ?? "local",
	);
	const [showWizard, setShowWizard] = useState<boolean>(shouldShowWizard);
	const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>("tracking");
	const [tourActive, setTourActive] = useState(() => shouldAutoStartTour(__VERSION__));
	const [activePage, setActivePage] = useState<string>(() => getPreferences().activePage);
	const [showShare, setShowShare] = useState(false);
	const [remoteAnnouncement, setRemoteAnnouncement] = useState<ParsedRemoteAnnouncement | null>(null);
	const [updateCheck, setUpdateCheck] = useState<UpdateCheckResult | null>(null);
	const [showUpdateModal, setShowUpdateModal] = useState(false);
	// silent=true skips loading skeleton (used for background refresh)
	const loadStats = useCallback(async (period: Period, silent = false) => {
		const gen = ++generationRef.current;
		const activeId = providerRegistry.getActiveId() ?? "local";
		const cacheKey = buildCacheKey(activeId, period.id);
		setActiveRequestLabel(`${activeId}:${period.id}`);
		if (!silent) {
			setSectionSlots(allLoading());
			setListColumnLoading({ tracks: true, artists: true, albums: true });
			setStats(null);
		}
		setSectionErrors({});
		try {
			if (!silent) {
				const cached = statsCache.get<StatsResult>(cacheKey);
				if (cached) {
					setStats(cached);
					setSectionSlots(allResolved());
					setListColumnLoading({
						tracks: false,
						artists: false,
						albums: false,
					});
					return;
				}
			}
			const provider = providerRegistry.getActive();
			if (!provider) throw new Error("No active provider");

			if (provider.calculateStatsProgressive) {
				let hasWaveError = false;
				const result = await provider.calculateStatsProgressive(period, (partial, wave, waveError) => {
					if (gen !== generationRef.current) return;
					const slotKey = slotKeyForWave(wave);
					if ("topTracks" in partial) {
						setListColumnLoading((prev) => ({ ...prev, tracks: false }));
					}
					if ("topArtists" in partial) {
						setListColumnLoading((prev) => ({ ...prev, artists: false }));
					}
					if ("topAlbums" in partial) {
						setListColumnLoading((prev) => ({ ...prev, albums: false }));
					}
					if ("dailyPlayCounts" in partial || "listeningDays" in partial) {
						setSectionSlots((prev) => ({ ...prev, consistency: "resolved" }));
					}
					if (waveError) {
						hasWaveError = true;
						setSectionErrors((prev) => ({ ...prev, [slotKey]: waveError }));
						setSectionSlots((prev) => ({ ...prev, [slotKey]: "error" }));
					} else {
						setStats((prev) => (prev ? { ...prev, ...partial } : { ...EMPTY_STATS, ...partial }));
						setSectionSlots((prev) => ({ ...prev, [slotKey]: "resolved" }));
					}
				});
				if (gen !== generationRef.current) return;
				// Always apply the terminal result to avoid stale/missing section holes.
				setStats((prev) => ({ ...(prev ?? EMPTY_STATS), ...result }));
				setListColumnLoading({ tracks: false, artists: false, albums: false });
				setSectionSlots((prev) => ({
					overview: prev.overview === "error" ? "error" : "resolved",
					lists: prev.lists === "error" ? "error" : "resolved",
					activity: prev.activity === "error" ? "error" : "resolved",
					consistency: prev.consistency === "error" ? "error" : "resolved",
				}));
				if (!hasWaveError) {
					statsCache.set(cacheKey, result);
				}
			} else {
				const result = await provider.calculateStats(period);
				if (gen !== generationRef.current) return;
				statsCache.set(cacheKey, result);
				setStats(result);
				setSectionSlots(allResolved());
				setListColumnLoading({ tracks: false, artists: false, albums: false });
			}
		} catch (e: unknown) {
			if (gen !== generationRef.current) return;
			const appError =
				e instanceof StatsFmError
					? e.appError
					: classifyStatsFmError(0, e instanceof Error ? e.message : "Failed to load stats");
			setSectionErrors({
				overview: appError,
				lists: appError,
				activity: appError,
			});
			setSectionSlots({
				overview: "error",
				lists: "error",
				activity: "error",
				consistency: "error",
			});
		}
	}, []);

	const periodTabsPeriods = useMemo(() => [...periods, WORLD_TAB_PERIOD], [periods]);
	const activePeriodForTabs = useMemo(
		() => (activePage === "world" ? WORLD_TAB_PERIOD : activePeriod),
		[activePage, activePeriod],
	);

	useEffect(() => {
		initProviders()
			.catch((err) => {
				console.error("[listening-stats] Provider Init failed: ", err);
			})
			.then(() => {
				// always leave the loading state
				// as per-section errors instead of an app stuck on skeletons
				const providerPeriods = getProviderPeriods();
				setPeriods(providerPeriods);
				const restored = restorePeriodForProvider(providerRegistry.getActiveId() ?? "local", providerPeriods);
				setActivePeriod(restored);
				setInitialized(true);
			});
	}, []);

	useEffect(() => {
		if (!initialized || activePage === "world") return;
		loadStats(activePeriod);
	}, [activePeriod, initialized, loadStats, activePage]);

	useEffect(() => {
		const handler = () => {
			const newId = providerRegistry.getActiveId() ?? "local";
			const providerPeriods = getProviderPeriods();
			setPeriods(providerPeriods);
			const restored = restorePeriodForProvider(newId, providerPeriods);
			setActivePeriod(restored);
			setActiveProviderId(newId);
			statsCache.invalidate();
			clearActiveGenre();
		};
		window.addEventListener(EVENTS.PROVIDER_CHANGED, handler);
		return () => window.removeEventListener(EVENTS.PROVIDER_CHANGED, handler);
	}, []);

	useEffect(() => {
		const handler = () => {
			if (activePage === "world") return;
			statsCache.invalidate();
			loadStats(activePeriod, true);
		};
		window.addEventListener(EVENTS.PLAY_RECORDED, handler);
		return () => window.removeEventListener(EVENTS.PLAY_RECORDED, handler);
	}, [activePeriod, loadStats, activePage]);

	useEffect(() => {
		const handler = () => setPrefsVersion((v) => v + 1);
		window.addEventListener(EVENTS.PREFS_CHANGED, handler);
		return () => window.removeEventListener(EVENTS.PREFS_CHANGED, handler);
	}, []);

	useEffect(() => {
		fetchRemoteAnnouncement()
			.then(setRemoteAnnouncement)
			.catch(() => {});
	}, []);

	const refreshUpdateCheck = useCallback(async () => {
		const p = getPreferences();
		const r = await checkForAppUpdate(__VERSION__, p.receiveBetaUpdates);
		setUpdateCheck(r);
		return r;
	}, []);

	useEffect(() => {
		if (!initialized) return;
		let cancelled = false;
		void (async () => {
			const r = await refreshUpdateCheck();
			if (cancelled) return;
			if (r.updateAvailable && !isUpdatePromptSnoozed()) {
				setShowUpdateModal(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [initialized, refreshUpdateCheck]);

	const openUpdatesModal = useCallback(async () => {
		setShowSettings(false);
		await refreshUpdateCheck();
		setShowUpdateModal(true);
	}, [refreshUpdateCheck]);

	const providerName = providerRegistry.getActive()?.getProviderInfo().name ?? "Local";
	const capabilities = providerRegistry.getActive()?.getProviderInfo().capabilities ?? null;
	const fallbackCaps = {
		hasActivityData: false,
		hasConsistencyData: false,
		hasGenreData: false,
		hasStreakData: false,
		hasSkipRate: false,
		tier: "n/a" as const,
	};
	const activeCaps = capabilities ?? fallbackCaps;
	const availableSectionIds = new Set(getSectionsForProvider(activeCaps).map((s) => s.id));

	const prefs = getPreferences();
	const showStreak = capabilities?.hasStreakData || activeProviderId === "statsfm";
	void prefsVersion;
	const isHidden = (id: string) => prefs.hiddenSections.includes(id);

	const handlePrefsChanged = useCallback(() => {
		setPrefsVersion((v) => v + 1);
	}, []);

	const handleReceiveBetaUpdatesChange = useCallback(
		(val: boolean) => {
			setPreference("receiveBetaUpdates", val);
			window.dispatchEvent(new CustomEvent(EVENTS.PREFS_CHANGED));
			handlePrefsChanged();
			void refreshUpdateCheck();
		},
		[handlePrefsChanged, refreshUpdateCheck],
	);

	const handlePeriodChange = useCallback((period: Period) => {
		if (period.id === WORLD_TAB_PERIOD_ID) {
			setShowShare(false);
			setActivePage("world");
			setPreference("activePage", "world");
			return;
		}
		setActivePage("dashboard");
		setPreference("activePage", "dashboard");
		setActivePeriod(period);
		savePeriodForProvider(providerRegistry.getActiveId() ?? "local", period.id);
		window.dispatchEvent(
			new CustomEvent(EVENTS.DASHBOARD_PERIOD_CHANGED, {
				detail: { periodId: period.id },
			}),
		);
	}, []);

	const handleRefresh = useCallback(async () => {
		if (providerRegistry.getActiveId() === "statsfm") {
			const { statsfmProvider } = await import("../shared/stats/statsfm-provider");
			await statsfmProvider.init();
			window.dispatchEvent(new CustomEvent(EVENTS.STATSFM_PROFILE_REFRESHED));
		}
		await loadStats(activePeriod);
	}, [activePeriod, loadStats]);

	const handleWizardComplete = useCallback(() => {
		markWizardSeen();
		setShowWizard(false);
	}, []);

	const openSettings = useCallback((tab: SettingsTab = "tracking") => {
		setSettingsInitialTab(tab);
		setShowSettings(true);
	}, []);

	const handleRestartTour = useCallback(() => {
		setShowSettings(false);
		setTourActive(true);
	}, []);

	const isSlotLoading = (slot: keyof SectionSlots) =>
		sectionSlots[slot] === "loading" || sectionSlots[slot] === "pending";

	const renderSectionById = (id: string): React.ReactNode => {
		switch (id) {
			case "overview":
				if (isSlotLoading("overview")) return <OverviewSection loading activePeriod={activePeriod} />;
				if (sectionErrors.overview)
					return (
						<InlineErrorCard
							error={sectionErrors.overview}
							onRetry={() => loadStats(activePeriod)}
							onOpenSettings={() => openSettings("providers")}
						/>
					);
				if (!stats) return null;
				return <OverviewSection stats={stats} activePeriod={activePeriod} />;
			case "top-genres":
				if (isSlotLoading("lists") || !stats) return null;
				if (!capabilities?.hasGenreData) return null;
				if (stats.topGenres.length === 0) return null;
				return <TopGenres topGenres={stats.topGenres} onGenreClick={setActiveGenre} activeGenre={prefs.activeGenre} />;
			case "top-lists": {
				const listsLoading = isSlotLoading("lists");
				if (sectionErrors.lists)
					return (
						<InlineErrorCard
							error={sectionErrors.lists}
							onRetry={() => loadStats(activePeriod)}
							onOpenSettings={() => openSettings("providers")}
						/>
					);
				if (!listsLoading && !stats) return null;
				return (
					<TopLists
						stats={stats ?? null}
						loading={listsLoading}
						loadingByColumn={listColumnLoading}
						hiddenSections={prefs.hiddenSections}
						onGenreClick={setActiveGenre}
						activeGenre={prefs.activeGenre}
					/>
				);
			}
			case "activity": {
				if (!capabilities) return null;
				const mode = getActivityMode(capabilities);
				if (mode === "hidden") return null;
				if (sectionErrors.activity)
					return (
						<InlineErrorCard
							error={sectionErrors.activity}
							onRetry={() => loadStats(activePeriod)}
							onOpenSettings={() => openSettings("providers")}
						/>
					);
				if (isSlotLoading("activity")) {
					return (
						<ActivitySection
							loading
							hourlyDistribution={[]}
							peakHour={0}
							weekdayDistribution={[]}
							peakWeekday={0}
							showStreak={false}
						/>
					);
				}

				if (!stats) return null;
				return (
					<ActivitySection
						hourlyDistribution={stats.hourlyDistribution}
						peakHour={stats.peakHour}
						weekdayDistribution={stats.weekdayDistribution ?? Array(7).fill(0)}
						peakWeekday={stats.peakWeekday ?? 0}
						dailyPlayCounts={stats.dailyPlayCounts}
						streak={stats.streak}
						showStreak={showStreak}
					/>
				);
			}
			case "consistency": {
				if (sectionSlots.consistency === "loading" || sectionSlots.consistency === "pending")
					return (
						<ConsistencySection
							loading
							activePeriod={activePeriod}
							activeProviderId={activeProviderId}
							totalPlays={0}
							totalDuration={0}
						/>
					);
				if (!stats) return null;
				return (
					<ConsistencySection
						totalPlays={stats.totalPlays}
						totalDuration={stats.totalDuration}
						listeningDays={stats.listeningDays}
						dailyPlayCounts={stats.dailyPlayCounts}
						streak={stats.streak}
						activePeriod={activePeriod}
						activeProviderId={activeProviderId}
					/>
				);
			}
			case "recently-played":
				if (isSlotLoading("overview")) return <RecentlyPlayed loading />;
				if (!stats) return null;
				return <RecentlyPlayed recentPlays={stats.recentPlays} />;
			default:
				return null;
		}
	};

	const renderDashboard = () => {
		const overviewDone = sectionSlots.overview === "resolved" || sectionSlots.overview === "error";
		const listsDone = sectionSlots.lists === "resolved" || sectionSlots.lists === "error";
		const noSectionErrors = Object.values(sectionErrors).every((e) => e == null);
		if (
			overviewDone &&
			listsDone &&
			noSectionErrors &&
			stats &&
			stats.totalPlays === 0 &&
			stats.topTracks.length === 0
		) {
			return <EmptyState onOpenSettings={() => openSettings()} />;
		}

		const sectionOrder = prefs.sectionOrder;
		const visibleSections = sectionOrder.filter((id) => availableSectionIds.has(id) && !isHidden(id));
		const loadingSections = (
			Object.entries(sectionSlots) as Array<[keyof SectionSlots, SectionSlots[keyof SectionSlots]]>
		)
			.filter(([, status]) => status === "loading" || status === "pending")
			.map(([key]) => key);
		const hasLoading = loadingSections.length > 0;

		return (
			<div className="stats-page-content">
				{hasLoading && (
					<div className="loading-status-banner" role="status" aria-live="polite">
						<span className="loading-status-dot" />
						<span>
							Loading {activeRequestLabel} - waiting on {loadingSections.join(", ")}
						</span>
					</div>
				)}
				{visibleSections.map((id) => {
					const content = renderSectionById(id);
					return content ? (
						<div key={id} data-section-id={id}>
							{content}
						</div>
					) : null;
				})}
			</div>
		);
	};

	const resolvedBanner = useMemo(
		() => resolveAnnouncementBanner(__VERSION__, remoteAnnouncement),
		[remoteAnnouncement],
	);

	useEffect(() => {
		if (!resolvedBanner) return;
		const p = getPreferences();
		if (p.showAnnouncementBanner) return;
		const cur = resolvedBanner.dismissKey;
		const hid = p.announcementBannerHiddenForDismissKey;
		if (cur !== hid) {
			setPreference("showAnnouncementBanner", true);
			setPreference("announcementBannerHiddenForDismissKey", "");
			window.dispatchEvent(new CustomEvent(EVENTS.PREFS_CHANGED));
			handlePrefsChanged();
		}
	}, [resolvedBanner, handlePrefsChanged]);

	const activeBanner = !prefs.showAnnouncementBanner ? null : resolvedBanner;

	const handleDismissBanner = useCallback(() => {
		if (!resolvedBanner) return;
		setPreference("showAnnouncementBanner", false);
		setPreference("announcementBannerHiddenForDismissKey", resolvedBanner.dismissKey);
		window.dispatchEvent(new CustomEvent(EVENTS.PREFS_CHANGED));
		handlePrefsChanged();
	}, [resolvedBanner, handlePrefsChanged]);

	const renderContent = () => {
		if (activePage === "world") {
			return <WorldChartsPage />;
		}
		return renderDashboard();
	};

	return (
		<div className="stats-page" data-version={__VERSION__}>
			{showWizard ? (
				<div className="stats-page-scroll">
					<SetupWizard onComplete={handleWizardComplete} />
				</div>
			) : (
				<div className="stats-page-scroll">
					<div className="stats-page-sticky">
						<FilterPill activeGenre={prefs.activeGenre} onClear={clearActiveGenre} />
						<Header
							providerName={providerName}
							activeProviderId={activeProviderId}
							onSettingsClick={() => openSettings()}
							onShareClick={stats && activePage !== "world" ? () => setShowShare(true) : undefined}
							periods={periodTabsPeriods}
							activePeriod={activePeriodForTabs}
							onPeriodChange={handlePeriodChange}
						/>
					</div>
					{activeBanner && (
						<AnnouncementBanner
							title={activeBanner.title}
							body={activeBanner.body}
							titleOnly={activeBanner.actionOpensChangelog === true}
							actionLabel={activeBanner.actionLabel}
							actionUrl={activeBanner.actionUrl}
							onActionClick={activeBanner.actionOpensChangelog ? () => void openUpdatesModal() : undefined}
							onDismiss={handleDismissBanner}
						/>
					)}
					{renderContent()}
					<AppFooter version={__VERSION__} onCheckForUpdates={() => void openUpdatesModal()} />
				</div>
			)}
			{showSettings && (
				<SettingsModal
					onClose={() => setShowSettings(false)}
					onRefresh={handleRefresh}
					onPrefsChanged={handlePrefsChanged}
					onRestartTour={handleRestartTour}
					onOpenUpdates={() => void openUpdatesModal()}
					onReceiveBetaUpdatesChanged={() => void refreshUpdateCheck()}
					initialTab={settingsInitialTab}
					appVersion={__VERSION__}
					announcementDismissKey={resolvedBanner?.dismissKey ?? null}
				/>
			)}
			<GuidedTour
				active={tourActive && !showWizard}
				version={__VERSION__}
				steps={getTourSteps({
					activePage,
					hasShare: !!stats,
					sectionIds: prefs.sectionOrder.filter((id) => {
						return availableSectionIds.has(id) && !isHidden(id);
					}),
				})}
				onComplete={() => setTourActive(false)}
			/>
			{showShare && stats && (
				<ShareModal stats={stats} activePeriod={activePeriod} onClose={() => setShowShare(false)} />
			)}
			<UpdateModal
				open={showUpdateModal}
				onClose={() => setShowUpdateModal(false)}
				updateInfo={updateCheck}
				appVersion={__VERSION__}
				receiveBetaUpdates={prefs.receiveBetaUpdates}
				onReceiveBetaUpdatesChange={handleReceiveBetaUpdatesChange}
			/>
		</div>
	);
}

export default App;
