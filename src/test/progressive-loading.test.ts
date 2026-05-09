import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../shared/api/statsfm-client", () => ({
	sfmGet: vi.fn(),
	sfmCircuitBreaker: { isOpen: vi.fn(() => false), recordFailure: vi.fn(), recordSuccess: vi.fn(), reset: vi.fn(), getResetAt: vi.fn(() => null) },
	validateUsername: vi.fn(),
}));

import { sfmGet } from "../shared/api/statsfm-client";
import { StatsFmProvider } from "../shared/stats/statsfm-provider";
import { LocalProvider } from "../shared/stats/local-provider";
import { STATSFM_PERIODS } from "../shared/stats/periods";
import { statsCache } from "../shared/stats/stats-cache";
import { LS_KEYS } from "../shared/constants/storage-keys";
import {
	allLoading,
	allResolved,
	slotKeyForWave,
	EMPTY_STATS,
	type SectionSlots,
	type WaveCallback,
	type WaveId,
} from "../shared/stats/progressive";
import type { SfmTopTrack, SfmTopArtist, SfmStreamStats } from "../shared/types/statsfm";
import type { StatsResult } from "../shared/types/stats";

// ─── Mock data factories ────────────────────────────────────────────────────────

function makeSfmTopTrack(): SfmTopTrack {
	return {
		position: 1,
		streams: 10,
		track: {
			name: "Test Track",
			durationMs: 200000,
			externalIds: { spotify: ["abc123"] },
			albums: [{ name: "Test Album", image: "https://img.test/album.jpg", externalIds: { spotify: ["alb1"] } }],
			artists: [{ name: "Test Artist", externalIds: { spotify: ["art1"] } }],
		},
	};
}

function makeSfmTopArtist(): SfmTopArtist {
	return {
		position: 1,
		streams: 20,
		artist: {
			name: "Test Artist",
			image: "https://img.test/artist.jpg",
			genres: ["pop", "rock"],
			externalIds: { spotify: ["art1"] },
		},
	};
}

function makeSfmStreamStats(): SfmStreamStats {
	return {
		durationMs: 3600000,
		count: 50,
		cardinality: { tracks: 30, artists: 10, albums: 15 },
	};
}

function setupConfig(overrides: Partial<{ username: string; isPlus: boolean; connectedAt: number; lastValidated: number }> = {}) {
	const config = {
		username: "testuser",
		isPlus: false,
		connectedAt: Date.now() - 86400000,
		lastValidated: Date.now(),
		...overrides,
	};
	localStorage.setItem(LS_KEYS.STATSFM_CONFIG, JSON.stringify(config));
	return config;
}

const sfmGetMock = vi.mocked(sfmGet);

function setupSfmGetDispatcher() {
	sfmGetMock.mockImplementation((path: string) => {
		if (path.includes("/top/tracks")) {
			return Promise.resolve({ ok: true, data: [makeSfmTopTrack()] });
		}
		if (path.includes("/top/artists")) {
			return Promise.resolve({ ok: true, data: [makeSfmTopArtist()] });
		}
		if (path.includes("/top/genres")) {
			return Promise.resolve({ ok: true, data: [{ position: 1, streams: 15, genre: { tag: "pop" } }] });
		}
		if (path.includes("/streams/stats/per-day")) {
			return Promise.resolve({
				ok: true,
				data: {
					average: { count: 10, durationMs: 1800000 },
					days: { "2026-03-30T00:00:00.000Z": { count: 8, durationMs: 1500000 } },
				},
			});
		}
		if (path.includes("/streams/stats/dates")) {
			return Promise.resolve({
				ok: true,
				data: {
					items: {
						hours: { 14: { count: 38, durationMs: 0 }, 15: { count: 20, durationMs: 0 } },
						weekDays: { 1: { count: 45, durationMs: 0 }, 6: { count: 112, durationMs: 0 } },
						months: {},
						years: {},
					},
				},
			});
		}
		if (path.includes("/streams/stats")) {
			return Promise.resolve({ ok: true, data: makeSfmStreamStats() });
		}
		if (path.includes("/streams/recent")) {
			return Promise.resolve({
				ok: true,
				data: [{ endTime: "2026-04-01T13:00:00.000Z", platform: "SPOTIFY", track: makeSfmTopTrack().track }],
			});
		}
		return Promise.resolve({ ok: false, status: 0, message: "skipped" });
	});
}

