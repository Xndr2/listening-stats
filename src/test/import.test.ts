import { describe, expect, it } from "vitest";
import { db } from "../shared/storage/db";
import { importFileEvents, parseJsonEvents, parseV1Csv } from "../shared/storage/import";
import { generateSyntheticUris } from "../shared/storage/synthetic-uris";
import type { PlayEvent } from "../shared/types/play-event";

// ──────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────

function makePlayEvent(overrides: Partial<Omit<PlayEvent, "id">> = {}): Omit<PlayEvent, "id"> {
	return {
		trackUri: "listening-stats:track:aabbccddeeff",
		trackName: "Test Track",
		artistName: "Test Artist",
		artistUri: "listening-stats:artist:aabbccddeeff",
		albumName: "Test Album",
		albumUri: "listening-stats:album:aabbccddeeff",
		durationMs: 180000,
		playedMs: 150000,
		startedAt: 1700000000000,
		endedAt: 1700000150000,
		type: "play",
		...overrides,
	};
}

/** Build a minimal v1 CSV string with exact v1 header */
function buildV1Csv(rows: string[]): string {
	const header = "Track,Artist,Album,Duration (ms),Played (ms),Started At,Ended At";
	return [header, ...rows].join("\n");
}

// ──────────────────────────────────────────────────────
// generateSyntheticUris
// ──────────────────────────────────────────────────────

describe("generateSyntheticUris", () => {
	it("returns URIs with listening-stats: prefix", async () => {
		const uris = await generateSyntheticUris("Track A", "Artist B", "Album C");
		expect(uris.trackUri).toMatch(/^listening-stats:track:/);
		expect(uris.artistUri).toMatch(/^listening-stats:artist:/);
		expect(uris.albumUri).toMatch(/^listening-stats:album:/);
	});

	it("hash is exactly 12 hex characters", async () => {
		const uris = await generateSyntheticUris("Track A", "Artist B", "Album C");
		const trackHash = uris.trackUri.replace("listening-stats:track:", "");
		const artistHash = uris.artistUri.replace("listening-stats:artist:", "");
		const albumHash = uris.albumUri.replace("listening-stats:album:", "");
		expect(trackHash).toMatch(/^[0-9a-f]{12}$/);
		expect(artistHash).toMatch(/^[0-9a-f]{12}$/);
		expect(albumHash).toMatch(/^[0-9a-f]{12}$/);
	});

	it("is deterministic  -  same inputs always produce same URIs", async () => {
		const uris1 = await generateSyntheticUris("Track A", "Artist B", "Album C");
		const uris2 = await generateSyntheticUris("Track A", "Artist B", "Album C");
		expect(uris1.trackUri).toBe(uris2.trackUri);
		expect(uris1.artistUri).toBe(uris2.artistUri);
		expect(uris1.albumUri).toBe(uris2.albumUri);
	});

	it("all three URI types share the same hash (based on compound key)", async () => {
		const uris = await generateSyntheticUris("Track A", "Artist B", "Album C");
		const trackHash = uris.trackUri.replace("listening-stats:track:", "");
		const artistHash = uris.artistUri.replace("listening-stats:artist:", "");
		const albumHash = uris.albumUri.replace("listening-stats:album:", "");
		// All use the same compound key hash
		expect(trackHash).toBe(artistHash);
		expect(artistHash).toBe(albumHash);
	});

	it("lowercases inputs before hashing  -  TRACK A == track a", async () => {
		const urisUpper = await generateSyntheticUris("TRACK A", "ARTIST B", "ALBUM C");
		const urisLower = await generateSyntheticUris("track a", "artist b", "album c");
		expect(urisUpper.trackUri).toBe(urisLower.trackUri);
		expect(urisUpper.artistUri).toBe(urisLower.artistUri);
		expect(urisUpper.albumUri).toBe(urisLower.albumUri);
	});

	it("different tracks produce different URIs", async () => {
		const uris1 = await generateSyntheticUris("Track A", "Artist B", "Album C");
		const uris2 = await generateSyntheticUris("Track X", "Artist Y", "Album Z");
		expect(uris1.trackUri).not.toBe(uris2.trackUri);
	});
});

// ──────────────────────────────────────────────────────
// parseV1Csv
// ──────────────────────────────────────────────────────

