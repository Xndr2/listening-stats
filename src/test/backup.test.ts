import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type ExportEnvelope,
	backupToIdb,
	checkBackupExists,
	exportPlayEvents,
	importPlayEvents,
	restoreFromBackupIdb,
} from "../shared/storage/backup";
import { db } from "../shared/storage/db";
import type { PlayEvent } from "../shared/types/play-event";

function makeEvent(startedAt: number, trackUri = "spotify:track:abc123"): Omit<PlayEvent, "id"> {
	return {
		trackUri,
		trackName: "Test Track",
		artistName: "Test Artist",
		artistUri: "spotify:artist:xyz",
		albumName: "Test Album",
		albumUri: "spotify:album:def",
		albumArt: "https://example.com/art.jpg",
		durationMs: 180000,
		playedMs: 120000,
		startedAt,
		endedAt: startedAt + 120000,
		type: "play",
	};
}

afterEach(async () => {
	await Dexie.delete("listening-stats-backup");
});

describe("backup module", () => {
	describe("exportPlayEvents", () => {
		it("returns envelope with count: 0 and empty events array when no records", async () => {
			const envelope = await exportPlayEvents();
			expect(envelope.version).toBe(1);
			expect(envelope.count).toBe(0);
			expect(envelope.events).toEqual([]);
			expect(typeof envelope.exportedAt).toBe("number");
			expect(typeof envelope.fromDbVersion).toBe("number");
		});

		it("returns envelope with count: 3 and all 3 events with ids preserved", async () => {
			const id1 = await db.playEvents.add(makeEvent(1000));
			const id2 = await db.playEvents.add(makeEvent(2000));
			const id3 = await db.playEvents.add(makeEvent(3000));

			const envelope = await exportPlayEvents();
			expect(envelope.version).toBe(1);
			expect(envelope.count).toBe(3);
			expect(envelope.events).toHaveLength(3);

			const ids = envelope.events.map((e) => e.id);
			expect(ids).toContain(id1);
			expect(ids).toContain(id2);
			expect(ids).toContain(id3);
		});

		it("includes version, exportedAt, fromDbVersion, count, and events fields", async () => {
			const envelope = await exportPlayEvents();
			expect(envelope).toHaveProperty("version", 1);
			expect(envelope).toHaveProperty("exportedAt");
			expect(envelope).toHaveProperty("fromDbVersion");
			expect(envelope).toHaveProperty("count");
			expect(envelope).toHaveProperty("events");
		});
	});

	describe("importPlayEvents", () => {
		it("clears store and bulk-inserts all events from a valid envelope", async () => {
			// Pre-populate DB with 2 existing events
			await db.playEvents.add(makeEvent(500));
			await db.playEvents.add(makeEvent(600));

			// Build an envelope with 3 different events
			const events: PlayEvent[] = [
				{ ...makeEvent(1000), id: 10 },
				{ ...makeEvent(2000), id: 11 },
				{ ...makeEvent(3000), id: 12 },
			];
			const envelope: ExportEnvelope = {
				version: 1,
				exportedAt: Date.now(),
				fromDbVersion: 4,
				count: events.length,
				events,
			};

			await importPlayEvents(envelope);

			const count = await db.playEvents.count();
			expect(count).toBe(3);
		});

		it("throws 'Unknown export format version' for unknown version", async () => {
			const envelope = {
				version: 99,
				exportedAt: Date.now(),
				fromDbVersion: 4,
				count: 0,
				events: [],
			} as unknown as ExportEnvelope;

			await expect(importPlayEvents(envelope)).rejects.toThrow(
				"Unknown export format version",
			);
		});

		it("count() equals envelope.count after import", async () => {
			const events: PlayEvent[] = [
				{ ...makeEvent(1000), id: 1 },
				{ ...makeEvent(2000), id: 2 },
			];
			const envelope: ExportEnvelope = {
				version: 1,
				exportedAt: Date.now(),
				fromDbVersion: 4,
				count: events.length,
				events,
			};

			await importPlayEvents(envelope);

			const count = await db.playEvents.count();
			expect(count).toBe(envelope.count);
		});
	});

	describe("backupToIdb / restoreFromBackupIdb / checkBackupExists", () => {
		beforeEach(async () => {
			// Ensure the main DB is populated for backup tests
			await db.playEvents.add(makeEvent(1000));
			await db.playEvents.add(makeEvent(2000));
		});

		it("backupToIdb writes to listening-stats-backup IDB; checkBackupExists returns true", async () => {
			await backupToIdb();
			const exists = await checkBackupExists();
			expect(exists).toBe(true);
		});

		it("backupToIdb overwrites previous backup (only one backup kept)", async () => {
			await backupToIdb();
			// Add more events and backup again
			await db.playEvents.add(makeEvent(3000));
			await backupToIdb();

			// restoreFromBackupIdb should return the latest backup
			const envelope = await restoreFromBackupIdb();
			expect(envelope).not.toBeNull();
			// The latest backup should have 3 events
			expect(envelope?.count).toBe(3);
		});

		it("restoreFromBackupIdb returns the ExportEnvelope that was backed up", async () => {
			await backupToIdb();
			const envelope = await restoreFromBackupIdb();
			expect(envelope).not.toBeNull();
			expect(envelope?.version).toBe(1);
			expect(envelope?.count).toBe(2);
			expect(envelope?.events).toHaveLength(2);
		});

		it("restoreFromBackupIdb returns null when no backup exists", async () => {
			// No backup was created in this test
			const envelope = await restoreFromBackupIdb();
			expect(envelope).toBeNull();
		});

		it("checkBackupExists returns false when no backup IDB data exists", async () => {
			const exists = await checkBackupExists();
			expect(exists).toBe(false);
		});
	});
});