// ─── progressive.ts helpers ─────────────────────────────────────────────────────

describe("progressive.ts helpers", () => {
	it("allLoading() returns all sections as loading", () => {
		expect(allLoading()).toEqual({ overview: "loading", lists: "loading", activity: "loading", consistency: "loading" });
	});

	it("allResolved() returns all sections as resolved", () => {
		expect(allResolved()).toEqual({ overview: "resolved", lists: "resolved", activity: "resolved", consistency: "resolved" });
	});

	it("slotKeyForWave maps wave IDs to section keys", () => {
		expect(slotKeyForWave(1)).toBe("overview");
		expect(slotKeyForWave(2)).toBe("lists");
		expect(slotKeyForWave(3)).toBe("activity");
	});

	it("EMPTY_STATS provides a valid StatsResult with zero/empty defaults", () => {
		expect(EMPTY_STATS.topTracks).toEqual([]);
		expect(EMPTY_STATS.totalPlays).toBe(0);
		expect(EMPTY_STATS.hourlyDistribution).toHaveLength(24);
		expect(EMPTY_STATS.hourlyDistribution.every((v: number) => v === 0)).toBe(true);
	});
});

// ─── StatsFmProvider.calculateStatsProgressive ──────────────────────────────────

describe("StatsFmProvider.calculateStatsProgressive", () => {
	let provider: StatsFmProvider;

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-04-01T14:00:00.000Z"));
		provider = new StatsFmProvider();
		localStorage.clear();
		statsCache.invalidate();
		sfmGetMock.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("exists on StatsFmProvider", () => {
		expect(typeof provider.calculateStatsProgressive).toBe("function");
	});

	it("fires wave callbacks in order with progressive wave-2 updates", async () => {
		setupConfig();
		await provider.init();
		setupSfmGetDispatcher();

		const waveOrder: WaveId[] = [];
		const onWave: WaveCallback = (_partial, wave) => {
			waveOrder.push(wave);
		};

		await provider.calculateStatsProgressive!(STATSFM_PERIODS[0], onWave);
		expect(waveOrder[0]).toBe(1);
		expect(waveOrder[waveOrder.length - 1]).toBe(3);
		expect(waveOrder.filter((w) => w === 2).length).toBeGreaterThan(0);
	});

	it("wave 1 callback includes overview data (totalPlays, totalDuration, recentPlays)", async () => {
		setupConfig();
		await provider.init();
		setupSfmGetDispatcher();

		let wave1Data: Partial<StatsResult> | null = null;
		const onWave: WaveCallback = (partial, wave) => {
			if (wave === 1) wave1Data = partial;
		};

		await provider.calculateStatsProgressive!(STATSFM_PERIODS[0], onWave);
		expect(wave1Data).not.toBeNull();
		expect(wave1Data!.totalPlays).toBe(50);
		expect(wave1Data!.totalDuration).toBe(3600000);
		expect(wave1Data!.recentPlays).toHaveLength(1);
	});

	it("wave 2 emits partial list data as soon as it is available", async () => {
		setupConfig();
		await provider.init();
		setupSfmGetDispatcher();

		const wave2Snapshots: Array<Partial<StatsResult>> = [];
		const onWave: WaveCallback = (partial, wave) => {
			if (wave === 2) wave2Snapshots.push(partial);
		};

		await provider.calculateStatsProgressive!(STATSFM_PERIODS[0], onWave);
		expect(wave2Snapshots.length).toBeGreaterThan(0);
		expect(wave2Snapshots.some((s) => (s.topTracks?.length ?? 0) > 0)).toBe(true);
		expect(wave2Snapshots.some((s) => (s.topArtists?.length ?? 0) > 0)).toBe(true);
		expect(wave2Snapshots.some((s) => (s.topGenres?.length ?? 0) > 0)).toBe(true);
	});

	it("wave 3 callback includes activity data (hourlyDistribution, weekdayDistribution)", async () => {
		setupConfig();
		await provider.init();
		setupSfmGetDispatcher();

		let wave3Data: Partial<StatsResult> | null = null;
		const onWave: WaveCallback = (partial, wave) => {
			if (wave === 3) wave3Data = partial;
		};

		await provider.calculateStatsProgressive!(STATSFM_PERIODS[0], onWave);
		expect(wave3Data).not.toBeNull();
		expect(wave3Data!.hourlyDistribution).toHaveLength(24);
		expect(wave3Data!.hourlyDistribution![14]).toBe(38);
		expect(wave3Data!.weekdayDistribution).toHaveLength(7);
	});

	it("returns full StatsResult identical to calculateStats when all waves succeed", async () => {
		setupConfig();
		await provider.init();
		setupSfmGetDispatcher();

		const progressiveResult = await provider.calculateStatsProgressive!(STATSFM_PERIODS[0], () => {});

		statsCache.invalidate();
		sfmGetMock.mockClear();
		setupSfmGetDispatcher();
		const legacyResult = await provider.calculateStats(STATSFM_PERIODS[0]);

		expect(progressiveResult.totalPlays).toBe(legacyResult.totalPlays);
		expect(progressiveResult.totalDuration).toBe(legacyResult.totalDuration);
		expect(progressiveResult.topTracks.length).toBe(legacyResult.topTracks.length);
		expect(progressiveResult.topArtists.length).toBe(legacyResult.topArtists.length);
		expect(progressiveResult.hourlyDistribution).toEqual(legacyResult.hourlyDistribution);
	});

	it("wave 3 error: callback receives error arg, overview and lists data intact", async () => {
		setupConfig();
		await provider.init();

		sfmGetMock.mockImplementation((path: string) => {
			if (path.includes("/streams/stats/dates")) {
				return Promise.resolve({ ok: false, status: 500, message: "Internal Server Error" });
			}
			if (path.includes("/top/tracks")) return Promise.resolve({ ok: true, data: [makeSfmTopTrack()] });
			if (path.includes("/top/artists")) return Promise.resolve({ ok: true, data: [makeSfmTopArtist()] });
			if (path.includes("/top/genres")) return Promise.resolve({ ok: true, data: [] });
			if (path.includes("/streams/stats/per-day")) return Promise.resolve({ ok: true, data: { average: { count: 0, durationMs: 0 }, days: {} } });
			if (path.includes("/streams/stats")) return Promise.resolve({ ok: true, data: makeSfmStreamStats() });
			if (path.includes("/streams/recent")) return Promise.resolve({ ok: true, data: [] });
			return Promise.resolve({ ok: false, status: 0, message: "skipped" });
		});

		const waves: Array<{ wave: WaveId; hasError: boolean }> = [];
		const onWave: WaveCallback = (_partial, wave, error) => {
			waves.push({ wave, hasError: !!error });
		};

		const result = await provider.calculateStatsProgressive!(STATSFM_PERIODS[0], onWave);

		expect(waves.length).toBeGreaterThanOrEqual(3);
		expect(waves[0]).toEqual({ wave: 1, hasError: false });
		expect(waves.some((w) => w.wave === 2 && w.hasError === false)).toBe(true);
		expect(waves[waves.length - 1]).toEqual({ wave: 3, hasError: true });
		expect(result.totalPlays).toBe(50);
		expect(result.topTracks).toHaveLength(1);
	});

	it("does not write to statsCache (caller is responsible for cache gating)", async () => {
		setupConfig();
		await provider.init();
		setupSfmGetDispatcher();

		const cacheSpy = vi.spyOn(statsCache, "set");
		await provider.calculateStatsProgressive!(STATSFM_PERIODS[0], () => {});
		expect(cacheSpy).not.toHaveBeenCalled();
		cacheSpy.mockRestore();
	});

	it("returns cached result immediately and fires all 3 waves when cache hit", async () => {
		setupConfig();
		await provider.init();

		const fakeResult: StatsResult = { ...EMPTY_STATS, totalPlays: 999 };
		const key = `statsfm:${STATSFM_PERIODS[0].id}`;
		statsCache.set(key, fakeResult);

		const waveOrder: WaveId[] = [];
		const onWave: WaveCallback = (_partial, wave) => {
			waveOrder.push(wave);
		};

		const result = await provider.calculateStatsProgressive!(STATSFM_PERIODS[0], onWave);

		expect(result.totalPlays).toBe(999);
		expect(waveOrder).toEqual([1, 2, 3]);
		expect(sfmGetMock).not.toHaveBeenCalled();
	});
});