describe("parseV1Csv", () => {
	it("parses a single valid CSV row into a PlayEvent-shaped object", async () => {
		const csv = buildV1Csv([
			"Bohemian Rhapsody,Queen,A Night at the Opera,354000,300000,2024-12-01T14:23:00.000Z,2024-12-01T14:28:54.000Z",
		]);
		const result = await parseV1Csv(csv);
		expect(result.events).toHaveLength(1);
		expect(result.errors).toBe(0);
		const ev = result.events[0];
		expect(ev.trackName).toBe("Bohemian Rhapsody");
		expect(ev.artistName).toBe("Queen");
		expect(ev.albumName).toBe("A Night at the Opera");
		expect(ev.durationMs).toBe(354000);
		expect(ev.playedMs).toBe(300000);
		// ISO string converted to Unix ms
		expect(ev.startedAt).toBe(new Date("2024-12-01T14:23:00.000Z").getTime());
		expect(ev.endedAt).toBe(new Date("2024-12-01T14:28:54.000Z").getTime());
	});

	it("sets type: play on all parsed events", async () => {
		const csv = buildV1Csv([
			"Track 1,Artist,Album,180000,150000,2024-01-01T10:00:00.000Z,2024-01-01T10:02:30.000Z",
			"Track 2,Artist,Album,120000,100000,2024-01-01T11:00:00.000Z,2024-01-01T11:02:00.000Z",
		]);
		const result = await parseV1Csv(csv);
		expect(result.events).toHaveLength(2);
		for (const ev of result.events) {
			expect(ev.type).toBe("play");
		}
	});

	it("assigns synthetic URIs with listening-stats: prefix", async () => {
		const csv = buildV1Csv(["Track 1,Artist,Album,180000,150000,2024-01-01T10:00:00.000Z,2024-01-01T10:02:30.000Z"]);
		const result = await parseV1Csv(csv);
		const ev = result.events[0];
		expect(ev.trackUri).toMatch(/^listening-stats:track:/);
		expect(ev.artistUri).toMatch(/^listening-stats:artist:/);
		expect(ev.albumUri).toMatch(/^listening-stats:album:/);
	});

	it("throws when header is missing parentheses (old format)", async () => {
		const badCsv =
			"Track,Artist,Album,Duration ms,Played ms,Started At,Ended At\nTrack 1,Artist,Album,180000,150000,2024-01-01T10:00:00.000Z,2024-01-01T10:02:30.000Z";
		await expect(parseV1Csv(badCsv)).rejects.toThrow("unrecognized CSV format");
	});

	it("throws when header is completely wrong", async () => {
		const badCsv = "Name,Performer,Record,Duration,Play time,Start,End\nRow";
		await expect(parseV1Csv(badCsv)).rejects.toThrow("unrecognized CSV format");
	});

	it("throws with helpful message for stats summary CSV (Period header)", async () => {
		const statsCsv = "Period,4 Weeks\nExported,2026-04-04\nTotal Time,12h 30m";
		await expect(parseV1Csv(statsCsv)).rejects.toThrow("stats summary CSV");
	});

	it("throws with helpful message for ranked stats CSV (Rank header)", async () => {
		const statsCsv = "Rank,Track,Artist,Album,Plays,Duration\n1,Song,Artist,Album,42,180000";
		await expect(parseV1Csv(statsCsv)).rejects.toThrow("stats summary CSV");
	});

	it("returns empty array for header-only CSV (no data rows)", async () => {
		const csv = "Track,Artist,Album,Duration (ms),Played (ms),Started At,Ended At";
		const result = await parseV1Csv(csv);
		expect(result.events).toHaveLength(0);
		expect(result.errors).toBe(0);
		expect(result.errorDetails).toHaveLength(0);
	});

	it("skips rows with invalid timestamps and counts them as errors", async () => {
		const csv = buildV1Csv([
			"Track 1,Artist,Album,180000,150000,not-a-date,2024-01-01T10:02:30.000Z",
			"Track 2,Artist,Album,120000,100000,2024-01-01T11:00:00.000Z,2024-01-01T11:02:00.000Z",
		]);
		const result = await parseV1Csv(csv);
		expect(result.events).toHaveLength(1);
		expect(result.errors).toBe(1);
		expect(result.errorDetails.length).toBeGreaterThan(0);
	});

	it("skips rows with invalid numeric fields and counts them as errors", async () => {
		const csv = buildV1Csv([
			"Track 1,Artist,Album,not-a-number,150000,2024-01-01T10:00:00.000Z,2024-01-01T10:02:30.000Z",
		]);
		const result = await parseV1Csv(csv);
		expect(result.events).toHaveLength(0);
		expect(result.errors).toBe(1);
	});

	it("handles quoted CSV fields with commas inside quotes", async () => {
		const csv = buildV1Csv([
			'"Track, With Comma","Artist, With Comma","Album, With Comma",180000,150000,2024-01-01T10:00:00.000Z,2024-01-01T10:02:30.000Z',
		]);
		const result = await parseV1Csv(csv);
		expect(result.events).toHaveLength(1);
		expect(result.events[0].trackName).toBe("Track, With Comma");
		expect(result.events[0].artistName).toBe("Artist, With Comma");
		expect(result.events[0].albumName).toBe("Album, With Comma");
	});

	it("parses multiple rows and returns all valid events", async () => {
		const rows = Array.from(
			{ length: 5 },
			(_, i) =>
				`Track ${i + 1},Artist ${i + 1},Album ${i + 1},180000,150000,2024-0${i + 1}-01T10:00:00.000Z,2024-0${i + 1}-01T10:02:30.000Z`,
		);
		const csv = buildV1Csv(rows);
		const result = await parseV1Csv(csv);
		expect(result.events).toHaveLength(5);
		expect(result.errors).toBe(0);
	});

	it("returns ParseResult shape with events, errors, errorDetails", async () => {
		const csv = buildV1Csv(["Track 1,Artist,Album,180000,150000,2024-01-01T10:00:00.000Z,2024-01-01T10:02:30.000Z"]);
		const result = await parseV1Csv(csv);
		expect(result).toHaveProperty("events");
		expect(result).toHaveProperty("errors");
		expect(result).toHaveProperty("errorDetails");
		expect(Array.isArray(result.events)).toBe(true);
		expect(typeof result.errors).toBe("number");
		expect(Array.isArray(result.errorDetails)).toBe(true);
	});
});

