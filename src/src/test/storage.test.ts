import { describe, expect, it } from "vitest";
import { db } from "../shared/storage/db";
import type { PlayEvent } from "../shared/types/play-event";

function makeEvent(startedAt: number): Omit<PlayEvent, "id"> {
	return {
		trackUri: "spotify:track:abc123",
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

describe("Dexie storage (fake-indexeddb)", () => {
	it("adds and retrieves a play event", async () => {
		const event = makeEvent(Date.now());
		const id = await db.playEvents.add(event);
		expect(typeof id).toBe("number");
		const retrieved = await db.playEvents.get(id);
		expect(retrieved).toBeDefined();
		expect(retrieved?.trackUri).toBe(event.trackUri);
		expect(retrieved?.trackName).toBe(event.trackName);
		expect(retrieved?.type).toBe("play");
	});

	it("auto-increments id for each added event", async () => {
		const id1 = await db.playEvents.add(makeEvent(1000));
		const id2 = await db.playEvents.add(makeEvent(2000));
		expect(typeof id1).toBe("number");
		expect(typeof id2).toBe("number");
		expect(id1).not.toBe(id2);
	});

	it("queries by startedAt index using where().between()", async () => {
		await db.playEvents.add(makeEvent(1000));
		await db.playEvents.add(makeEvent(5000));
		const results = await db.playEvents.where("startedAt").between(0, 3000).toArray();
		expect(results).toHaveLength(1);
		expect(results[0].startedAt).toBe(1000);
	});
});
