/**
 * The local error log: the last 200 errors, scrubbed, in the v3 database.
 * The diagnostics screen reads it; reports are built from it.
 */
import { APP_VERSION, LOG_PREFIX } from "../constants/app";
import { EVENTS, emit } from "../constants/events";
import { getSetting } from "../settings/registry";
import { req, txDone } from "../storage/idb";
import { getV3Db } from "../storage/v3-db";
import { scrubText } from "./scrub";

export const MAX_ENTRIES = 200;

export type ErrorSource = "app" | "extension";
/** "report" = a user report with no error attached; never stored in the log. */
export type ErrorKind = "uncaught" | "rejection" | "widget" | "handled" | "report";

export interface ErrorEntry {
	id?: number;
	at: number;
	source: ErrorSource;
	kind: ErrorKind;
	/** Where it happened, e.g. a widget id or "tracker". Never user content. */
	where?: string;
	name: string;
	message: string;
	stack: string;
	fingerprint: string;
	appVersion: string;
	spotifyVersion: string;
	spicetifyVersion: string;
	provider: string;
	breadcrumbs: string[];
	/** When this entry was last sent to Sentry. */
	reportedAt?: number;
}

// Event names only ("period:this-week", "provider:statsfm"), never content.
const breadcrumbs: string[] = [];
export function addBreadcrumb(event: string): void {
	breadcrumbs.push(`${new Date().toISOString().slice(11, 19)} ${event}`);
	if (breadcrumbs.length > 20) breadcrumbs.shift();
}

function spotifyVersion(): string {
	return navigator.userAgent.match(/Spotify\/([\d.]+)/)?.[1] ?? "unknown";
}

/** Stable id for "the same bug": error name + message without numbers + first frame. */
export function fingerprintOf(name: string, message: string, stack: string): string {
	const firstFrame = stack.split("\n").find((l) => l.trim().startsWith("at ")) ?? "";
	const base = `${name}|${message.replace(/\d+/g, "#")}|${firstFrame.replace(/:\d+:\d+/g, "")}`;
	let h = 5381;
	for (let i = 0; i < base.length; i++) h = ((h << 5) + h + base.charCodeAt(i)) | 0;
	return (h >>> 0).toString(36);
}

export function toEntry(err: unknown, source: ErrorSource, kind: ErrorKind, where?: string): ErrorEntry {
	const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : safeString(err));
	const name = e.name || "Error";
	const message = scrubText(e.message || "");
	const stack = scrubText(e.stack || "");
	return {
		at: Date.now(),
		source,
		kind,
		where,
		name,
		message,
		stack,
		fingerprint: fingerprintOf(name, message, stack),
		appVersion: APP_VERSION,
		spotifyVersion: spotifyVersion(),
		spicetifyVersion:
			(globalThis as { Spicetify?: { Config?: { version?: string } } }).Spicetify?.Config?.version ?? "?",
		provider: getSetting("activeProvider"),
		breadcrumbs: breadcrumbs.map((b) => scrubText(b)),
	};
}

function safeString(v: unknown): string {
	try {
		return JSON.stringify(v) ?? String(v);
	} catch {
		return String(v);
	}
}

/** Stores an error. Never throws: a broken log must not cause more errors. */
export async function logError(
	err: unknown,
	source: ErrorSource,
	kind: ErrorKind,
	where?: string,
): Promise<ErrorEntry> {
	const entry = toEntry(err, source, kind, where);
	console.error(`${LOG_PREFIX} ${where ? `[${where}] ` : ""}${entry.name}: ${entry.message}`, err);
	try {
		const db = await getV3Db();
		const tx = db.transaction("errors", "readwrite");
		const store = tx.objectStore("errors");
		entry.id = (await req(store.add(entry))) as number;
		const count = await req(store.count());
		if (count > MAX_ENTRIES) {
			const keys = await req(store.getAllKeys(null, count - MAX_ENTRIES));
			for (const k of keys) store.delete(k);
		}
		await txDone(tx);
		emit(EVENTS.ERROR_LOGGED, entry);
	} catch {
		// IndexedDB unavailable: console output above is all we can do
	}
	return entry;
}

/**
 * Newest first. The store's keys are out-of-line (autoIncrement, no keyPath),
 * so the stored values don't carry them; each entry gets its key back as `id`.
 */
export async function getErrors(): Promise<ErrorEntry[]> {
	const db = await getV3Db();
	const store = db.transaction("errors").objectStore("errors");
	const [keys, values] = await Promise.all([req(store.getAllKeys()), req(store.getAll())]);
	return (values as ErrorEntry[]).map((e, i) => ({ ...e, id: keys[i] as number })).reverse();
}

async function changeEntry(id: number, change: (e: ErrorEntry) => ErrorEntry | null): Promise<void> {
	const db = await getV3Db();
	const tx = db.transaction("errors", "readwrite");
	const store = tx.objectStore("errors");
	const current = (await req(store.get(id))) as ErrorEntry | undefined;
	if (current) {
		const next = change(current);
		if (next) store.put(next, id);
		else store.delete(id);
	}
	await txDone(tx);
	emit(EVENTS.ERROR_LOGGED, null);
}

export function markReported(id: number, at = Date.now()): Promise<void> {
	return changeEntry(id, (e) => ({ ...e, reportedAt: at }));
}

export function deleteError(id: number): Promise<void> {
	return changeEntry(id, () => null);
}

export async function clearErrors(): Promise<void> {
	const db = await getV3Db();
	const tx = db.transaction("errors", "readwrite");
	tx.objectStore("errors").clear();
	await txDone(tx);
}
