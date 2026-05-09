import { LS_KEYS } from "../constants/storage-keys";
import { db } from "./db";
import { checkBackupExists, importPlayEvents, restoreFromBackupIdb } from "./backup";

export interface IntegrityResult {
	ok: boolean;
	wipeDetected: boolean;
	backupAvailable: boolean;
	restored: boolean;
	warning?: string;
}

/**
 * Startup integrity: if lastWrite exists but playEvents is empty (external wipe),
 * try restoring from backup IDB.
 */
export async function runStartupChecks(): Promise<IntegrityResult> {
	const lastWrite = localStorage.getItem(LS_KEYS.LAST_WRITE);

	if (!lastWrite) {
		// No prior write history  -  fresh install, nothing to check
		return { ok: true, wipeDetected: false, backupAvailable: false, restored: false };
	}

	let count: number;
	try {
		count = await db.playEvents.count();
	} catch {
		return {
			ok: false,
			wipeDetected: false,
			backupAvailable: false,
			restored: false,
			warning: "DB not openable",
		};
	}

	if (count > 0) {
		// DB has data  -  healthy
		return { ok: true, wipeDetected: false, backupAvailable: false, restored: false };
	}

	// lastWrite without rows: likely external wipe
	const hasBackup = await checkBackupExists();
	if (hasBackup) {
		const envelope = await restoreFromBackupIdb();
		if (envelope) {
			await importPlayEvents(envelope);
			return { ok: true, wipeDetected: true, backupAvailable: true, restored: true };
		}
	}

	return {
		ok: false,
		wipeDetected: true,
		backupAvailable: false,
		restored: false,
		warning: "Data was wiped externally and no backup exists",
	};
}
