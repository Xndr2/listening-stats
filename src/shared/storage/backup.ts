import Dexie from "dexie";
import type { PlayEvent } from "../types/play-event";
import { db } from "./db";

const BACKUP_DB_NAME = "listening-stats-backup";

export interface ExportEnvelope {
	version: 1;
	exportedAt: number;
	fromDbVersion: number;
	count: number;
	events: PlayEvent[];
}

export async function exportPlayEvents(): Promise<ExportEnvelope> {
	const events = await db.playEvents.toArray();
	return {
		version: 1,
		exportedAt: Date.now(),
		fromDbVersion: db.verno,
		count: events.length,
		events,
	};
}

export async function importPlayEvents(envelope: ExportEnvelope): Promise<void> {
	if (envelope.version !== 1) {
		throw new Error("Unknown export format version");
	}
	await db.transaction("rw", db.playEvents, async () => {
		await db.playEvents.clear();
		await db.playEvents.bulkAdd(envelope.events);
	});
}

export async function backupToIdb(): Promise<void> {
	const envelope = await exportPlayEvents();
	if (envelope.count === 0) return;
	// Replace prior snapshot (single latest backup)
	await Dexie.delete(BACKUP_DB_NAME);
	const backupDb = new Dexie(BACKUP_DB_NAME);
	backupDb.version(1).stores({ snapshots: "" });
	await backupDb.open();
	await backupDb.table("snapshots").put(envelope, "latest");
	backupDb.close();
}

export async function restoreFromBackupIdb(): Promise<ExportEnvelope | null> {
	try {
		const backupDb = new Dexie(BACKUP_DB_NAME);
		backupDb.version(1).stores({ snapshots: "" });
		await backupDb.open();
		const envelope = await backupDb.table("snapshots").get("latest");
		backupDb.close();
		return envelope ?? null;
	} catch {
		return null;
	}
}

export async function checkBackupExists(): Promise<boolean> {
	try {
		const backupDb = new Dexie(BACKUP_DB_NAME);
		backupDb.version(1).stores({ snapshots: "" });
		await backupDb.open();
		const count = await backupDb.table("snapshots").count();
		backupDb.close();
		return count > 0;
	} catch {
		return false;
	}
}
