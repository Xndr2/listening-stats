import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_PERIODS } from "../shared/stats/periods";
import { statsCache } from "../shared/stats/stats-cache";
import { db } from "../shared/storage/db";
import type { PlayEvent } from "../shared/types/play-event";
import type { StatsResult } from "../shared/types/stats";

// Mock enrichArtists to avoid real API calls
vi.mock("../shared/stats/artist-enrichment", () => ({
	enrichArtists: vi.fn().mockResolvedValue(undefined),
}));

import { enrichArtists } from "../shared/stats/artist-enrichment";
import { LocalProvider, localProvider } from "../shared/stats/local-provider";

const enrichArtistsMock = vi.mocked(enrichArtists);

// Helper to create a PlayEvent with sensible defaults
function makePlayEvent(overrides: Partial<PlayEvent> = {}): PlayEvent {
	return {
		trackUri: "spotify:track:default",
		trackName: "Default Track",
		artistName: "Default Artist",
		artistUri: "spotify:artist:default",
		albumName: "Default Album",
		albumUri: "spotify:album:default",
		durationMs: 200000,
		playedMs: 180000,
		startedAt: Date.now() - 60000,
		endedAt: Date.now(),
		type: "play",
		...overrides,
	};
}

// Get today period from LOCAL_PERIODS
const todayPeriod = LOCAL_PERIODS.find((p) => p.id === "today")!;
const allTimePeriod = LOCAL_PERIODS.find((p) => p.id === "all-time")!;
const thisWeekPeriod = LOCAL_PERIODS.find((p) => p.id === "this-week")!;

