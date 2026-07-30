/**
 * TDD tests for src/shared/types/stats.ts
 * These tests verify the shape and exports of the stats type module.
 */
import { describe, expect, it } from "vitest";

// Import everything we need to verify
import type {
	ApiError,
	ArtistRecord,
	Period,
	PeriodBoundaries,
	RecentPlay,
	Result,
	StatsResult,
	TopAlbum,
	TopArtist,
	TopGenre,
	TopTrack,
} from "../shared/types/stats";

describe("stats.ts type exports", () => {
	describe("StatsResult", () => {
		it("has all required fields: topTracks, topArtists, topAlbums, topGenres, totalPlays, totalDuration, recentPlays", () => {
			const result: StatsResult = {
				topTracks: [],
				topArtists: [],
				topAlbums: [],
				topGenres: [],
				totalPlays: 0,
				totalDuration: 0,
				recentPlays: [],
				hourlyDistribution: Array(24).fill(0),
				peakHour: 0,
				skipRate: 0,
				uniqueTrackCount: 0,
				uniqueArtistCount: 0,
			};
			expect(result).toBeDefined();
			expect(Array.isArray(result.topTracks)).toBe(true);
			expect(Array.isArray(result.topArtists)).toBe(true);
			expect(Array.isArray(result.topAlbums)).toBe(true);
			expect(Array.isArray(result.topGenres)).toBe(true);
			expect(typeof result.totalPlays).toBe("number");
			expect(typeof result.totalDuration).toBe("number");
			expect(Array.isArray(result.recentPlays)).toBe(true);
		});
	});

	describe("ArtistRecord", () => {
		it("has uri, name, genres, imageUrl, updatedAt fields", () => {
			const artist: ArtistRecord = {
				uri: "spotify:artist:abc",
				name: "Test Artist",
				genres: ["pop", "rock"],
				imageUrl: "https://example.com/img.jpg",
				updatedAt: Date.now(),
			};
			expect(artist.uri).toBe("spotify:artist:abc");
			expect(artist.name).toBe("Test Artist");
			expect(Array.isArray(artist.genres)).toBe(true);
			expect(typeof artist.updatedAt).toBe("number");
		});

		it("allows null imageUrl", () => {
			const artist: ArtistRecord = {
				uri: "spotify:artist:abc",
				name: "No Image Artist",
				genres: [],
				imageUrl: null,
				updatedAt: Date.now(),
			};
			expect(artist.imageUrl).toBeNull();
		});
	});

	describe("Period", () => {
		it("has id, label, getBoundaries() returning {start: number, end: number}", () => {
			const now = Date.now();
			const period: Period = {
				id: "today",
				label: "Today",
				getBoundaries: () => ({ start: now - 86400000, end: now }),
			};
			expect(period.id).toBe("today");
			expect(period.label).toBe("Today");
			const boundaries: PeriodBoundaries = period.getBoundaries();
			expect(typeof boundaries.start).toBe("number");
			expect(typeof boundaries.end).toBe("number");
			expect(boundaries.end).toBeGreaterThan(boundaries.start);
		});
	});

	describe("Result<T, E> discriminated union", () => {
		it("ok:true variant has data field", () => {
			const ok: Result<string, never> = { ok: true, data: "hello" };
			expect(ok.ok).toBe(true);
			if (ok.ok) {
				expect(ok.data).toBe("hello");
			}
		});

		it("ok:false variant has error field", () => {
			const err: Result<never, string> = { ok: false, error: "fail" };
			expect(err.ok).toBe(false);
			if (!err.ok) {
				expect(err.error).toBe("fail");
			}
		});

		it("ok:true variant optionally has stale field", () => {
			const stale: Result<string, never> = { ok: true, data: "cached", stale: true };
			expect(stale.ok).toBe(true);
			if (stale.ok) {
				expect(stale.stale).toBe(true);
			}
		});
	});

	describe("ApiError union type", () => {
		it("rate_limited variant has retryAfter field", () => {
			const err: ApiError = { type: "rate_limited", retryAfter: 60000 };
			expect(err.type).toBe("rate_limited");
			if (err.type === "rate_limited") {
				expect(typeof err.retryAfter).toBe("number");
			}
		});

		it("circuit_open variant exists", () => {
			const err: ApiError = { type: "circuit_open" };
			expect(err.type).toBe("circuit_open");
		});

		it("http_error variant has status field", () => {
			const err: ApiError = { type: "http_error", status: 429 };
			expect(err.type).toBe("http_error");
			if (err.type === "http_error") {
				expect(err.status).toBe(429);
			}
		});

		it("network_error variant has message field", () => {
			const err: ApiError = { type: "network_error", message: "fetch failed" };
			expect(err.type).toBe("network_error");
			if (err.type === "network_error") {
				expect(err.message).toBe("fetch failed");
			}
		});
	});

	describe("TopTrack", () => {
		it("has all required fields", () => {
			const track: TopTrack = {
				rank: 1,
				trackUri: "spotify:track:abc",
				trackName: "Test Song",
				artistName: "Artist",
				artistUri: "spotify:artist:xyz",
				albumName: "Album",
				albumUri: "spotify:album:def",
				count: 10,
				durationMs: 3600000,
			};
			expect(track.rank).toBe(1);
			expect(track.count).toBe(10);
		});
	});

	describe("TopArtist", () => {
		it("has all required fields", () => {
			const artist: TopArtist = {
				rank: 1,
				artistUri: "spotify:artist:xyz",
				artistName: "Artist",
				count: 20,
				durationMs: 7200000,
			};
			expect(artist.rank).toBe(1);
		});
	});

	describe("TopAlbum", () => {
		it("has all required fields", () => {
			const album: TopAlbum = {
				rank: 1,
				albumUri: "spotify:album:abc",
				albumName: "Best Album",
				artistName: "Artist",
				count: 5,
				durationMs: 1800000,
			};
			expect(album.rank).toBe(1);
		});
	});

	describe("TopGenre", () => {
		it("has rank, genre, count fields", () => {
			const genre: TopGenre = {
				rank: 1,
				genre: "pop",
				count: 100,
			};
			expect(genre.genre).toBe("pop");
		});
	});

	describe("RecentPlay", () => {
		it("has trackUri, trackName, artistName, playedAt fields", () => {
			const recent: RecentPlay = {
				trackUri: "spotify:track:abc",
				trackName: "Recent Song",
				artistName: "Artist",
				playedAt: Date.now(),
			};
			expect(recent.playedAt).toBeGreaterThan(0);
		});
	});
});
