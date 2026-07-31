import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	fetchStatsFmLifetimeTrackStreams,
	fetchStatsFmPeriodTrackStreams,
	readStatsFmUsername,
} from "../shared/api/statsfm-track-plays";
import { LS_KEYS } from "../shared/constants/storage-keys";

function trackRow(spotifyId: string, streams: number) {
	return { streams, track: { externalIds: { spotify: [spotifyId] } } };
}

function jsonResponse(body: unknown, ok = true): Response {
	return { ok, json: async () => body } as unknown as Response;
}

describe("statsfm-track-plays", () => {
	const fetchMock = vi.fn();

	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
		localStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe("readStatsFmUsername", () => {
		it("returns the username from stored config", () => {
			localStorage.setItem(LS_KEYS.STATSFM_CONFIG, JSON.stringify({ username: "alice" }));
			expect(readStatsFmUsername()).toBe("alice");
		});

		it("returns null when config is missing", () => {
			expect(readStatsFmUsername()).toBeNull();
		});

		it("returns null on malformed JSON", () => {
			localStorage.setItem(LS_KEYS.STATSFM_CONFIG, "{nope");
			expect(readStatsFmUsername()).toBeNull();
		});

		it("returns null when username is not a string", () => {
			localStorage.setItem(LS_KEYS.STATSFM_CONFIG, JSON.stringify({ username: 42 }));
			expect(readStatsFmUsername()).toBeNull();
		});
	});

	describe("fetchStatsFmLifetimeTrackStreams", () => {
		it("returns streams when the track is on the first page", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ items: [trackRow("abc", 12), trackRow("xyz", 3)] }));
			await expect(fetchStatsFmLifetimeTrackStreams("alice", "spotify:track:xyz")).resolves.toBe(3);
			expect(fetchMock).toHaveBeenCalledTimes(1);
			const url = String(fetchMock.mock.calls[0][0]);
			expect(url).toContain("/users/alice/top/tracks");
			expect(url).toContain("range=lifetime");
		});

		it("accepts the singular `item` payload key", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ item: [trackRow("xyz", 7)] }));
			await expect(fetchStatsFmLifetimeTrackStreams("alice", "spotify:track:xyz")).resolves.toBe(7);
		});

		it("paginates full pages until the track is found", async () => {
			const fullPage = Array.from({ length: 100 }, (_, i) => trackRow(`other-${i}`, i));
			fetchMock
				.mockResolvedValueOnce(jsonResponse({ items: fullPage }))
				.mockResolvedValueOnce(jsonResponse({ items: [trackRow("xyz", 42)] }));
			await expect(fetchStatsFmLifetimeTrackStreams("alice", "spotify:track:xyz")).resolves.toBe(42);
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(String(fetchMock.mock.calls[1][0])).toContain("offset=100");
		});

		it("stops after a short page without a match", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ items: [trackRow("other", 1)] }));
			await expect(fetchStatsFmLifetimeTrackStreams("alice", "spotify:track:xyz")).resolves.toBeNull();
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it("returns null without fetching for a non-track URI", async () => {
			await expect(fetchStatsFmLifetimeTrackStreams("alice", "spotify:episode:xyz")).resolves.toBeNull();
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("returns null without fetching for a blank username", async () => {
			await expect(fetchStatsFmLifetimeTrackStreams("  ", "spotify:track:xyz")).resolves.toBeNull();
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("returns null when fetch rejects", async () => {
			fetchMock.mockRejectedValueOnce(new Error("offline"));
			await expect(fetchStatsFmLifetimeTrackStreams("alice", "spotify:track:xyz")).resolves.toBeNull();
		});

		it("returns null on a non-2xx response", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
			await expect(fetchStatsFmLifetimeTrackStreams("alice", "spotify:track:xyz")).resolves.toBeNull();
		});

		it("percent-encodes the username in the request path", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ items: [trackRow("xyz", 5)] }));
			await fetchStatsFmLifetimeTrackStreams("a/b?c", "spotify:track:xyz");
			expect(String(fetchMock.mock.calls[0][0])).toContain("/users/a%2Fb%3Fc/top/tracks");
		});
	});

	describe("fetchStatsFmPeriodTrackStreams", () => {
		it("maps dashboard period ids to stats.fm ranges", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ items: [trackRow("xyz", 9)] }));
			await expect(fetchStatsFmPeriodTrackStreams("alice", "spotify:track:xyz", "sfm-weeks")).resolves.toBe(9);
			expect(String(fetchMock.mock.calls[0][0])).toContain("range=weeks");
		});

		it("returns null without fetching for unknown period ids", async () => {
			await expect(fetchStatsFmPeriodTrackStreams("alice", "spotify:track:xyz", "local-week")).resolves.toBeNull();
			expect(fetchMock).not.toHaveBeenCalled();
		});
	});
});
