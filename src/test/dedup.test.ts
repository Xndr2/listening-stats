import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../shared/storage/db";
import { addPlayEvent } from "../shared/storage/play-events";
import type { PlayEvent } from "../shared/types/play-event";

function makeEvent(trackUri: string, startedAt: number): Omit<PlayEvent, "id"> {
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

describe("addPlayEvent dedup", () => {
	beforeEach(async () => {
		await db.delete();
		await db.open();
	});

	it("adds event and returns the new id", async () => {
		const event = makeEvent("spotify:track:abc", 10000);
		const result = await addPlayEvent(event);
		expect(result).toEqual(expect.any(Number));
		const count = await db.playEvents.count();
		expect(count).toBe(1);
	});

	it("returns null when same trackUri and startedAt in same 3-second bucket", async () => {
		const startedAt = 10000;
		const event1 = makeEvent("spotify:track:abc", startedAt);
		// startedAt2 = 11000, bucket = floor(11000/3000)*3000 = 9000, same as floor(10000/3000)*3000 = 9000
		const event2 = makeEvent("spotify:track:abc", 11000);

		const result1 = await addPlayEvent(event1);
		expect(result1).toEqual(expect.any(Number));

		const result2 = await addPlayEvent(event2);
		expect(result2).toBeNull();
	});

	it("allows same trackUri in different 3-second bucket", async () => {
		// bucket for 10000 = floor(10000/3000)*3000 = 9000
		// bucket for 13000 = floor(13000/3000)*3000 = 12000  -  different bucket
		const event1 = makeEvent("spotify:track:abc", 10000);
		const event2 = makeEvent("spotify:track:abc", 13000);

		const result1 = await addPlayEvent(event1);
		expect(result1).toEqual(expect.any(Number));

		const result2 = await addPlayEvent(event2);
		expect(result2).toEqual(expect.any(Number));
	});

	it("allows different trackUri in same 3-second bucket", async () => {
		// Both in bucket floor(10000/3000)*3000 = 9000
		const event1 = makeEvent("spotify:track:abc", 10000);
		const event2 = makeEvent("spotify:track:xyz", 11000);

		const result1 = await addPlayEvent(event1);
		expect(result1).toEqual(expect.any(Number));

		const result2 = await addPlayEvent(event2);
		expect(result2).toEqual(expect.any(Number));
	});

	it("does not store duplicate when dedup blocks", async () => {
		const event1 = makeEvent("spotify:track:abc", 10000);
		const event2 = makeEvent("spotify:track:abc", 11000);

		await addPlayEvent(event1);
		await addPlayEvent(event2);

		const count = await db.playEvents.count();
		expect(count).toBe(1);
	});
});