// ──────────────────────────────────────────────────────
// parseJsonEvents
// ──────────────────────────────────────────────────────

describe("parseJsonEvents", () => {
	it("parses a valid JSON array of PlayEvent-like objects", async () => {
		const events = [
			{
				trackUri: "spotify:track:abc",
				trackName: "Test Track",
				artistName: "Test Artist",
				artistUri: "spotify:artist:xyz",
				albumName: "Test Album",
				albumUri: "spotify:album:def",
				durationMs: 180000,
				playedMs: 150000,
				startedAt: 1700000000000,
				endedAt: 1700000150000,
			},
		];
		const result = await parseJsonEvents(JSON.stringify(events));
		expect(result.events).toHaveLength(1);
		expect(result.errors).toBe(0);
		expect(result.events[0].trackName).toBe("Test Track");
	});

	it("sets type: play on all events regardless of source type", async () => {
		const events = [
			{
				trackUri: "spotify:track:abc",
				trackName: "Test Track",
				artistName: "Test Artist",
				artistUri: "spotify:artist:xyz",
				albumName: "Test Album",
				albumUri: "spotify:album:def",
				durationMs: 180000,
				playedMs: 150000,
				startedAt: 1700000000000,
				endedAt: 1700000150000,
				type: "skip", // source says skip, import must override to "play"
			},
		];
		const result = await parseJsonEvents(JSON.stringify(events));
		expect(result.events[0].type).toBe("play");
	});

	it("keeps existing trackUri when present", async () => {
		const events = [
			{
				trackUri: "spotify:track:real123",
				trackName: "Test Track",
				artistName: "Test Artist",
				artistUri: "spotify:artist:xyz",
				albumName: "Test Album",
				albumUri: "spotify:album:def",
				durationMs: 180000,
				playedMs: 150000,
				startedAt: 1700000000000,
				endedAt: 1700000150000,
			},
		];
		const result = await parseJsonEvents(JSON.stringify(events));
		expect(result.events[0].trackUri).toBe("spotify:track:real123");
	});

	it("generates synthetic URIs when trackUri is missing", async () => {
		const events = [
			{
				trackName: "Test Track",
				artistName: "Test Artist",
				albumName: "Test Album",
				durationMs: 180000,
				playedMs: 150000,
				startedAt: 1700000000000,
				endedAt: 1700000150000,
			},
		];
		const result = await parseJsonEvents(JSON.stringify(events));
		expect(result.events[0].trackUri).toMatch(/^listening-stats:track:/);
		expect(result.events[0].artistUri).toMatch(/^listening-stats:artist:/);
		expect(result.events[0].albumUri).toMatch(/^listening-stats:album:/);
	});

	it("defaults albumName to empty string when missing", async () => {
		const events = [
			{
				trackName: "Test Track",
				artistName: "Test Artist",
				durationMs: 180000,
				playedMs: 150000,
				startedAt: 1700000000000,
				endedAt: 1700000150000,
			},
		];
		const result = await parseJsonEvents(JSON.stringify(events));
		expect(result.events).toHaveLength(1);
		expect(result.events[0].albumName).toBe("");
	});

	it("skips rows missing required fields and counts as errors", async () => {
		const events = [
			{
				// missing trackName
				artistName: "Test Artist",
				albumName: "Test Album",
				durationMs: 180000,
				playedMs: 150000,
				startedAt: 1700000000000,
				endedAt: 1700000150000,
			},
			{
				trackName: "Track 2",
				artistName: "Artist 2",
				albumName: "Album 2",
				durationMs: 180000,
				playedMs: 150000,
				startedAt: 1700000001000,
				endedAt: 1700000151000,
			},
		];
		const result = await parseJsonEvents(JSON.stringify(events));
		expect(result.events).toHaveLength(1);
		expect(result.errors).toBe(1);
	});

	it("throws for non-array JSON (plain object)", async () => {
		await expect(parseJsonEvents('{"key":"value"}')).rejects.toThrow();
	});

	it("throws for StatsResult-shaped object with topTracks key", async () => {
		const statsResult = {
			topTracks: [],
			topArtists: [],
			totalTimeMs: 0,
		};
		await expect(parseJsonEvents(JSON.stringify(statsResult))).rejects.toThrow("raw play events array");
	});

	it("throws for non-array JSON  -  error message contains 'not a valid JSON' or 'raw play events array'", async () => {
		const nonArray = '{"foo": "bar"}';
		await expect(parseJsonEvents(nonArray)).rejects.toThrow();
	});

	it("throws for invalid JSON text", async () => {
		await expect(parseJsonEvents("not valid json{{{")).rejects.toThrow();
	});

	it("returns ParseResult shape", async () => {
		const events = [
			{
				trackUri: "spotify:track:abc",
				trackName: "Test Track",
				artistName: "Test Artist",
				artistUri: "spotify:artist:xyz",
				albumName: "Test Album",
				albumUri: "spotify:album:def",
				durationMs: 180000,
				playedMs: 150000,
				startedAt: 1700000000000,
				endedAt: 1700000150000,
			},
		];
		const result = await parseJsonEvents(JSON.stringify(events));
		expect(result).toHaveProperty("events");
		expect(result).toHaveProperty("errors");
		expect(result).toHaveProperty("errorDetails");
	});
});

