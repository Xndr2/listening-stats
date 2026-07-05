import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../shared/api/statsfm-client", () => ({
	sfmGet: vi.fn(),
	sfmCircuitBreaker: {
		isOpen: vi.fn(() => false),
		recordFailure: vi.fn(),
		recordSuccess: vi.fn(),
		reset: vi.fn(),
		getResetAt: vi.fn(() => null),
	},
	validateUsername: vi.fn(),
}));

import { sfmCircuitBreaker, sfmGet, validateUsername } from "../shared/api/statsfm-client";
import { LS_KEYS } from "../shared/constants/storage-keys";
import { StatsFmError } from "../shared/errors";
import { STATSFM_PERIODS, STATSFM_PERIODS_PLUS } from "../shared/stats/periods";
import { statsCache } from "../shared/stats/stats-cache";
import { StatsFmProvider } from "../shared/stats/statsfm-provider";
import type { SfmStreamStats, SfmTopArtist, SfmTopTrack } from "../shared/types/statsfm";

// ─── Mock data factories ───────────────────────────────────────────────────────

function makeSfmTopTrack(overrides: Partial<SfmTopTrack> = {}): SfmTopTrack {
	return {
		position: 1,
		streams: 10,
		track: {
			name: "Test Track",
			durationMs: 200000,
			externalIds: { spotify: ["abc123"] },
			albums: [
				{
					name: "Test Album",
					image: "https://img.test/album.jpg",
					externalIds: { spotify: ["alb1"] },
				},
			],
			artists: [{ name: "Test Artist", externalIds: { spotify: ["art1"] } }],
		},
		...overrides,
	};
}

function makeSfmTopArtist(overrides: Partial<SfmTopArtist> = {}): SfmTopArtist {
	return {
		position: 1,
		streams: 20,
		artist: {
			name: "Test Artist",
			image: "https://img.test/artist.jpg",
			genres: ["pop", "rock"],
			externalIds: { spotify: ["art1"] },
		},
		...overrides,
	};
}

function makeSfmStreamStats(): SfmStreamStats {
	return {
		durationMs: 3600000,
		count: 50,
		cardinality: { tracks: 30, artists: 10, albums: 15 },
	};
}

// ─── Shared test setup ────────────────────────────────────────────────────────

