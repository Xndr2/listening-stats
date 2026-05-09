import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocks MUST come before any imports that reference these modules
vi.mock("../shared/api/cosmos-async", () => ({
	cosmosGet: vi.fn(),
}));
vi.mock("../shared/api/circuit-breaker", () => ({
	circuitBreaker: {
		isOpen: vi.fn(() => false),
	},
}));

import { cosmosGet } from "../shared/api/cosmos-async";
import { circuitBreaker } from "../shared/api/circuit-breaker";
import { resolveImportedUris } from "../shared/storage/uri-resolver";
import { db } from "../shared/storage/db";
import type { PlayEvent } from "../shared/types/play-event";

const cosmosGetMock = vi.mocked(cosmosGet);
const circuitBreakerMock = vi.mocked(circuitBreaker);

// ──────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────

function makePlayEvent(overrides: Partial<PlayEvent> = {}): Omit<PlayEvent, "id"> {
	return {
		trackUri: "listening-stats:track:abc123def456",
		trackName: "Test Track",
		artistName: "Test Artist",
		artistUri: "listening-stats:artist:abc123def456",
		albumName: "Test Album",
		albumUri: "listening-stats:album:abc123def456",
		durationMs: 200000,
		playedMs: 180000,
		startedAt: 1700000000000,
		endedAt: 1700000200000,
		type: "play" as const,
		...overrides,
	};
}

function makeSearchResponse(
	tracks: Array<{
		id: string;
		name: string;
		artistId: string;
		artistName: string;
		albumId: string;
		albumName: string;
		imageUrl?: string;
	}>
) {
	return {
		tracks: {
			items: tracks.map((t) => ({
				id: t.id,
				name: t.name,
				uri: `spotify:track:${t.id}`,
				artists: [{ id: t.artistId, name: t.artistName, uri: `spotify:artist:${t.artistId}` }],
				album: {
					id: t.albumId,
					name: t.albumName,
					uri: `spotify:album:${t.albumId}`,
					images: t.imageUrl ? [{ url: t.imageUrl, height: 640, width: 640 }] : [],
				},
			})),
		},
	};
}

// ──────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────

