import type { AppError } from "../../shared/errors";
import { ClassifiedError, classifyHttpError } from "../../shared/errors";
import {
	allLoading,
	allResolved,
	EMPTY_STATS,
	type SectionSlots,
	slotKeyForWave,
} from "../../shared/stats/progressive";
import { providerRegistry } from "../../shared/stats/provider";
import { getRankMode } from "../../shared/stats/rank-mode";
import { statsCache } from "../../shared/stats/stats-cache";
import type { Period, StatsResult } from "../../shared/types/stats";

const { useState, useCallback, useRef } = Spicetify.React;

export function buildCacheKey(activeProviderId: string, periodId: string): string {
	// Local results depend on the rank mode; keying on it matches LocalProvider's
	// internal cache key exactly, so both layers share one entry per mode.
	if (activeProviderId === "local") return `local:${periodId}:${getRankMode()}`;
	return `${activeProviderId}:${periodId}`;
}

export interface ListColumnLoading {
	tracks: boolean;
	artists: boolean;
	albums: boolean;
}

/**
 * Dashboard stats loading: progressive waves, per-section slots/errors and the
 * stats cache. Owns every piece of state that loadStats mutates.
 */
export function useStatsLoader() {
	const [stats, setStats] = useState<StatsResult | null>(null);
	const [sectionSlots, setSectionSlots] = useState<SectionSlots>(allLoading());
	const [listColumnLoading, setListColumnLoading] = useState<ListColumnLoading>({
		tracks: true,
		artists: true,
		albums: true,
	});
	const [sectionErrors, setSectionErrors] = useState<Record<string, AppError | null>>({});
	const [activeRequestLabel, setActiveRequestLabel] = useState<string>("");
	const generationRef = useRef(0);

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
				e instanceof ClassifiedError
					? e.appError
					: classifyHttpError(0, e instanceof Error ? e.message : "Failed to load stats");
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

	return { stats, sectionSlots, listColumnLoading, sectionErrors, activeRequestLabel, loadStats };
}