function setupConfig(
	overrides: Partial<{
		username: string;
		isPlus: boolean;
		connectedAt: number;
		lastValidated: number;
	}> = {},
) {
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

function setupSfmGetDispatcher(isPlus = false) {
	sfmGetMock.mockImplementation((path: string, params?: Record<string, string>) => {
		if (path.includes("/top/tracks")) {
			return Promise.resolve({ ok: true, data: [makeSfmTopTrack()] });
		}
		if (path.includes("/top/artists")) {
			// Prior-window fetch includes after/before query params
			const isPrior = params != null && "after" in params && "before" in params;
			if (isPrior) {
				// Prior period returns a DIFFERENT artist URI so the diff yields the current one as new.
				return Promise.resolve({
					ok: true,
					data: [
						makeSfmTopArtist({
							artist: {
								...makeSfmTopArtist().artist,
								externalIds: { spotify: ["spotify:artist:art-prior-1"] },
							},
						}),
					],
				});
			}
			return Promise.resolve({ ok: true, data: [makeSfmTopArtist()] });
		}
		if (path.includes("/top/genres")) {
			return Promise.resolve({
				ok: true,
				data: [{ position: 1, streams: 15, genre: { tag: "pop" } }],
			});
		}
		if (path.includes("/streams/stats/per-day")) {
			return Promise.resolve({
				ok: true,
				data: {
					average: { count: 10, durationMs: 1800000 },
					days: {
						"2026-03-28T00:00:00.000Z": { count: 5, durationMs: 900000 },
						"2026-03-29T00:00:00.000Z": { count: 0, durationMs: 0 },
						"2026-03-30T00:00:00.000Z": { count: 8, durationMs: 1500000 },
						"2026-03-31T00:00:00.000Z": { count: 3, durationMs: 600000 },
					},
				},
			});
		}
		if (path.includes("/streams/stats/dates")) {
			return Promise.resolve({
				ok: true,
				data: {
					hours: { 14: { count: 38, durationMs: 0 }, 15: { count: 20, durationMs: 0 } },
					weekDays: { 1: { count: 45, durationMs: 0 }, 6: { count: 112, durationMs: 0 } },
					months: {},
					years: {},
				},
			});
		}
		if (path.includes("/streams/stats")) {
			return Promise.resolve({ ok: true, data: makeSfmStreamStats() });
		}
		if (path.includes("/streams/recent")) {
			return Promise.resolve({
				ok: true,
				data: [
					{
						endTime: "2026-04-01T13:00:00.000Z",
						platform: "SPOTIFY",
						track: makeSfmTopTrack().track,
					},
				],
			});
		}
		if (path.includes("/top/albums")) {
			if (!isPlus) {
				return Promise.resolve({ ok: false, status: 400, message: "Free tier" });
			}
			return Promise.resolve({
				ok: true,
				data: [
					{
						position: 1,
						streams: 8,
						album: {
							name: "Test Album",
							image: "https://img.test/album.jpg",
							artists: [{ name: "Test Artist" }],
							externalIds: { spotify: ["alb1"] },
						},
					},
				],
			});
		}
		return Promise.resolve({ ok: false, status: 404, message: "Unknown path" });
	});
}

describe("StatsFmProvider", () => {
	let provider: StatsFmProvider;

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-04-01T14:00:00.000Z"));
		provider = new StatsFmProvider();
		localStorage.clear();
		statsCache.invalidate();
		vi.mocked(validateUsername).mockClear();
		sfmGetMock.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("getProviderInfo()", () => {
		it("returns { id: 'statsfm', name: 'stats.fm', description }", () => {
			const info = provider.getProviderInfo();
			expect(info.id).toBe("statsfm");
			expect(info.name).toBe("stats.fm");
			expect(info.description).toBeTypeOf("string");
			expect(info.description.length).toBeGreaterThan(0);
		});
	});

	describe("getSupportedPeriods()", () => {
		it("returns STATSFM_PERIODS (3 items) when config is null (no init yet)", () => {
			const periods = provider.getSupportedPeriods();
			expect(periods).toHaveLength(3);
			expect(periods).toBe(STATSFM_PERIODS);
		});

		it("returns STATSFM_PERIODS (3 items) when config.isPlus is false", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			const periods = provider.getSupportedPeriods();
			expect(periods).toHaveLength(3);
			expect(periods).toBe(STATSFM_PERIODS);
		});

		it("returns STATSFM_PERIODS_PLUS (4 items) when config.isPlus is true", async () => {
			setupConfig({ isPlus: true });
			await provider.init();
			const periods = provider.getSupportedPeriods();
			expect(periods).toHaveLength(4);
			expect(periods).toBe(STATSFM_PERIODS_PLUS);
		});
	});

	describe("init()", () => {
		it("with no localStorage config is a no-op (this.config remains null)", async () => {
			// No config in localStorage  -  init should be silent
			await provider.init();
			// getSupportedPeriods returns STATSFM_PERIODS (free, 3 items)  -  config is null
			expect(provider.getSupportedPeriods()).toHaveLength(3);
		});

		it("loads StatsFmConfig from localStorage.getItem(LS_KEYS.STATSFM_CONFIG) via JSON.parse", async () => {
			const _config = setupConfig({ isPlus: true });
			await provider.init();
			// Provider should have picked up the config
			const periods = provider.getSupportedPeriods();
			expect(periods).toHaveLength(4); // isPlus=true means PLUS periods
			expect(periods).toBe(STATSFM_PERIODS_PLUS);
		});

		it("with lastValidated older than 24h calls validateUsername and updates isPlus + lastValidated", async () => {
			vi.mocked(validateUsername).mockResolvedValue({
				valid: true,
				isPlus: true,
				displayName: "Test",
			});
			const now = Date.now();
			setupConfig({ isPlus: false, lastValidated: now - 25 * 60 * 60 * 1000 }); // 25 hours ago

			await provider.init();

			expect(validateUsername).toHaveBeenCalledWith("testuser");
			// isPlus should be updated to true from the validation result
			expect(provider.getSupportedPeriods()).toHaveLength(4);
			// localStorage should be updated with new isPlus and lastValidated
			const stored = JSON.parse(localStorage.getItem(LS_KEYS.STATSFM_CONFIG)!);
			expect(stored.isPlus).toBe(true);
			expect(stored.lastValidated).toBe(now); // Date.now() at call time
		});

		it("with lastValidated within 24h does NOT call validateUsername", async () => {
			setupConfig({ isPlus: false, lastValidated: Date.now() - 1 * 60 * 60 * 1000 }); // 1 hour ago
			await provider.init();
			expect(validateUsername).not.toHaveBeenCalled();
		});

		it("when validateUsername returns { valid: false } keeps existing isPlus value (graceful degradation)", async () => {
			vi.mocked(validateUsername).mockResolvedValue({ valid: false, reason: "network" });
			const now = Date.now();
			setupConfig({ isPlus: true, lastValidated: now - 25 * 60 * 60 * 1000 }); // 25 hours ago

			await provider.init();

			expect(validateUsername).toHaveBeenCalled();
			// isPlus should remain true (graceful degradation  -  keep existing value)
			expect(provider.getSupportedPeriods()).toHaveLength(4);
			// localStorage isPlus should still be true
			const stored = JSON.parse(localStorage.getItem(LS_KEYS.STATSFM_CONFIG)!);
			expect(stored.isPlus).toBe(true);
		});
	});

	describe("destroy()", () => {
		it("calls statsCache.invalidate()", () => {
			const spy = vi.spyOn(statsCache, "invalidate");
			provider.destroy();
			expect(spy).toHaveBeenCalled();
			spy.mockRestore();
		});
	});

	describe("calculateStats()", () => {
		it("throws Error when config is null (provider not configured)", async () => {
			const period = STATSFM_PERIODS[0];
			await expect(provider.calculateStats(period)).rejects.toThrow("StatsFmProvider not configured");
		});

		it("calls sfmGet for /top/tracks, /top/artists, /top/genres, /streams/stats, /streams/recent", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);

			await provider.calculateStats(STATSFM_PERIODS[0]);

			const paths = sfmGetMock.mock.calls.map((c) => c[0]);
			expect(paths.some((p) => p.includes("/top/tracks"))).toBe(true);
			expect(paths.some((p) => p.includes("/top/artists"))).toBe(true);
			expect(paths.some((p) => p.includes("/top/genres"))).toBe(true);
			expect(paths.some((p) => p.includes("/streams/stats"))).toBe(true);
			expect(paths.some((p) => p.includes("/streams/recent"))).toBe(true);
		});

		it("passes named range parameter for bounded periods (not after/before timestamps)", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);

			const period = STATSFM_PERIODS[0]; // sfm-weeks

			await provider.calculateStats(period);

			// All calls should use range param, not after/before
			const callWithRange = sfmGetMock.mock.calls.find((c) => c[1] && "range" in (c[1] as Record<string, string>));
			expect(callWithRange).toBeDefined();
			const params = callWithRange?.[1] as Record<string, string>;
			expect(params.range).toBe("weeks");
			// Ensure no after/before params
			expect(params).not.toHaveProperty("after");
			expect(params).not.toHaveProperty("before");
		});

		it("passes { range: 'lifetime' } for sfm-all-time period instead of after/before", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);

			const allTimePeriod = STATSFM_PERIODS[2]; // sfm-all-time
			await provider.calculateStats(allTimePeriod);

			const callWithRange = sfmGetMock.mock.calls.find((c) => c[1] && "range" in (c[1] as Record<string, string>));
			expect(callWithRange).toBeDefined();
			const params = callWithRange?.[1] as Record<string, string>;
			expect(params.range).toBe("lifetime");
			expect(params.after).toBeUndefined();
			expect(params.before).toBeUndefined();
		});

		it("returns topTracks with correct mapping (rank from position, trackUri from externalIds.spotify[0])", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);

			const result = await provider.calculateStats(STATSFM_PERIODS[0]);

			expect(result.topTracks).toHaveLength(1);
			const track = result.topTracks[0];
			expect(track.rank).toBe(1);
			expect(track.trackUri).toBe("spotify:track:abc123");
			expect(track.trackName).toBe("Test Track");
			expect(track.artistName).toBe("Test Artist");
			expect(track.albumName).toBe("Test Album");
			expect(track.count).toBe(10);
		});

		it("returns synthetic fallback URI when externalIds.spotify is undefined", async () => {
			setupConfig({ isPlus: false });
			await provider.init();

			sfmGetMock.mockImplementation((path: string) => {
				if (path.includes("/top/tracks")) {
					const t = makeSfmTopTrack();
					t.track.externalIds = { spotify: undefined };
					return Promise.resolve({ ok: true, data: [t] });
				}
				if (path.includes("/top/artists")) return Promise.resolve({ ok: true, data: [makeSfmTopArtist()] });
				if (path.includes("/top/genres")) return Promise.resolve({ ok: true, data: [] });
				if (path.includes("/streams/stats")) return Promise.resolve({ ok: true, data: makeSfmStreamStats() });
				if (path.includes("/streams/recent")) return Promise.resolve({ ok: true, data: [] });
				return Promise.resolve({ ok: false, status: 0, message: "skipped" });
			});

			const result = await provider.calculateStats(STATSFM_PERIODS[0]);
			expect(result.topTracks[0].trackUri).toMatch(/^listening-stats:track:/);
		});

		it("returns topArtists with genres from artist.genres[] and imageUrl from artist.image", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);

			const result = await provider.calculateStats(STATSFM_PERIODS[0]);

			expect(result.topArtists).toHaveLength(1);
			const artist = result.topArtists[0];
			expect(artist.genres).toEqual(["pop", "rock"]);
			expect(artist.imageUrl).toBe("https://img.test/artist.jpg");
			expect(artist.artistName).toBe("Test Artist");
		});

		it("returns hourlyDistribution populated from /dates, not all zeros", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);

			const result = await provider.calculateStats(STATSFM_PERIODS[0]);

			expect(result.hourlyDistribution).toHaveLength(24);
			expect(result.hourlyDistribution[14]).toBe(38);
			expect(result.skipRate).toBe(0);
		});

		it("returns totalPlays, totalDuration, uniqueTrackCount, uniqueArtistCount from SfmStreamStats", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);

			const result = await provider.calculateStats(STATSFM_PERIODS[0]);

			expect(result.totalPlays).toBe(50);
			expect(result.totalDuration).toBe(3600000);
			expect(result.uniqueTrackCount).toBe(30);
			expect(result.uniqueArtistCount).toBe(10);
		});

		it("returns recentPlays with playedAt from new Date(endTime).getTime()", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);

			const result = await provider.calculateStats(STATSFM_PERIODS[0]);

			expect(result.recentPlays).toHaveLength(1);
			const recent = result.recentPlays[0];
			expect(recent.playedAt).toBe(new Date("2026-04-01T13:00:00.000Z").getTime());
			expect(recent.trackName).toBe("Test Track");
		});

		it("caches result in statsCache; second call returns cache without calling sfmGet again", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);

			const period = STATSFM_PERIODS[0];
			await provider.calculateStats(period);
			const firstCallCount = sfmGetMock.mock.calls.length;

			// Second call  -  should hit cache
			await provider.calculateStats(period);
			expect(sfmGetMock.mock.calls.length).toBe(firstCallCount); // No additional calls
		});

		it("free tier (isPlus=false): sfmGet is NOT called with /top/albums path", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);

			await provider.calculateStats(STATSFM_PERIODS[0]);

			const albumCalls = sfmGetMock.mock.calls.filter((c) => c[0].includes("/top/albums"));
			expect(albumCalls).toHaveLength(0);
		});

		it("free tier derived albums: groups tracks by album name, sums streams, sorts descending", async () => {
			setupConfig({ isPlus: false });
			await provider.init();

			// 3 tracks: 2 share "Shared Album", 1 is "Solo Album"
			const track1 = makeSfmTopTrack({ position: 1, streams: 5 });
			track1.track.albums[0].name = "Shared Album";

			const track2 = makeSfmTopTrack({ position: 2, streams: 7 });
			track2.track.albums[0].name = "Shared Album";

			const track3 = makeSfmTopTrack({ position: 3, streams: 15 });
			track3.track.albums[0].name = "Solo Album";

			sfmGetMock.mockImplementation((path: string) => {
				if (path.includes("/top/tracks")) return Promise.resolve({ ok: true, data: [track1, track2, track3] });
				if (path.includes("/top/artists")) return Promise.resolve({ ok: true, data: [makeSfmTopArtist()] });
				if (path.includes("/top/genres")) return Promise.resolve({ ok: true, data: [] });
				if (path.includes("/streams/stats")) return Promise.resolve({ ok: true, data: makeSfmStreamStats() });
				if (path.includes("/streams/recent")) return Promise.resolve({ ok: true, data: [] });
				return Promise.resolve({ ok: false, status: 0, message: "skipped" });
			});

			const result = await provider.calculateStats(STATSFM_PERIODS[0]);

			expect(result.topAlbums).toHaveLength(2);
			// Solo Album (15 streams) should rank #1, Shared Album (5+7=12) should rank #2
			expect(result.topAlbums[0].albumName).toBe("Solo Album");
			expect(result.topAlbums[0].count).toBe(15);
			expect(result.topAlbums[0].rank).toBe(1);
			expect(result.topAlbums[1].albumName).toBe("Shared Album");
			expect(result.topAlbums[1].count).toBe(12);
			expect(result.topAlbums[1].rank).toBe(2);
		});

		it("Plus tier (isPlus=true): sfmGet IS called with /top/albums; topAlbums mapped from SfmTopAlbum", async () => {
			setupConfig({ isPlus: true });
			await provider.init();
			setupSfmGetDispatcher(true);

			const result = await provider.calculateStats(STATSFM_PERIODS[0]);

			const albumCalls = sfmGetMock.mock.calls.filter((c) => c[0].includes("/top/albums"));
			expect(albumCalls).toHaveLength(1);

			expect(result.topAlbums).toHaveLength(1);
			expect(result.topAlbums[0].albumName).toBe("Test Album");
			expect(result.topAlbums[0].albumUri).toBe("spotify:album:alb1");
			expect(result.topAlbums[0].count).toBe(8);
		});

		it("aggregates topGenres from SfmTopArtist.artist.genres[] weighted by streams, sorted descending", async () => {
			setupConfig({ isPlus: false });
			await provider.init();

			// Two artists: artist1 has genres [pop, rock] with 20 streams, artist2 has genres [pop, jazz] with 10 streams
			const artist1 = makeSfmTopArtist({ position: 1, streams: 20 });
			artist1.artist.genres = ["pop", "rock"];

			const artist2 = makeSfmTopArtist({ position: 2, streams: 10 });
			artist2.artist.name = "Another Artist";
			artist2.artist.genres = ["pop", "jazz"];

			sfmGetMock.mockImplementation((path: string) => {
				if (path.includes("/top/tracks")) return Promise.resolve({ ok: true, data: [makeSfmTopTrack()] });
				if (path.includes("/top/artists")) return Promise.resolve({ ok: true, data: [artist1, artist2] });
				if (path.includes("/top/genres")) return Promise.resolve({ ok: true, data: [] });
				if (path.includes("/streams/stats")) return Promise.resolve({ ok: true, data: makeSfmStreamStats() });
				if (path.includes("/streams/recent")) return Promise.resolve({ ok: true, data: [] });
				return Promise.resolve({ ok: false, status: 0, message: "skipped" });
			});

			const result = await provider.calculateStats(STATSFM_PERIODS[0]);

			// pop: 20+10=30, rock: 20, jazz: 10
			expect(result.topGenres[0].genre).toBe("pop");
			expect(result.topGenres[0].count).toBe(30);
			expect(result.topGenres[1].genre).toBe("rock");
			expect(result.topGenres[1].count).toBe(20);
			expect(result.topGenres[2].genre).toBe("jazz");
			expect(result.topGenres[2].count).toBe(10);
		});

		it("Spicetify.CosmosAsync is NOT called during calculateStats (PROV-09)", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);

			await provider.calculateStats(STATSFM_PERIODS[0]);

			expect(Spicetify.CosmosAsync.request).not.toHaveBeenCalled();
		});

		it("prefixes bare externalIds.spotify[0] with spotify:track: for trackUri", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);
			const result = await provider.calculateStats(STATSFM_PERIODS[0]);
			// Mock uses bare "abc123", provider should prefix it
			expect(result.topTracks[0].trackUri).toBe("spotify:track:abc123");
			expect(result.topTracks[0].artistUri).toBe("spotify:artist:art1");
		});

		it("prefixes bare externalIds.spotify[0] with spotify:track: for recentPlays trackUri", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);
			const result = await provider.calculateStats(STATSFM_PERIODS[0]);
			expect(result.recentPlays[0].trackUri).toBe("spotify:track:abc123");
		});

		it("when sfmGet returns { ok: false } for all critical endpoints, throws StatsFmError", async () => {
			setupConfig({ isPlus: false });
			await provider.init();

			sfmGetMock.mockImplementation((path: string) => {
				if (path.includes("/top/tracks")) return Promise.resolve({ ok: false, status: 500, message: "error" });
				if (path.includes("/top/artists")) return Promise.resolve({ ok: false, status: 500, message: "error" });
				if (path.includes("/top/genres")) return Promise.resolve({ ok: false, status: 500, message: "error" });
				if (path.includes("/streams/stats")) return Promise.resolve({ ok: false, status: 500, message: "error" });
				if (path.includes("/streams/recent")) return Promise.resolve({ ok: false, status: 500, message: "error" });
				return Promise.resolve({ ok: false, status: 0, message: "skipped" });
			});

			await expect(provider.calculateStats(STATSFM_PERIODS[0])).rejects.toThrow(StatsFmError);
		});

		it("calculateStats returns listeningDays counted from per-day stats (days with count > 0)", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);

			const result = await provider.calculateStats(STATSFM_PERIODS[0]);

			// Mock has 4 days total, 3 with count > 0
			expect(result.listeningDays).toBe(3);
		});

		it("populates hourlyDistribution from /dates hours map (not all zeros)", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);
			const result = await provider.calculateStats(STATSFM_PERIODS[0]);
			expect(result.hourlyDistribution[14]).toBe(38);
			expect(result.hourlyDistribution[15]).toBe(20);
			expect(result.hourlyDistribution[0]).toBe(0); // untouched hours stay zero
		});

		it("populates weekdayDistribution with 1-indexed API keys mapped to 0-indexed array", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);
			const result = await provider.calculateStats(STATSFM_PERIODS[0]);
			expect(result.weekdayDistribution).toHaveLength(7);
			expect(result.weekdayDistribution?.[0]).toBe(45); // API key 1 (Monday) -> index 0
			expect(result.weekdayDistribution?.[5]).toBe(112); // API key 6 (Saturday) -> index 5
			expect(result.weekdayDistribution?.[6]).toBe(0); // Sunday not in mock -> 0
		});

		it("sets peakHour from hourlyDistribution max and peakWeekday from weekdayDistribution max", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);
			const result = await provider.calculateStats(STATSFM_PERIODS[0]);
			expect(result.peakHour).toBe(14); // hour 14 has 38 > hour 15 has 20
			expect(result.peakWeekday).toBe(5); // Saturday (index 5) has 112 > Monday (index 0) has 45
		});

		it("sets weekdayDistribution=undefined and zeroed hourly data when /dates fails", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			sfmGetMock.mockImplementation((path: string) => {
				if (path.includes("/streams/stats/dates")) {
					return Promise.resolve({ ok: false, status: 403, message: "Plus required" });
				}
				// Delegate to default dispatcher for other paths
				if (path.includes("/top/tracks")) return Promise.resolve({ ok: true, data: [makeSfmTopTrack()] });
				if (path.includes("/top/artists")) return Promise.resolve({ ok: true, data: [makeSfmTopArtist()] });
				if (path.includes("/top/genres"))
					return Promise.resolve({
						ok: true,
						data: [{ position: 1, streams: 15, genre: { tag: "pop" } }],
					});
				if (path.includes("/streams/stats/per-day"))
					return Promise.resolve({
						ok: true,
						data: {
							average: { count: 10, durationMs: 1800000 },
							days: { "2026-03-28T00:00:00.000Z": { count: 5, durationMs: 900000 } },
						},
					});
				if (path.includes("/streams/stats")) return Promise.resolve({ ok: true, data: makeSfmStreamStats() });
				if (path.includes("/streams/recent"))
					return Promise.resolve({
						ok: true,
						data: [
							{
								endTime: "2026-04-01T13:00:00.000Z",
								platform: "SPOTIFY",
								track: makeSfmTopTrack().track,
							},
						],
					});
				if (path.includes("/top/albums")) return Promise.resolve({ ok: false, status: 400, message: "Free tier" });
				return Promise.resolve({ ok: false, status: 404, message: "Unknown path" });
			});
			const result = await provider.calculateStats(STATSFM_PERIODS[0]);
			expect(result.weekdayDistribution).toBeUndefined();
			expect(result.hourlyDistribution).toEqual(new Array(24).fill(0));
			expect(result.peakHour).toBe(0);
		});

		it("calculateStats result includes streak computed from per-day data", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			setupSfmGetDispatcher(false);

			const result = await provider.calculateStats(STATSFM_PERIODS[0]);

			expect(result.streak).toBe(2);
		});

		it("requests prior-window /top/artists and derives newArtistCount from Spotify URI diff", async () => {
			setupConfig();
			setupSfmGetDispatcher();
			await provider.init();

			// Pick a bounded period (NOT sfm-all-time)
			const boundedPeriod = STATSFM_PERIODS.find((p) => p.id !== "sfm-all-time")!;
			const result = await provider.calculateStats(boundedPeriod);

			// Assert the prior call was made with the right params shape
			expect(sfmGetMock).toHaveBeenCalledWith(
				expect.stringContaining("/top/artists"),
				expect.objectContaining({
					after: expect.any(String),
					before: expect.any(String),
					limit: "200",
				}),
			);

			// Current default artist's spotify URI ("art1") != prior's "spotify:artist:art-prior-1" → diff = 1
			expect(result.newArtistCount).toBe(1);
		});

		it("skips prior-period call for sfm-all-time", async () => {
			setupConfig();
			setupSfmGetDispatcher();
			await provider.init();

			const allTime = STATSFM_PERIODS.find((p) => p.id === "sfm-all-time")!;
			const result = await provider.calculateStats(allTime);

			// No /top/artists call should have been made with after/before params
			const allCalls = sfmGetMock.mock.calls.filter(([path]) => String(path).includes("/top/artists"));
			const priorCalls = allCalls.filter(([_, params]) => params && "after" in params && "before" in params);
			expect(priorCalls.length).toBe(0);

			expect(result.newArtistCount).toBe(0);
			expect(result.priorPeriodTotalDuration).toBeUndefined();
		});
	});

	describe("statsfmProvider singleton", () => {
		it("statsfmProvider is a StatsFmProvider instance", async () => {
			const { statsfmProvider } = await import("../shared/stats/statsfm-provider");
			expect(statsfmProvider).toBeInstanceOf(StatsFmProvider);
		});
	});

	describe("StatsFmProvider capabilities", () => {
		beforeEach(() => {
			localStorage.clear();
		});

		afterEach(() => {
			localStorage.clear();
		});

		it("returns free-tier capabilities when config is null (not connected)", async () => {
			// No config in localStorage  -  init() leaves this.config null
			await provider.init();
			const info = provider.getProviderInfo();
			expect(info.capabilities.hasActivityData).toBe(true);
			expect(info.capabilities.hasGenreData).toBe(true);
			expect(info.capabilities.hasStreakData).toBe(false);
			expect(info.capabilities.hasSkipRate).toBe(false);
			expect(info.capabilities.tier).toBe("free");
		});

		it("returns free-tier capabilities when config.isPlus === false", async () => {
			localStorage.setItem(
				LS_KEYS.STATSFM_CONFIG,
				JSON.stringify({
					username: "tester",
					isPlus: false,
					connectedAt: Date.now(),
					lastValidated: Date.now(),
				}),
			);
			await provider.init();
			const info = provider.getProviderInfo();
			expect(info.capabilities.hasActivityData).toBe(true);
			expect(info.capabilities.hasGenreData).toBe(true);
			expect(info.capabilities.hasStreakData).toBe(false);
			expect(info.capabilities.hasSkipRate).toBe(false);
			expect(info.capabilities.tier).toBe("free");
		});

		it("returns plus-tier capabilities when config.isPlus === true", async () => {
			localStorage.setItem(
				LS_KEYS.STATSFM_CONFIG,
				JSON.stringify({
					username: "tester",
					isPlus: true,
					connectedAt: Date.now(),
					lastValidated: Date.now(),
				}),
			);
			await provider.init();
			const info = provider.getProviderInfo();
			expect(info.capabilities.hasActivityData).toBe(true);
			expect(info.capabilities.hasGenreData).toBe(true);
			expect(info.capabilities.hasStreakData).toBe(false);
			expect(info.capabilities.hasSkipRate).toBe(false);
			expect(info.capabilities.tier).toBe("plus");
		});

		it("hasStreakData is always false regardless of tier (stats.fm has no streak endpoint)", async () => {
			// Free
			await provider.init();
			expect(provider.getProviderInfo().capabilities.hasStreakData).toBe(false);
			// Plus
			localStorage.setItem(
				LS_KEYS.STATSFM_CONFIG,
				JSON.stringify({
					username: "tester",
					isPlus: true,
					connectedAt: Date.now(),
					lastValidated: Date.now(),
				}),
			);
			await provider.init();
			expect(provider.getProviderInfo().capabilities.hasStreakData).toBe(false);
		});
	});

	describe("bulk failure error classification", () => {
		it("throws StatsFmError with UserNotFound when all critical endpoints return 404", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			sfmGetMock.mockResolvedValue({ ok: false, status: 404, message: "HTTP 404" });

			await expect(provider.calculateStats(STATSFM_PERIODS[0])).rejects.toThrow(StatsFmError);

			try {
				await provider.calculateStats(STATSFM_PERIODS[0]);
			} catch (e) {
				expect(e).toBeInstanceOf(StatsFmError);
				expect((e as StatsFmError).appError.variant).toBe("UserNotFound");
			}
		});

		it("throws StatsFmError with NetworkError when all critical endpoints fail with status 0", async () => {
			expect.assertions(3);
			setupConfig({ isPlus: false });
			await provider.init();
			sfmGetMock.mockResolvedValue({ ok: false, status: 0, message: "TypeError: Failed to fetch" });

			try {
				await provider.calculateStats(STATSFM_PERIODS[0]);
			} catch (e) {
				expect(e).toBeInstanceOf(StatsFmError);
				expect((e as StatsFmError).appError.variant).toBe("NetworkError");
				expect((e as StatsFmError).appError.retryable).toBe(true);
			}
		});

		it("throws StatsFmError with RateLimited when circuit is open and includes resetAt", async () => {
			expect.assertions(3);
			setupConfig({ isPlus: false });
			await provider.init();
			const resetTimestamp = Date.now() + 30_000;
			vi.mocked(sfmCircuitBreaker.getResetAt).mockReturnValue(resetTimestamp);
			sfmGetMock.mockResolvedValue({
				ok: false,
				status: 0,
				message: "Circuit open  -  stats.fm temporarily unavailable",
			});

			try {
				await provider.calculateStats(STATSFM_PERIODS[0]);
			} catch (e) {
				expect(e).toBeInstanceOf(StatsFmError);
				expect((e as StatsFmError).appError.variant).toBe("RateLimited");
				expect((e as StatsFmError).appError.resetAt).toBe(resetTimestamp);
			}
		});

		it("throws StatsFmError with ServiceDown for HTTP 500 bulk failure", async () => {
			expect.assertions(2);
			setupConfig({ isPlus: false });
			await provider.init();
			sfmGetMock.mockResolvedValue({ ok: false, status: 500, message: "HTTP 500" });

			try {
				await provider.calculateStats(STATSFM_PERIODS[0]);
			} catch (e) {
				expect(e).toBeInstanceOf(StatsFmError);
				expect((e as StatsFmError).appError.variant).toBe("ServiceDown");
			}
		});

		it("does NOT throw when only some endpoints fail (partial success)", async () => {
			setupConfig({ isPlus: false });
			await provider.init();
			sfmGetMock.mockImplementation((path: string) => {
				if (path.includes("/top/genres")) {
					return Promise.resolve({ ok: false, status: 500, message: "HTTP 500" });
				}
				if (path.includes("/top/tracks")) return Promise.resolve({ ok: true, data: [makeSfmTopTrack()] });
				if (path.includes("/top/artists")) return Promise.resolve({ ok: true, data: [makeSfmTopArtist()] });
				if (path.includes("/streams/stats/per-day"))
					return Promise.resolve({
						ok: true,
						data: { average: { count: 0, durationMs: 0 }, days: {} },
					});
				if (path.includes("/streams/stats/dates"))
					return Promise.resolve({
						ok: true,
						data: { hours: {}, weekDays: {}, months: {}, years: {} },
					});
				if (path.includes("/streams/stats")) return Promise.resolve({ ok: true, data: makeSfmStreamStats() });
				if (path.includes("/streams/recent")) return Promise.resolve({ ok: true, data: [] });
				return Promise.resolve({ ok: false, status: 0, message: "skipped" });
			});

			const result = await provider.calculateStats(STATSFM_PERIODS[0]);
			expect(result.topTracks).toHaveLength(1);
			expect(result.recentPlays).toEqual([]);
		});
	});
});
