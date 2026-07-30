import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../shared/storage/db";
import type { ArtistRecord } from "../shared/types/stats";

// Mock cosmosGet to avoid real API calls
vi.mock("../shared/api/cosmos-async", () => ({
	cosmosGet: vi.fn(),
}));

import { cosmosGet } from "../shared/api/cosmos-async";
import { enrichArtists } from "../shared/stats/artist-enrichment";

const cosmosGetMock = vi.mocked(cosmosGet);

function makeSpotifyArtist(id: string, name: string, genres: string[], imageUrl?: string) {
	return {
		id,
		name,
		genres,
		images: imageUrl ? [{ url: imageUrl, height: 640, width: 640 }] : [],
	};
}

function makeArtistUri(id: string): string {
	return `spotify:artist:${id}`;
}

function makeArtistRecord(uri: string, updatedAt: number = Date.now()): ArtistRecord {
	const id = uri.replace("spotify:artist:", "");
	return {
		uri,
		name: `Artist ${id}`,
		genres: ["pop"],
		imageUrl: `https://i.scdn.co/${id}.jpg`,
		updatedAt,
	};
}

describe("enrichArtists", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does nothing for empty array (no-op)", async () => {
		await enrichArtists([]);
		expect(cosmosGetMock).not.toHaveBeenCalled();
	});

	it("calls cosmosGet once with all 3 IDs comma-separated for 3 unenriched URIs", async () => {
		const uris = [makeArtistUri("aaa111"), makeArtistUri("bbb222"), makeArtistUri("ccc333")];

		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: {
				artists: [
					makeSpotifyArtist("aaa111", "Artist A", ["rock"]),
					makeSpotifyArtist("bbb222", "Artist B", ["pop"]),
					makeSpotifyArtist("ccc333", "Artist C", ["jazz"]),
				],
			},
		});

		await enrichArtists(uris);
		expect(cosmosGetMock).toHaveBeenCalledTimes(1);
	});

	it("strips 'spotify:artist:' prefix  -  URL contains bare IDs only", async () => {
		const uris = [makeArtistUri("id001"), makeArtistUri("id002")];

		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: {
				artists: [makeSpotifyArtist("id001", "Artist 1", []), makeSpotifyArtist("id002", "Artist 2", [])],
			},
		});

		await enrichArtists(uris);
		expect(cosmosGetMock).toHaveBeenCalledWith(
			expect.stringMatching(/https:\/\/api\.spotify\.com\/v1\/artists\?ids=id001,id002/),
		);
	});

	it("calls URL matching https://api.spotify.com/v1/artists?ids=ID1,ID2,ID3", async () => {
		const uris = [makeArtistUri("x1"), makeArtistUri("x2"), makeArtistUri("x3")];

		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: {
				artists: [
					makeSpotifyArtist("x1", "X1", []),
					makeSpotifyArtist("x2", "X2", []),
					makeSpotifyArtist("x3", "X3", []),
				],
			},
		});

		await enrichArtists(uris);
		expect(cosmosGetMock).toHaveBeenCalledWith("https://api.spotify.com/v1/artists?ids=x1,x2,x3");
	});

	it("successful response writes ArtistRecord objects to db.artists via bulkPut", async () => {
		const uris = [makeArtistUri("wr001")];

		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: {
				artists: [makeSpotifyArtist("wr001", "Write Test Artist", ["indie"], "https://img.url/wr001.jpg")],
			},
		});

		await enrichArtists(uris);

		const stored = await db.artists.get(makeArtistUri("wr001"));
		expect(stored).toBeDefined();
		expect(stored?.name).toBe("Write Test Artist");
		expect(stored?.genres).toEqual(["indie"]);
	});

	it("stored ArtistRecord has uri (full URI), name, genres, imageUrl (first image or null), updatedAt", async () => {
		const uri = makeArtistUri("rec001");

		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: {
				artists: [makeSpotifyArtist("rec001", "Record Artist", ["ambient"], "https://img.url/rec001.jpg")],
			},
		});

		await enrichArtists([uri]);

		const stored = await db.artists.get(uri);
		expect(stored).toBeDefined();
		expect(stored?.uri).toBe(uri); // full URI, not bare ID
		expect(stored?.name).toBe("Record Artist");
		expect(stored?.genres).toEqual(["ambient"]);
		expect(stored?.imageUrl).toBe("https://img.url/rec001.jpg");
		expect(stored?.updatedAt).toBeTypeOf("number");
	});

	it("with 60 URIs makes 2 API calls (batch of 50 + batch of 10)", async () => {
		const uris = Array.from({ length: 60 }, (_, i) => makeArtistUri(`batch${i}`));

		// First batch: 50 artists
		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: {
				artists: uris
					.slice(0, 50)
					.map((uri) => makeSpotifyArtist(uri.replace("spotify:artist:", ""), `Artist ${uri}`, [])),
			},
		});

		// Second batch: 10 artists
		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: {
				artists: uris
					.slice(50)
					.map((uri) => makeSpotifyArtist(uri.replace("spotify:artist:", ""), `Artist ${uri}`, [])),
			},
		});

		await enrichArtists(uris);
		expect(cosmosGetMock).toHaveBeenCalledTimes(2);
	});

	it("already-enriched artists (updatedAt < 24h ago) are skipped", async () => {
		const recentlyEnrichedUri = makeArtistUri("enriched01");
		const freshRecord = makeArtistRecord(recentlyEnrichedUri, Date.now() - 1000); // 1 second ago
		await db.artists.put(freshRecord);

		const newUri = makeArtistUri("new01");
		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: {
				artists: [makeSpotifyArtist("new01", "New Artist", [])],
			},
		});

		await enrichArtists([recentlyEnrichedUri, newUri]);

		// Should only call API for new01, not enriched01
		expect(cosmosGetMock).toHaveBeenCalledTimes(1);
		const callArg = cosmosGetMock.mock.calls[0][0] as string;
		expect(callArg).not.toContain("enriched01");
		expect(callArg).toContain("new01");
	});

	it("API failure (circuit_open) silently skips enrichment without throwing", async () => {
		const uri = makeArtistUri("fail01");

		cosmosGetMock.mockResolvedValueOnce({
			ok: false,
			error: { type: "circuit_open" },
		});

		// Should not throw
		await expect(enrichArtists([uri])).resolves.toBeUndefined();
	});

	it("API failure (rate_limited) silently skips enrichment without throwing", async () => {
		const uri = makeArtistUri("fail02");

		cosmosGetMock.mockResolvedValueOnce({
			ok: false,
			error: { type: "rate_limited", retryAfter: 30 },
		});

		await expect(enrichArtists([uri])).resolves.toBeUndefined();
	});

	it("artists with empty genres[] in API response are stored with genres: []", async () => {
		const uri = makeArtistUri("nogenre01");

		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: {
				artists: [makeSpotifyArtist("nogenre01", "No Genre Artist", [])],
			},
		});

		await enrichArtists([uri]);

		const stored = await db.artists.get(uri);
		expect(stored?.genres).toEqual([]);
	});

	it("artist with no images stores imageUrl as null", async () => {
		const uri = makeArtistUri("noimg01");

		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: {
				artists: [makeSpotifyArtist("noimg01", "No Image Artist", [])],
				// makeSpotifyArtist with no imageUrl creates empty images array
			},
		});

		await enrichArtists([uri]);

		const stored = await db.artists.get(uri);
		expect(stored?.imageUrl).toBeNull();
	});

	it("ignores invalid artist URIs (no cosmos call)", async () => {
		await enrichArtists(["", "spotify:track:bad", "listening-stats:x", "spotify:artist:"]);
		expect(cosmosGetMock).not.toHaveBeenCalled();
	});

	it("stores tombstone when API returns null for a slot", async () => {
		const uri = makeArtistUri("nullslot");

		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: { artists: [null] },
		});

		await enrichArtists([uri]);

		const stored = await db.artists.get(uri);
		expect(stored?.imageUrl).toBeNull();
		expect(stored?.name).toBe("Unknown");
	});

	it("re-fetches when portrait is null and row is older than no-image cooldown", async () => {
		const uri = makeArtistUri("retryimg");
		await db.artists.put({
			uri,
			name: "Retry",
			genres: [],
			imageUrl: null,
			updatedAt: Date.now() - 7 * 60 * 60 * 1000,
		});

		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: {
				artists: [makeSpotifyArtist("retryimg", "Retry", [], "https://img.example/retry.jpg")],
			},
		});

		await enrichArtists([uri]);

		expect(cosmosGetMock).toHaveBeenCalledTimes(1);
		const stored = await db.artists.get(uri);
		expect(stored?.imageUrl).toBe("https://img.example/retry.jpg");
	});

	it("skips refetch when portrait is null but within no-image cooldown", async () => {
		const uri = makeArtistUri("coolimg");
		await db.artists.put({
			uri,
			name: "Cool",
			genres: [],
			imageUrl: null,
			updatedAt: Date.now() - 2 * 60 * 60 * 1000,
		});

		await enrichArtists([uri]);

		expect(cosmosGetMock).not.toHaveBeenCalled();
	});
});