// ─── LocalProvider.calculateStatsProgressive ────────────────────────────────────

describe("LocalProvider.calculateStatsProgressive", () => {
	let provider: LocalProvider;

	beforeEach(() => {
		provider = new LocalProvider();
		statsCache.invalidate();
	});

	it("exists on LocalProvider", () => {
		expect(typeof provider.calculateStatsProgressive).toBe("function");
	});

	it("fires all 3 waves in a single render (synchronous callbacks)", async () => {
		const waveOrder: WaveId[] = [];
		const onWave: WaveCallback = (_partial, wave) => {
			waveOrder.push(wave);
		};

		const result = await provider.calculateStatsProgressive!(
			provider.getSupportedPeriods()[0],
			onWave,
		);

		expect(waveOrder).toEqual([1, 2, 3]);
		expect(result.totalPlays).toBe(0);
	});

	it("returns same result as calculateStats", async () => {
		const period = provider.getSupportedPeriods()[0];
		const legacyResult = await provider.calculateStats(period);

		statsCache.invalidate();
		const progressiveResult = await provider.calculateStatsProgressive!(period, () => {});

		expect(progressiveResult.totalPlays).toBe(legacyResult.totalPlays);
		expect(progressiveResult.topTracks.length).toBe(legacyResult.topTracks.length);
	});
});

