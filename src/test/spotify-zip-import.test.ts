import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parseSpotifyZip } from "../shared/storage/spotify-zip";

// ──────────────────────────────────────────────────────
// Minimal zip writer (test-only): stored or deflate entries
// ──────────────────────────────────────────────────────

interface TestZipFile {
	name: string;
	content: string;
	deflate?: boolean;
}

function buildZip(files: TestZipFile[]): ArrayBuffer {
	const encoder = new TextEncoder();
	const localParts: Uint8Array[] = [];
	const centralParts: Uint8Array[] = [];
	let offset = 0;

	for (const file of files) {
		const nameBytes = encoder.encode(file.name);
		const raw = encoder.encode(file.content);
		const data = file.deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
		const method = file.deflate ? 8 : 0;

		const local = new Uint8Array(30 + nameBytes.length);
		const lv = new DataView(local.buffer);
		lv.setUint32(0, 0x04034b50, true);
		lv.setUint16(4, 20, true);
		lv.setUint16(8, method, true);
		lv.setUint32(18, data.length, true);
		lv.setUint32(22, raw.length, true);
		lv.setUint16(26, nameBytes.length, true);
		local.set(nameBytes, 30);
		localParts.push(local, data);

		const central = new Uint8Array(46 + nameBytes.length);
		const cv = new DataView(central.buffer);
		cv.setUint32(0, 0x02014b50, true);
		cv.setUint16(4, 20, true);
		cv.setUint16(6, 20, true);
		cv.setUint16(10, method, true);
		cv.setUint32(20, data.length, true);
		cv.setUint32(24, raw.length, true);
		cv.setUint16(28, nameBytes.length, true);
		cv.setUint32(42, offset, true);
		central.set(nameBytes, 46);
		centralParts.push(central);

		offset += local.length + data.length;
	}

	const centralSize = centralParts.reduce((n, p) => n + p.length, 0);
	const eocd = new Uint8Array(22);
	const ev = new DataView(eocd.buffer);
	ev.setUint32(0, 0x06054b50, true);
	ev.setUint16(8, files.length, true);
	ev.setUint16(10, files.length, true);
	ev.setUint32(12, centralSize, true);
	ev.setUint32(16, offset, true);

	const total = [...localParts, ...centralParts, eocd];
	const out = new Uint8Array(offset + centralSize + 22);
	let pos = 0;
	for (const part of total) {
		out.set(part, pos);
		pos += part.length;
	}
	return out.buffer;
}

// ──────────────────────────────────────────────────────
// Record fixtures
// ──────────────────────────────────────────────────────

function musicRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		ts: "2024-03-01T12:00:00Z",
		platform: "linux",
		ms_played: 200_000,
		conn_country: "BE",
		ip_addr: "1.2.3.4",
		master_metadata_track_name: "Test Track",
		master_metadata_album_artist_name: "Test Artist",
		master_metadata_album_album_name: "Test Album",
		spotify_track_uri: "spotify:track:abc123",
		episode_name: null,
		episode_show_name: null,
		spotify_episode_uri: null,
		reason_start: "clickrow",
		reason_end: "trackdone",
		shuffle: false,
		skipped: false,
		offline: false,
		offline_timestamp: null,
		incognito_mode: false,
		...overrides,
	};
}