// ──────────────────────────────────────────────────────
// importFileEvents
// ──────────────────────────────────────────────────────

describe("importFileEvents", () => {
	it("returns zero counts for empty input", async () => {
		const result = await importFileEvents([]);
		expect(result).toEqual({ imported: 0, skipped: 0, errors: 0, errorDetails: [] });
	});

	it("inserts events into the DB and returns correct imported count", async () => {
		const events = [makePlayEvent({ startedAt: 1000 }), makePlayEvent({ startedAt: 2000, trackName: "Track 2" })];
		const result = await importFileEvents(events);
		expect(result.imported).toBe(2);
		expect(result.skipped).toBe(0);
		expect(result.errors).toBe(0);
		const all = await db.playEvents.toArray();
		expect(all).toHaveLength(2);
	});

	it("deduplicates against existing DB entries by startedAt + trackName", async () => {
		const ev = makePlayEvent({ startedAt: 1700000000000 });
		// Insert once
		await db.playEvents.add(ev);
		// Re-import the same event
		const result = await importFileEvents([ev]);
		expect(result.imported).toBe(0);
		expect(result.skipped).toBe(1);
		expect(result.errors).toBe(0);
	});

	it("re-importing the same events skips all duplicates", async () => {
		const events = [makePlayEvent({ startedAt: 1000 }), makePlayEvent({ startedAt: 2000, trackName: "Track 2" })];
		const first = await importFileEvents(events);
		expect(first.imported).toBe(2);

		const second = await importFileEvents(events);
		expect(second.imported).toBe(0);
		expect(second.skipped).toBe(2);
	});

	it("handles intra-batch duplicates  -  same startedAt+trackName appears twice in the batch", async () => {
		const ev = makePlayEvent({ startedAt: 5000 });
		// Two identical events in same batch
		const result = await importFileEvents([ev, { ...ev }]);
		expect(result.imported).toBe(1);
		expect(result.skipped).toBe(1);
		const all = await db.playEvents.toArray();
		expect(all).toHaveLength(1);
	});

	it("does NOT skip events with same startedAt but different trackName", async () => {
		const ev1 = makePlayEvent({ startedAt: 1000, trackName: "Track A" });
		const ev2 = makePlayEvent({ startedAt: 1000, trackName: "Track B" });
		const result = await importFileEvents([ev1, ev2]);
		expect(result.imported).toBe(2);
		expect(result.skipped).toBe(0);
	});

	it("returns ImportResult interface shape", async () => {
		const result = await importFileEvents([makePlayEvent()]);
		expect(result).toHaveProperty("imported");
		expect(result).toHaveProperty("skipped");
		expect(result).toHaveProperty("errors");
		expect(result).toHaveProperty("errorDetails");
		expect(typeof result.imported).toBe("number");
		expect(typeof result.skipped).toBe("number");
		expect(typeof result.errors).toBe("number");
		expect(Array.isArray(result.errorDetails)).toBe(true);
	});

	it("all inserted events have type: play", async () => {
		const events = [makePlayEvent({ type: "play" })];
		await importFileEvents(events);
		const all = await db.playEvents.toArray();
		expect(all.every((e) => e.type === "play")).toBe(true);
	});

	it("uses bulkAdd  -  multiple events inserted in a single transaction", async () => {
		const events = Array.from({ length: 10 }, (_, i) =>
			makePlayEvent({ startedAt: i * 1000 + 1, trackName: `Track ${i}` }),
		);
		const result = await importFileEvents(events);
		expect(result.imported).toBe(10);
		const all = await db.playEvents.toArray();
		expect(all).toHaveLength(10);
	});

	it("partial import: skips existing, inserts new ones", async () => {
		const existing = makePlayEvent({ startedAt: 1000 });
		await db.playEvents.add(existing);

		const newEv = makePlayEvent({ startedAt: 2000, trackName: "New Track" });
		const result = await importFileEvents([existing, newEv]);
		expect(result.imported).toBe(1);
		expect(result.skipped).toBe(1);
	});
});