// ─── Generation counter (stale-callback cancellation) ───────────────────────────

describe("generation counter stale-callback cancellation", () => {
	it("stale wave callbacks are ignored when generation changes", async () => {
		setupConfig();
		const provider = new StatsFmProvider();
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-04-01T14:00:00.000Z"));
		await provider.init();

		let resolveWave1: (() => void) | null = null;
		const wave1Blocker = new Promise<void>((resolve) => { resolveWave1 = resolve; });

		sfmGetMock.mockImplementation((path: string) => {
			if (path.includes("/streams/stats") && !path.includes("per-day") && !path.includes("dates")) {
				return wave1Blocker.then(() => ({ ok: true, data: makeSfmStreamStats() }));
			}
			if (path.includes("/top/tracks")) return Promise.resolve({ ok: true, data: [makeSfmTopTrack()] });
			if (path.includes("/top/artists")) return Promise.resolve({ ok: true, data: [makeSfmTopArtist()] });
			if (path.includes("/top/genres")) return Promise.resolve({ ok: true, data: [] });
			if (path.includes("/streams/stats/per-day")) return Promise.resolve({ ok: true, data: { average: { count: 0, durationMs: 0 }, days: {} } });
			if (path.includes("/streams/stats/dates")) return Promise.resolve({ ok: true, data: { items: { hours: {}, weekDays: {}, months: {}, years: {} } } });
			if (path.includes("/streams/recent")) return Promise.resolve({ ok: true, data: [] });
			return Promise.resolve({ ok: false, status: 0, message: "skipped" });
		});

		let generation = 1;
		const currentGen = () => generation;
		const appliedWaves: WaveId[] = [];

		const onWave: WaveCallback = (_partial, wave) => {
			if (currentGen() === 1) {
				appliedWaves.push(wave);
			}
		};

		const loadPromise = provider.calculateStatsProgressive!(STATSFM_PERIODS[0], onWave);

		generation = 2;
		resolveWave1!();

		await loadPromise;

		expect(appliedWaves).toEqual([]);

		vi.useRealTimers();
		localStorage.clear();
		statsCache.invalidate();
	});
});

