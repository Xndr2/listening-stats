import type { Transaction } from "dexie";
import { LS_KEYS } from "../constants/storage-keys";
import { backupToIdb } from "./backup";
import { db } from "./db";

export type UpgradeCallback = (tx: Transaction, oldVersion: number) => void | Promise<void>;

export interface MigrationRegistry {
	[targetVersion: number]: UpgradeCallback;
}

export const MIGRATIONS: MigrationRegistry = {
	5: async (_tx, _oldVersion) => {
		// Schema creation handled by Dexie's version(5).stores() declaration.
		// No data migration needed  -  artists store starts empty.
	},
};

const TARGET_VERSION = 5;

/**
 * Backup play events before opening when stored IDB version < TARGET_VERSION.
 * No-op for current prod schema; kept for future version bumps (tests cover it).
 */
export async function backupIfUpgradeNeeded(currentVersion: number): Promise<void> {
	if (currentVersion >= TARGET_VERSION || currentVersion === 0) return;
	await backupToIdb();
}

/**
 * Detects the current stored version of the listening-stats DB.
 * Returns 0 if the DB doesn't exist (fresh install).
 * Uses indexedDB.databases() with fallback for older Chromium.
 */
async function detectCurrentDbVersion(): Promise<number> {
	try {
		if (typeof indexedDB.databases === "function") {
			const dbs = await indexedDB.databases();
			const entry = dbs.find((d) => d.name === "listening-stats");
			return entry?.version ?? 0;
		}
	} catch {
		// indexedDB.databases() not available  -  fall through
	}
	// Fallback: if db is already open, use its version
	if (db.isOpen()) return db.verno;
	return 0;
}

/**
 * Initializes the database: runs pre-upgrade backup if needed, opens the DB.
 * Sets MIGRATION_PENDING before open; clears on success. On failure, retry next open.
 * Returns the db instance for chaining.
 */
export async function initDatabase(): Promise<typeof db> {
	if (!db.isOpen()) {
		const currentVersion = await detectCurrentDbVersion();
		await backupIfUpgradeNeeded(currentVersion);
		localStorage.setItem(LS_KEYS.MIGRATION_PENDING, "1");
		try {
			await db.open();
			localStorage.removeItem(LS_KEYS.MIGRATION_PENDING);
		} catch (err) {
			console.error("[listening-stats] DB upgrade failed, will retry on next open", err);
			// Leave flag set so the next open retries
		}
	}
	return db;
}
