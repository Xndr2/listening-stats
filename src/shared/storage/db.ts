import Dexie, { type EntityTable } from "dexie";
import type { PlayEvent } from "../types/play-event";
import type { ArtistRecord } from "../types/stats";

let versionChangeCallback: (() => void) | undefined;

export class ListeningStatsDB extends Dexie {
	playEvents!: EntityTable<PlayEvent, "id">;
	artists!: EntityTable<ArtistRecord, "uri">;

	constructor(onVersionChange?: () => void) {
		super("listening-stats");
		// Version 4 matches existing v1 DB  -  no upgrade callback
		// Dexie opens silently at same version
		this.version(4).stores({
			playEvents: "++id, startedAt, trackUri, artistUri, type",
		});

		// Version 5: artists store for Spotify enrichment
		// CRITICAL: playEvents must be re-listed with identical index spec or Dexie drops it
		this.version(5).stores({
			playEvents: "++id, startedAt, trackUri, artistUri, type",
			artists: "uri, updatedAt",
		});

		this.on("versionchange", (event: IDBVersionChangeEvent) => {
			if (event.newVersion !== null) {
				// Upgrade in another tab: close here so we do not reconnect stale schema
				this.close({ disableAutoOpen: true });
				onVersionChange?.();
				versionChangeCallback?.();
				return false; // Suppress Dexie's default close (we already closed)
			}
			// When newVersion === null the DB is being deleted (e.g. test cleanup
			// via db.delete()). Return undefined so Dexie runs its default handler,
			// which closes the connection and unblocks the delete request.
		});
	}
}

export const db = new ListeningStatsDB();

/** Late-bind versionchange (singleton opens before health): used by initTracker. */
export function registerVersionChangeHandler(callback: () => void): void {
	versionChangeCallback = callback;
}