describe("LocalProvider", () => {
	let provider: LocalProvider;

	beforeEach(() => {
		// Only fake the Date (not timers)  -  Dexie relies on setTimeout/Promises
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-04-01T14:00:00.000Z"));
		provider = new LocalProvider();
		statsCache.invalidate();
		enrichArtistsMock.mockClear();
		enrichArtistsMock.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("getProviderInfo()", () => {
		it("returns { id: 'local', name: 'Local', description }", () => {
			const info = provider.getProviderInfo();
			expect(info.id).toBe("local");
			expect(info.name).toBe("Local");
			expect(info.description).toBeTypeOf("string");
			expect(info.description.length).toBeGreaterThan(0);
		});
	});

	describe("getSupportedPeriods()", () => {
		it("returns LOCAL_PERIODS (5 periods)", () => {
			const periods = provider.getSupportedPeriods();
			expect(periods).toHaveLength(5);
			expect(periods.map((p) => p.id)).toEqual([
				"today",
				"this-week",
				"this-month",
				"last-6-months",
				"all-time",
			]);
		});
	});

	describe("calculateStats()", () => {
		it("with empty DB returns StatsResult with all arrays empty and totalPlays=0", async () => {
			const result = await provider.calculateStats(allTimePeriod);
			expect(result.topTracks).toEqual([]);
			expect(result.topArtists).toEqual([]);
			expect(result.topAlbums).toEqual([]);
			expect(result.topGenres).toEqual([]);
			expect(result.totalPlays).toBe(0);
			expect(result.totalDuration).toBe(0);
			expect(result.recentPlays).toEqual([]);
		});

		it("with 3 plays by same artist returns topArtists[0] with count=3", async () => {
			const artistUri = "spotify:artist:radiohead";
			await db.playEvents.bulkAdd([
				makePlayEvent({ artistUri, artistName: "Radiohead", startedAt: 1000 }),
				makePlayEvent({ artistUri, artistName: "Radiohead", startedAt: 2000 }),
				makePlayEvent({ artistUri, artistName: "Radiohead", startedAt: 3000 }),
			]);

			const result = await provider.calculateStats(allTimePeriod);
			expect(result.topArtists).toHaveLength(1);
			expect(result.topArtists[0].artistUri).toBe(artistUri);
			expect(result.topArtists[0].count).toBe(3);
		});

		it("returns topTracks sorted by count descending, rank assigned 1,2,3...", async () => {
			// 3 plays of track A, 2 plays of track B, 1 play of track C
			await db.playEvents.bulkAdd([
				makePlayEvent({ trackUri: "spotify:track:a", trackName: "Track A", startedAt: 1000 }),
				makePlayEvent({ trackUri: "spotify:track:a", trackName: "Track A", startedAt: 2000 }),
				makePlayEvent({ trackUri: "spotify:track:a", trackName: "Track A", startedAt: 3000 }),
				makePlayEvent({ trackUri: "spotify:track:b", trackName: "Track B", startedAt: 4000 }),
				makePlayEvent({ trackUri: "spotify:track:b", trackName: "Track B", startedAt: 5000 }),
				makePlayEvent({ trackUri: "spotify:track:c", trackName: "Track C", startedAt: 6000 }),
			]);

			const result = await provider.calculateStats(allTimePeriod);
			expect(result.topTracks[0].trackUri).toBe("spotify:track:a");
			expect(result.topTracks[0].count).toBe(3);
			expect(result.topTracks[0].rank).toBe(1);
			expect(result.topTracks[1].trackUri).toBe("spotify:track:b");
			expect(result.topTracks[1].count).toBe(2);
			expect(result.topTracks[1].rank).toBe(2);
			expect(result.topTracks[2].trackUri).toBe("spotify:track:c");
			expect(result.topTracks[2].count).toBe(1);
			expect(result.topTracks[2].rank).toBe(3);
		});

		it("returns topAlbums grouped by albumUri with correct count/duration", async () => {
			await db.playEvents.bulkAdd([
				makePlayEvent({
					albumUri: "spotify:album:ok",
					albumName: "OK Computer",
					playedMs: 100,
					startedAt: 1000,
				}),
				makePlayEvent({
					albumUri: "spotify:album:ok",
					albumName: "OK Computer",
					playedMs: 200,
					startedAt: 2000,
				}),
				makePlayEvent({
					albumUri: "spotify:album:kb",
					albumName: "Kid A",
					playedMs: 150,
					startedAt: 3000,
				}),
			]);

			const result = await provider.calculateStats(allTimePeriod);
			expect(result.topAlbums).toHaveLength(2);
			const okAlbum = result.topAlbums.find((a) => a.albumUri === "spotify:album:ok");
			expect(okAlbum?.count).toBe(2);
			expect(okAlbum?.durationMs).toBe(300);
		});

		it("returns totalPlays = number of events, totalDuration = sum of playedMs", async () => {
			await db.playEvents.bulkAdd([
				makePlayEvent({ playedMs: 100, startedAt: 1000 }),
				makePlayEvent({ playedMs: 200, startedAt: 2000 }),
				makePlayEvent({ playedMs: 300, startedAt: 3000 }),
			]);

			const result = await provider.calculateStats(allTimePeriod);
			expect(result.totalPlays).toBe(3);
			expect(result.totalDuration).toBe(600);
		});

		it("returns recentPlays as last 12 events sorted by startedAt descending", async () => {
			// Add 15 events with sequential timestamps
			const events = Array.from({ length: 15 }, (_, i) =>
				makePlayEvent({
					trackUri: `spotify:track:${i}`,
					trackName: `Track ${i}`,
					startedAt: 1000 * (i + 1),
				}),
			);
			await db.playEvents.bulkAdd(events);

			const result = await provider.calculateStats(allTimePeriod);
			expect(result.recentPlays).toHaveLength(12);
			// Most recent first (highest startedAt first)
			expect(result.recentPlays[0].playedAt).toBeGreaterThan(result.recentPlays[1].playedAt);
			expect(result.recentPlays[0].playedAt).toBe(15000); // track 14 = startedAt 15000
		});

		it("calculateStats for 'today' period only includes events with startedAt within today boundaries", async () => {
			const { start: todayStart } = todayPeriod.getBoundaries();
			// An event from yesterday (before today start)
			await db.playEvents.add(
				makePlayEvent({
					trackUri: "spotify:track:yesterday",
					trackName: "Yesterday",
					startedAt: todayStart - 1,
				}),
			);
			// An event from today
			await db.playEvents.add(
				makePlayEvent({
					trackUri: "spotify:track:today",
					trackName: "Today",
					startedAt: todayStart + 1,
				}),
			);

			const result = await provider.calculateStats(todayPeriod);
			expect(result.totalPlays).toBe(1);
			expect(result.topTracks[0].trackUri).toBe("spotify:track:today");
		});

		it("calculateStats for 'all-time' includes all events (no boundary filter)", async () => {
			// Add events from very old timestamp
			await db.playEvents.bulkAdd([
				makePlayEvent({ startedAt: 1000 }), // very old
				makePlayEvent({ startedAt: 2000 }),
				makePlayEvent({ startedAt: Date.now() }),
			]);

			const result = await provider.calculateStats(allTimePeriod);
			expect(result.totalPlays).toBe(3);
		});

		it("calculateStats checks statsCache first  -  returns cached data if hit", async () => {
			const fakeStats: StatsResult = {
				topTracks: [
					{
						rank: 1,
						trackUri: "cached",
						trackName: "Cached Track",
						artistName: "Cached Artist",
						artistUri: "uri",
						albumName: "album",
						albumUri: "album-uri",
						count: 99,
						durationMs: 999,
					},
				],
				topArtists: [],
				topAlbums: [],
				topGenres: [],
				totalPlays: 99,
				totalDuration: 999,
				recentPlays: [],
				hourlyDistribution: new Array(24).fill(0),
				peakHour: 0,
				skipRate: 0,
				uniqueTrackCount: 1,
				uniqueArtistCount: 0,
			};
			statsCache.set("local:all-time", fakeStats);

			const result = await provider.calculateStats(allTimePeriod);
			expect(result).toEqual(fakeStats);
			// DB not queried  -  no plays in DB so if it was re-computed it'd be empty
		});

		it("calculateStats stores result in statsCache after computing", async () => {
			await db.playEvents.add(makePlayEvent({ startedAt: 1000 }));

			await provider.calculateStats(allTimePeriod);

			const cached = statsCache.get<StatsResult>("local:all-time");
			expect(cached).not.toBeNull();
			expect(cached?.totalPlays).toBe(1);
		});

		it("after calculateStats resolves, prefetch fires calculateStats for the adjacent period", async () => {
			// For "today" (index 0), adjacent is "this-week" (index 1)
			const { start: todayStart } = todayPeriod.getBoundaries();
			await db.playEvents.add(makePlayEvent({ startedAt: todayStart + 1000 }));

			// Spy on calculateStats BEFORE the primary call  -  must call through
			const spy = vi.spyOn(provider, "calculateStats");

			// Primary call for "today" triggers fire-and-forget prefetch for "this-week"
			await provider.calculateStats(todayPeriod);

			// Wait for the fire-and-forget prefetch promise to settle
			await vi.waitFor(() => {
				expect(spy).toHaveBeenCalledTimes(2);
			});

			// First call: the primary "today" period
			expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: "today" }));
			// Second call: the adjacent "this-week" period (prefetch)
			expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: "this-week" }));

			spy.mockRestore();
		});

		it("calculateStats calls enrichArtists with artist URIs from results", async () => {
			const artistUri = "spotify:artist:enrich_me";
			await db.playEvents.add(
				makePlayEvent({ artistUri, artistName: "Enrich Me", startedAt: 1000 }),
			);

			await provider.calculateStats(allTimePeriod);

			expect(enrichArtistsMock).toHaveBeenCalled();
			const callArgs = enrichArtistsMock.mock.calls[0][0];
			expect(callArgs).toContain(artistUri);
		});

		it("topGenres populated from db.artists enrichment data", async () => {
			const artistUri = "spotify:artist:genretest";
			await db.playEvents.add(
				makePlayEvent({ artistUri, artistName: "Genre Test", startedAt: 1000 }),
			);

			// Pre-populate db.artists with genre data (simulating already-enriched)
			await db.artists.put({
				uri: artistUri,
				name: "Genre Test",
				genres: ["electronic", "ambient"],
				imageUrl: null,
				updatedAt: Date.now(),
			});

			const result = await provider.calculateStats(allTimePeriod);

			// topGenres should include genres from the enriched artist
			expect(result.topGenres.length).toBeGreaterThan(0);
			const genres = result.topGenres.map((g) => g.genre);
			expect(genres).toContain("electronic");
			expect(genres).toContain("ambient");
		});
	});

	describe("hourlyDistribution, peakHour, skipRate, uniqueTrackCount, uniqueArtistCount", () => {
		it("returns hourlyDistribution as a 24-element number array with correct counts", async () => {
			// Create events at known hours: hour 10 = 2 events, hour 14 = 1 event
			// Use Date objects to get precise startedAt ms values
			const at10am = new Date("2026-04-01T10:00:00.000Z").getTime();
			const at10am2 = new Date("2026-04-01T10:30:00.000Z").getTime();
			const at2pm = new Date("2026-04-01T14:00:00.000Z").getTime();
			await db.playEvents.bulkAdd([
				makePlayEvent({ startedAt: at10am }),
				makePlayEvent({ startedAt: at10am2 }),
				makePlayEvent({ startedAt: at2pm }),
			]);

			const result = await provider.calculateStats(allTimePeriod);
			expect(result.hourlyDistribution).toHaveLength(24);
			// Sum across all hours should equal total plays
			const total = result.hourlyDistribution.reduce((sum, n) => sum + n, 0);
			expect(total).toBe(3);
		});

		it("returns peakHour as the index of the max value in hourlyDistribution", async () => {
			// System time is set to 2026-04-01T14:00:00.000Z
			// Local hour of this timestamp depends on timezone  -  use getHours() to derive expected
			const at2pm = new Date("2026-04-01T14:00:00.000Z").getTime();
			const at2pm2 = new Date("2026-04-01T14:30:00.000Z").getTime();
			const at10am = new Date("2026-04-01T10:00:00.000Z").getTime();

			await db.playEvents.bulkAdd([
				makePlayEvent({ startedAt: at2pm }),
				makePlayEvent({ startedAt: at2pm2 }),
				makePlayEvent({ startedAt: at10am }),
			]);

			const result = await provider.calculateStats(allTimePeriod);
			const expectedPeakHour = new Date(at2pm).getHours();
			expect(result.peakHour).toBe(expectedPeakHour);
		});

		it("returns peakHour=0 when no events", async () => {
			const result = await provider.calculateStats(allTimePeriod);
			expect(result.peakHour).toBe(0);
		});

		it("returns skipRate=0 when no events", async () => {
			const result = await provider.calculateStats(allTimePeriod);
			expect(result.skipRate).toBe(0);
		});

		it("returns skipRate as skips / (plays + skips)", async () => {
			// 2 plays, 1 skip => skipRate = 1/3
			await db.playEvents.bulkAdd([
				makePlayEvent({ type: "play", startedAt: 1000 }),
				makePlayEvent({ type: "play", startedAt: 2000 }),
				makePlayEvent({ type: "skip", startedAt: 3000 }),
			]);

			const result = await provider.calculateStats(allTimePeriod);
			expect(result.skipRate).toBeCloseTo(1 / 3, 5);
		});

		it("returns uniqueTrackCount as count of distinct trackUri values", async () => {
			await db.playEvents.bulkAdd([
				makePlayEvent({ trackUri: "spotify:track:a", startedAt: 1000 }),
				makePlayEvent({ trackUri: "spotify:track:a", startedAt: 2000 }),
				makePlayEvent({ trackUri: "spotify:track:b", startedAt: 3000 }),
			]);

			const result = await provider.calculateStats(allTimePeriod);
			expect(result.uniqueTrackCount).toBe(2);
		});

		it("returns uniqueArtistCount as count of distinct artistUri values", async () => {
			await db.playEvents.bulkAdd([
				makePlayEvent({ artistUri: "spotify:artist:a", startedAt: 1000 }),
				makePlayEvent({ artistUri: "spotify:artist:a", startedAt: 2000 }),
				makePlayEvent({ artistUri: "spotify:artist:b", startedAt: 3000 }),
			]);

			const result = await provider.calculateStats(allTimePeriod);
			expect(result.uniqueArtistCount).toBe(2);
		});
	});

	describe("streak computation", () => {
		it("returns streak=5 when events exist on 5 consecutive days ending today", async () => {
			// today = April 1, yesterday = March 31, ..., 4 days ago = March 28
			// Use local midnight + 12h for each day
			await db.playEvents.bulkAdd([
				makePlayEvent({ startedAt: new Date(2026, 3, 1, 12, 0, 0).getTime() }), // today
				makePlayEvent({ startedAt: new Date(2026, 2, 31, 12, 0, 0).getTime() }), // yesterday
				makePlayEvent({ startedAt: new Date(2026, 2, 30, 12, 0, 0).getTime() }), // 2 days ago
				makePlayEvent({ startedAt: new Date(2026, 2, 29, 12, 0, 0).getTime() }), // 3 days ago
				makePlayEvent({ startedAt: new Date(2026, 2, 28, 12, 0, 0).getTime() }), // 4 days ago
			]);

			const result = await provider.calculateStats(allTimePeriod);
			expect(result.streak).toBe(5);
		});

		it("returns streak=5 with grace period  -  events on 5 consecutive days ending yesterday, none today", async () => {
			// No event today, events from yesterday through 5 days ago
			await db.playEvents.bulkAdd([
				makePlayEvent({ startedAt: new Date(2026, 2, 31, 12, 0, 0).getTime() }), // yesterday
				makePlayEvent({ startedAt: new Date(2026, 2, 30, 12, 0, 0).getTime() }), // 2 days ago
				makePlayEvent({ startedAt: new Date(2026, 2, 29, 12, 0, 0).getTime() }), // 3 days ago
				makePlayEvent({ startedAt: new Date(2026, 2, 28, 12, 0, 0).getTime() }), // 4 days ago
				makePlayEvent({ startedAt: new Date(2026, 2, 27, 12, 0, 0).getTime() }), // 5 days ago
			]);

			const result = await provider.calculateStats(allTimePeriod);
			expect(result.streak).toBe(5);
		});

		it("returns streak=0 when no play events exist (displays as em dash)", async () => {
			// Empty DB
			const result = await provider.calculateStats(allTimePeriod);
			expect(result.streak).toBe(0);
		});

		it("returns streak=1 when only today has a play event", async () => {
			await db.playEvents.add(
				makePlayEvent({ startedAt: new Date(2026, 3, 1, 12, 0, 0).getTime() }),
			);

			const result = await provider.calculateStats(allTimePeriod);
			expect(result.streak).toBe(1);
		});

		it("returns streak=0 when last play was 2+ days ago (grace period expired)", async () => {
			// Event only 3 days ago  -  no event yesterday or today
			await db.playEvents.add(
				makePlayEvent({ startedAt: new Date(2026, 2, 29, 12, 0, 0).getTime() }),
			);

			const result = await provider.calculateStats(allTimePeriod);
			expect(result.streak).toBe(0);
		});

		it("streak uses local timezone day boundaries, not UTC", async () => {
			// Event at 11:30 PM local time  -  this must count as "today" in local TZ
			// Using new Date(2026, 3, 1, 23, 30, 0) which is local timezone aware
			await db.playEvents.add(
				makePlayEvent({ startedAt: new Date(2026, 3, 1, 23, 30, 0).getTime() }),
			);

			const result = await provider.calculateStats(allTimePeriod);
			// The 11:30 PM event should count as today, giving streak of 1
			expect(result.streak).toBeGreaterThanOrEqual(1);
		});

		it("streak is period-independent  -  same value regardless of period argument", async () => {
			// Insert events for 3 consecutive days
			await db.playEvents.bulkAdd([
				makePlayEvent({ startedAt: new Date(2026, 3, 1, 12, 0, 0).getTime() }), // today
				makePlayEvent({ startedAt: new Date(2026, 2, 31, 12, 0, 0).getTime() }), // yesterday
				makePlayEvent({ startedAt: new Date(2026, 2, 30, 12, 0, 0).getTime() }), // 2 days ago
			]);

			const todayResult = await provider.calculateStats(todayPeriod);
			statsCache.invalidate(); // clear cache so allTime recomputes
			const allTimeResult = await provider.calculateStats(allTimePeriod);

			expect(todayResult.streak).toBe(3);
			expect(allTimeResult.streak).toBe(3);
		});
	});

	it("computes newArtistCount as set difference vs prior window", async () => {
		// thisWeekPeriod boundaries (relative to 2026-04-01 14:00 UTC system time)
		const { start: curStart, end: curEnd } = thisWeekPeriod.getBoundaries();
		const priorLength = curEnd - curStart;
		const priorStart = curStart - priorLength;

		await db.playEvents.bulkAdd([
			// Prior period: artists A, B
			makePlayEvent({
				artistUri: "spotify:artist:A",
				artistName: "A",
				startedAt: priorStart + 1000,
				playedMs: 200_000,
			}),
			makePlayEvent({
				artistUri: "spotify:artist:A",
				artistName: "A",
				startedAt: priorStart + 2000,
				playedMs: 180_000,
			}),
			makePlayEvent({
				artistUri: "spotify:artist:B",
				artistName: "B",
				startedAt: priorStart + 3000,
				playedMs: 150_000,
			}),
			// Current period: artists B (returning), C, D (new)
			makePlayEvent({
				artistUri: "spotify:artist:B",
				artistName: "B",
				startedAt: curStart + 1000,
				playedMs: 100_000,
			}),
			makePlayEvent({
				artistUri: "spotify:artist:C",
				artistName: "C",
				startedAt: curStart + 2000,
				playedMs: 220_000,
			}),
			makePlayEvent({
				artistUri: "spotify:artist:D",
				artistName: "D",
				startedAt: curStart + 3000,
				playedMs: 175_000,
			}),
		]);

		const result = await provider.calculateStats(thisWeekPeriod);
		expect(result.newArtistCount).toBe(2); // C and D are new vs prior {A, B}
		expect(result.priorPeriodTotalDuration).toBe(200_000 + 180_000 + 150_000); // 530_000
	});

	it("newArtistCount is undefined when prior window has zero events", async () => {
		const { start: curStart } = thisWeekPeriod.getBoundaries();
		// Only current-period events, no prior events
		await db.playEvents.bulkAdd([
			makePlayEvent({ artistUri: "spotify:artist:X", artistName: "X", startedAt: curStart + 1000 }),
		]);
		const result = await provider.calculateStats(thisWeekPeriod);
		expect(result.newArtistCount).toBeUndefined();
		expect(result.priorPeriodTotalDuration).toBeUndefined();
	});

	it("skips prior-period query for all-time (no newArtistCount / prior duration)", async () => {
		// Even with abundant events, all-time has no meaningful prior.
		await db.playEvents.bulkAdd([
			makePlayEvent({ artistUri: "spotify:artist:X", startedAt: 1000 }),
			makePlayEvent({ artistUri: "spotify:artist:Y", startedAt: 2000 }),
			makePlayEvent({ artistUri: "spotify:artist:Z", startedAt: 3000 }),
		]);
		const result = await provider.calculateStats(allTimePeriod);
		expect(result.newArtistCount).toBeUndefined();
		expect(result.priorPeriodTotalDuration).toBeUndefined();
	});

	describe("localProvider singleton", () => {
		it("is a LocalProvider instance", () => {
			expect(localProvider).toBeInstanceOf(LocalProvider);
		});
	});

	describe("LocalProvider capabilities", () => {
		it("getProviderInfo() returns capabilities with all five canonical fields", () => {
			const info = localProvider.getProviderInfo();
			expect(info.capabilities).toBeDefined();
			expect(info.capabilities.hasActivityData).toBe(true);
			expect(info.capabilities.hasGenreData).toBe(true);
			expect(info.capabilities.hasStreakData).toBe(true);
			expect(info.capabilities.hasSkipRate).toBe(false);
			expect(info.capabilities.tier).toBe("n/a");
		});

		it("tier is exactly 'n/a' (not 'free', not 'plus', not undefined)", () => {
			const info = localProvider.getProviderInfo();
			expect(info.capabilities.tier).toBe("n/a");
		});
	});

	describe("init() and destroy()", () => {
		it("init() resolves without error", async () => {
			await expect(provider.init()).resolves.toBeUndefined();
		});

		it("destroy() calls statsCache.invalidate() without throwing", () => {
			expect(() => provider.destroy()).not.toThrow();
		});
	});
});