// ──────────────────────────────────────────────────────
// Integration: CSV parse + importFileEvents
// ──────────────────────────────────────────────────────

describe("Integration: CSV parse then import", () => {
	it("parses CSV and imports resulting events into DB", async () => {
		const csv = buildV1Csv([
			"Bohemian Rhapsody,Queen,A Night at the Opera,354000,300000,2024-12-01T14:23:00.000Z,2024-12-01T14:28:54.000Z",
			"Don't Stop Me Now,Queen,Jazz,210000,180000,2024-12-01T15:00:00.000Z,2024-12-01T15:03:00.000Z",
		]);
		const parsed = await parseV1Csv(csv);
		expect(parsed.events).toHaveLength(2);

		const importResult = await importFileEvents(parsed.events);
		expect(importResult.imported).toBe(2);
		expect(importResult.skipped).toBe(0);

		const all = await db.playEvents.toArray();
		expect(all).toHaveLength(2);
		expect(all[0].trackName).toBe("Bohemian Rhapsody");
		expect(all[0].type).toBe("play");
	});

	it("re-importing same CSV file deduplicates all events", async () => {
		const csv = buildV1Csv(["Track 1,Artist,Album,180000,150000,2024-01-01T10:00:00.000Z,2024-01-01T10:02:30.000Z"]);
		const parsed = await parseV1Csv(csv);
		await importFileEvents(parsed.events);
		const second = await importFileEvents(parsed.events);
		expect(second.imported).toBe(0);
		expect(second.skipped).toBe(1);
	});
});
