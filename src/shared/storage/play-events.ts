import type { PlayEvent } from "../types/play-event";
import { db } from "./db";

/**
 * Insert play event with 3s time-bucket dedup (same trackUri in bucket → skip).
 * Buckets use event.startedAt, not wall clock.
 */
export async function addPlayEvent(event: PlayEvent): Promise<boolean> {
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
      return false;
    }

    await db.playEvents.add(event);
    return true;
  });
}
