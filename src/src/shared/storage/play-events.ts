import type { PlayEvent } from "../types/play-event";
import { db } from "./db";

/**
 * Insert play event with 3s time-bucket dedup (same trackUri in bucket → skip).
 * Buckets use event.startedAt, not wall clock.
 * Returns the new event id, or null when deduped.
 */
export async function addPlayEvent(event: PlayEvent): Promise<number | null> {
	const bucketStart = Math.floor(event.startedAt / 3000) * 3000;
	const bucketEnd = bucketStart + 3000;

	// Transaction makes the dedup check + insert atomic, so two concurrent
	// calls can't both pass the check and double-record the same play.
	return db.transaction("rw", db.playEvents, async () => {
		const existingCount = await db.playEvents
			.where("startedAt")
			.between(bucketStart, bucketEnd)
			.filter((e) => e.trackUri === event.trackUri)
			.count();

		if (existingCount > 0) {
			return null;
		}

		return (await db.playEvents.add(event)) ?? null;
	});
}

/**
 * Updates the final play time of an event that was written the moment it
 * crossed the play threshold (the track kept playing after the write).
 */
export async function updatePlayEventPlaytime(id: number, playedMs: number, endedAt: number): Promise<void> {
	await db.playEvents.update(id, { playedMs, endedAt });
}