describe("resolveImportedUris", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: circuit breaker is closed
		circuitBreakerMock.isOpen.mockReturnValue(false);
	});

	it("Test 1 (no-op): does nothing when no synthetic URI events in DB", async () => {
		// Insert a real Spotify URI event  -  should not be processed
		await db.playEvents.add(makePlayEvent({ trackUri: "spotify:track:realid" }) as PlayEvent);

		await resolveImportedUris({ delayMs: 0 });

		expect(cosmosGetMock).not.toHaveBeenCalled();
	});

	it("Test 2 (successful resolution): updates all URIs and resolvedAt on match", async () => {
		await db.playEvents.add(
			makePlayEvent({
				trackUri: "listening-stats:track:abc123",
				trackName: "Test Track",
				artistName: "Test Artist",
			}) as PlayEvent
		);

		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: makeSearchResponse([
				{
					id: "realtrackid",
					name: "Test Track",
					artistId: "realartistid",
					artistName: "Test Artist",
					albumId: "realalbumid",
					albumName: "Test Album",
					imageUrl: "https://i.scdn.co/image/real.jpg",
				},
			]),
		});

		await resolveImportedUris({ delayMs: 0 });

		const events = await db.playEvents.toArray();
		expect(events).toHaveLength(1);
		expect(events[0].trackUri).toBe("spotify:track:realtrackid");
		expect(events[0].artistUri).toBe("spotify:artist:realartistid");
		expect(events[0].albumUri).toBe("spotify:album:realalbumid");
		expect(events[0].albumArt).toBe("https://i.scdn.co/image/real.jpg");
		expect(events[0].resolvedAt).toBeGreaterThan(0);
	});

	it("Test 3 (no match - unresolvable): marks resolvedAt=0, leaves URI unchanged", async () => {
		await db.playEvents.add(
			makePlayEvent({
				trackUri: "listening-stats:track:abc123",
				trackName: "Test Track",
				artistName: "Test Artist",
			}) as PlayEvent
		);

		// Search returns tracks that do NOT match
		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: makeSearchResponse([
				{
					id: "wrongtrackid",
					name: "Different Track Name",
					artistId: "wrongartistid",
					artistName: "Different Artist",
					albumId: "wrongalbumid",
					albumName: "Wrong Album",
				},
			]),
		});

		await resolveImportedUris({ delayMs: 0 });

		const events = await db.playEvents.toArray();
		expect(events[0].trackUri).toBe("listening-stats:track:abc123");
		expect(events[0].resolvedAt).toBe(0);
	});

	it("Test 4 (circuit breaker stops batch): stops after first search when circuit opens", async () => {
		// Insert 2 events with different synthetic URIs
		await db.playEvents.bulkAdd([
			makePlayEvent({
				trackUri: "listening-stats:track:uri1",
				trackName: "Track One",
				artistName: "Artist One",
				startedAt: 1700000000001,
			}) as PlayEvent,
			makePlayEvent({
				trackUri: "listening-stats:track:uri2",
				trackName: "Track Two",
				artistName: "Artist Two",
				startedAt: 1700000000002,
			}) as PlayEvent,
		]);

		// Circuit is closed for first call, then opens
		circuitBreakerMock.isOpen
			.mockReturnValueOnce(false) // first check  -  proceed
			.mockReturnValueOnce(true); // second check  -  stop

		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: makeSearchResponse([
				{
					id: "realid1",
					name: "Track One",
					artistId: "artist1",
					artistName: "Artist One",
					albumId: "album1",
					albumName: "Album One",
				},
			]),
		});

		await resolveImportedUris({ delayMs: 0 });

		// Only 1 API call should have been made
		expect(cosmosGetMock).toHaveBeenCalledTimes(1);

		// Second event should remain unresolved
		const events = await db.playEvents.toArray();
		const event2 = events.find((e) => e.trackUri === "listening-stats:track:uri2");
		expect(event2).toBeDefined();
		// Second event was never resolved (circuit stopped it)
		expect(event2?.resolvedAt === null || event2?.resolvedAt === undefined || event2?.resolvedAt === 0).toBe(true);
	});

	it("Test 5 (batch update - same synthetic URI): 3 events same URI results in 1 search, all updated", async () => {
		// 3 events with identical synthetic trackUri
		await db.playEvents.bulkAdd([
			makePlayEvent({ startedAt: 1700000000001 }) as PlayEvent,
			makePlayEvent({ startedAt: 1700000000002 }) as PlayEvent,
			makePlayEvent({ startedAt: 1700000000003 }) as PlayEvent,
		]);

		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: makeSearchResponse([
				{
					id: "batchtrackid",
					name: "Test Track",
					artistId: "batchartistid",
					artistName: "Test Artist",
					albumId: "batchalbumid",
					albumName: "Test Album",
					imageUrl: "https://i.scdn.co/image/batch.jpg",
				},
			]),
		});

		await resolveImportedUris({ delayMs: 0 });

		// Only 1 API call for 3 events with same URI
		expect(cosmosGetMock).toHaveBeenCalledTimes(1);

		// All 3 events updated
		const events = await db.playEvents.toArray();
		expect(events).toHaveLength(3);
		for (const event of events) {
			expect(event.trackUri).toBe("spotify:track:batchtrackid");
			expect(event.resolvedAt).toBeGreaterThan(0);
		}
	});

	it("Test 6 (skips already-resolved events): only processes null resolvedAt events", async () => {
		const now = Date.now();
		// One already-resolved event
		await db.playEvents.add(
			makePlayEvent({
				trackUri: "listening-stats:track:alreadydone",
				trackName: "Already Resolved",
				resolvedAt: now,
				startedAt: 1700000000001,
			}) as PlayEvent
		);
		// One unresolved event
		await db.playEvents.add(
			makePlayEvent({
				trackUri: "listening-stats:track:notdone",
				trackName: "Not Yet Resolved",
				resolvedAt: null,
				startedAt: 1700000000002,
			}) as PlayEvent
		);

		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: makeSearchResponse([
				{
					id: "newtrackid",
					name: "Not Yet Resolved",
					artistId: "artistid",
					artistName: "Test Artist",
					albumId: "albumid",
					albumName: "Test Album",
				},
			]),
		});

		await resolveImportedUris({ delayMs: 0 });

		// Only 1 API call (the unresolved one)
		expect(cosmosGetMock).toHaveBeenCalledTimes(1);
	});

	it("Test 7 (skips unresolvable events): resolvedAt=0 events are never re-searched", async () => {
		await db.playEvents.add(
			makePlayEvent({
				trackUri: "listening-stats:track:unresolvable",
				resolvedAt: 0,
			}) as PlayEvent
		);

		await resolveImportedUris({ delayMs: 0 });

		expect(cosmosGetMock).not.toHaveBeenCalled();
	});

	it("Test 8 (case-insensitive match): matches even when search result casing differs", async () => {
		await db.playEvents.add(
			makePlayEvent({
				trackUri: "listening-stats:track:casetest",
				trackName: "test track",
				artistName: "test artist",
			}) as PlayEvent
		);

		// Search result has UPPERCASE casing
		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: makeSearchResponse([
				{
					id: "casedtrackid",
					name: "TEST TRACK",
					artistId: "casedartistid",
					artistName: "TEST ARTIST",
					albumId: "casedalbumid",
					albumName: "TEST ALBUM",
					imageUrl: "https://i.scdn.co/image/cased.jpg",
				},
			]),
		});

		await resolveImportedUris({ delayMs: 0 });

		const events = await db.playEvents.toArray();
		expect(events[0].trackUri).toBe("spotify:track:casedtrackid");
		expect(events[0].resolvedAt).toBeGreaterThan(0);
	});

	it("Test 9 (albumArt null safety): sets albumArt to null when images array is empty", async () => {
		await db.playEvents.add(
			makePlayEvent({
				trackUri: "listening-stats:track:noart",
				trackName: "Test Track",
				artistName: "Test Artist",
			}) as PlayEvent
		);

		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: makeSearchResponse([
				{
					id: "noarttrackid",
					name: "Test Track",
					artistId: "noartartistid",
					artistName: "Test Artist",
					albumId: "noartalbumid",
					albumName: "Test Album",
					// No imageUrl  -  images array will be empty
				},
			]),
		});

		await resolveImportedUris({ delayMs: 0 });

		const events = await db.playEvents.toArray();
		expect(events[0].albumArt).toBeNull();
		expect(events[0].resolvedAt).toBeGreaterThan(0);
	});

	it("Test 10 (URL encoding): encodes special characters in track/artist name", async () => {
		await db.playEvents.add(
			makePlayEvent({
				trackUri: "listening-stats:track:specialchars",
				trackName: "Don't Stop Me Now",
				artistName: "Queen",
			}) as PlayEvent
		);

		cosmosGetMock.mockResolvedValueOnce({
			ok: true,
			data: makeSearchResponse([
				{
					id: "queenid",
					name: "Don't Stop Me Now",
					artistId: "queenartistid",
					artistName: "Queen",
					albumId: "queenalbumid",
					albumName: "Jazz",
				},
			]),
		});

		await resolveImportedUris({ delayMs: 0 });

		// Verify cosmosGet was called with encoded URL
		expect(cosmosGetMock).toHaveBeenCalledWith(
			expect.stringContaining(encodeURIComponent("Don't Stop Me Now"))
		);
	});
});