describe("parseSpotifyZip", () => {
	it("parses music plays from an extended streaming history zip", async () => {
		const zip = buildZip([
			{
				name: "Spotify Extended Streaming History/Streaming_History_Audio_2024_0.json",
				content: JSON.stringify([musicRecord()]),
			},
		]);
		const result = await parseSpotifyZip(zip);
		expect(result.filesRead).toBe(1);
		expect(result.errors).toBe(0);
		expect(result.events).toHaveLength(1);

		const event = result.events[0];
		expect(event.trackName).toBe("Test Track");
		expect(event.artistName).toBe("Test Artist");
		expect(event.albumName).toBe("Test Album");
		expect(event.trackUri).toBe("spotify:track:abc123");
		expect(event.playedMs).toBe(200_000);
		// ts is stream END time: startedAt = ts - ms_played
		expect(event.endedAt).toBe(Date.parse("2024-03-01T12:00:00Z"));
		expect(event.startedAt).toBe(Date.parse("2024-03-01T12:00:00Z") - 200_000);
		expect(event.type).toBe("play");
	});

	it("reads deflate-compressed entries", async () => {
		const zip = buildZip([
			{
				name: "Streaming_History_Audio_2023_0.json",
				content: JSON.stringify([musicRecord()]),
				deflate: true,
			},
		]);
		const result = await parseSpotifyZip(zip);
		expect(result.events).toHaveLength(1);
	});

	it("supports older endsong_N.json file names", async () => {
		const zip = buildZip([{ name: "MyData/endsong_0.json", content: JSON.stringify([musicRecord()]) }]);
		const result = await parseSpotifyZip(zip);
		expect(result.events).toHaveLength(1);
	});

	it("classifies sub-30s streams as skips", async () => {
		const zip = buildZip([
			{
				name: "Streaming_History_Audio_2024_0.json",
				content: JSON.stringify([musicRecord({ ms_played: 5_000 })]),
			},
		]);
		const result = await parseSpotifyZip(zip);
		expect(result.events).toHaveLength(1);
		expect(result.events[0].type).toBe("skip");
	});

	it("ignores podcasts, zero-ms rows and null-metadata rows", async () => {
		const records = [
			musicRecord(),
			musicRecord({
				master_metadata_track_name: null,
				spotify_track_uri: null,
				episode_name: "Podcast Ep 1",
				spotify_episode_uri: "spotify:episode:xyz",
			}),
			musicRecord({ ms_played: 0 }),
			musicRecord({
				master_metadata_track_name: null,
				master_metadata_album_artist_name: null,
				master_metadata_album_album_name: null,
				spotify_track_uri: null,
			}),
		];
		const zip = buildZip([{ name: "Streaming_History_Audio_2024_0.json", content: JSON.stringify(records) }]);
		const result = await parseSpotifyZip(zip);
		expect(result.events).toHaveLength(1);
		expect(result.ignored).toBe(3);
		expect(result.errors).toBe(0);
	});

	it("skips video history files", async () => {
		const zip = buildZip([
			{ name: "Streaming_History_Video_2024.json", content: JSON.stringify([musicRecord()]) },
			{ name: "Streaming_History_Audio_2024_0.json", content: JSON.stringify([musicRecord()]) },
		]);
		const result = await parseSpotifyZip(zip);
		expect(result.filesRead).toBe(1);
		expect(result.events).toHaveLength(1);
	});

	it("generates synthetic URIs when spotify_track_uri is null", async () => {
		const zip = buildZip([
			{
				name: "Streaming_History_Audio_2024_0.json",
				content: JSON.stringify([musicRecord({ spotify_track_uri: null })]),
			},
		]);
		const result = await parseSpotifyZip(zip);
		expect(result.events[0].trackUri).toMatch(/^listening-stats:track:/);
	});

	it("dedupes identical records across files (offline-sync artifacts)", async () => {
		const record = musicRecord();
		const zip = buildZip([
			{ name: "Streaming_History_Audio_2023_0.json", content: JSON.stringify([record]) },
			{ name: "Streaming_History_Audio_2023-2024_1.json", content: JSON.stringify([record]) },
		]);
		const result = await parseSpotifyZip(zip);
		expect(result.filesRead).toBe(2);
		expect(result.events).toHaveLength(1);
	});

	it("counts invalid ts as an error row", async () => {
		const zip = buildZip([
			{
				name: "Streaming_History_Audio_2024_0.json",
				content: JSON.stringify([musicRecord({ ts: "not-a-date" }), musicRecord()]),
			},
		]);
		const result = await parseSpotifyZip(zip);
		expect(result.events).toHaveLength(1);
		expect(result.errors).toBe(1);
	});

	it("rejects the Account data export with specific guidance", async () => {
		const zip = buildZip([
			{
				name: "MyData/StreamingHistory_music_0.json",
				content: JSON.stringify([{ endTime: "2024-03-01 12:00", artistName: "A", trackName: "T", msPlayed: 60000 }]),
			},
		]);
		await expect(parseSpotifyZip(zip)).rejects.toThrow(/Extended streaming history/);
	});

	it("rejects a zip without history files", async () => {
		const zip = buildZip([{ name: "Playlist1.json", content: "[]" }]);
		await expect(parseSpotifyZip(zip)).rejects.toThrow(/no streaming history/);
	});

	it("rejects a non-zip buffer", async () => {
		await expect(parseSpotifyZip(new TextEncoder().encode("not a zip").buffer as ArrayBuffer)).rejects.toThrow(
			/not a valid zip/,
		);
	});
});