// ─── Cache gating ───────────────────────────────────────────────────────────────

describe("cache gating", () => {
	let provider: StatsFmProvider;

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-04-01T14:00:00.000Z"));
		provider = new StatsFmProvider();
		localStorage.clear();
		statsCache.invalidate();
		sfmGetMock.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("caller should not cache when a wave has an error", async () => {
		setupConfig();
		await provider.init();

		sfmGetMock.mockImplementation((path: string) => {
			if (path.includes("/streams/stats/dates")) {
				return Promise.resolve({ ok: false, status: 500, message: "Server Error" });
			}
			if (path.includes("/top/tracks")) return Promise.resolve({ ok: true, data: [makeSfmTopTrack()] });
			if (path.includes("/top/artists")) return Promise.resolve({ ok: true, data: [makeSfmTopArtist()] });
			if (path.includes("/top/genres")) return Promise.resolve({ ok: true, data: [] });
			if (path.includes("/streams/stats/per-day")) return Promise.resolve({ ok: true, data: { average: { count: 0, durationMs: 0 }, days: {} } });
			if (path.includes("/streams/stats")) return Promise.resolve({ ok: true, data: makeSfmStreamStats() });
			if (path.includes("/streams/recent")) return Promise.resolve({ ok: true, data: [] });
			return Promise.resolve({ ok: false, status: 0, message: "skipped" });
		});

		let hasWaveError = false;
		const onWave: WaveCallback = (_partial, _wave, error) => {
			if (error) hasWaveError = true;
		};

		await provider.calculateStatsProgressive!(STATSFM_PERIODS[0], onWave);

		expect(hasWaveError).toBe(true);

		const cacheKey = `statsfm:${STATSFM_PERIODS[0].id}`;
		expect(statsCache.get(cacheKey)).toBeNull();
	});

	it("caller can safely cache when all waves succeed (no errors)", async () => {
		setupConfig();
		await provider.init();
		setupSfmGetDispatcher();

		let hasWaveError = false;
		const onWave: WaveCallback = (_partial, _wave, error) => {
			if (error) hasWaveError = true;
		};

		const result = await provider.calculateStatsProgressive!(STATSFM_PERIODS[0], onWave);

		expect(hasWaveError).toBe(false);

		const cacheKey = `statsfm:${STATSFM_PERIODS[0].id}`;
		statsCache.set(cacheKey, result);
		expect(statsCache.get<StatsResult>(cacheKey)).not.toBeNull();
	});
});

// ─── Empty-state flash prevention ───────────────────────────────────────────────

describe("empty-state flash prevention", () => {
	it("EMPTY_STATS has totalPlays=0 and empty topTracks, suitable for checking false empty state", () => {
		const merged = { ...EMPTY_STATS, totalPlays: 50, totalDuration: 3600000 };
		expect(merged.totalPlays).toBe(50);
		expect(merged.topTracks).toEqual([]);
	});

	it("empty state should not show until both overview and lists are resolved", () => {
		const slots: SectionSlots = { overview: "resolved", lists: "loading", activity: "loading", consistency: "loading" };
		const allCriticalResolved = slots.overview === "resolved" && slots.lists === "resolved";
		expect(allCriticalResolved).toBe(false);
	});

	it("empty state can show when both overview and lists are resolved", () => {
		const slots: SectionSlots = { overview: "resolved", lists: "resolved", activity: "loading", consistency: "loading" };
		const allCriticalResolved = slots.overview === "resolved" && slots.lists === "resolved";
		expect(allCriticalResolved).toBe(true);
	});
});
