/**
 * Sends error reports to Sentry without the Sentry SDK: one envelope POST per
 * report. The DSN is public by design (it can only submit events).
 *
 * Automatic reports need the user's opt-in and are capped at 10 a day with
 * one per distinct bug. Manual reports (the Report button) skip the opt-in
 * and the dedup but still count toward the cap.
 */
import { APP_ID, APP_VERSION, SENTRY_DSN } from "../constants/app";
import { getSetting } from "../settings/registry";
import { v3Get, v3Put } from "../storage/v3-db";
import { type ErrorEntry, markReported } from "./log";
import { scrubText } from "./scrub";

const DAILY_CAP = 10;

interface Dsn {
	host: string;
	projectId: string;
	publicKey: string;
	protocol: string;
}

export function parseDsn(dsn: string): Dsn | null {
	const m = dsn.trim().match(/^(https?):\/\/([a-f0-9]+)@([^/]+)\/(\d+)$/i);
	return m ? { protocol: m[1], publicKey: m[2], host: m[3], projectId: m[4] } : null;
}

export function envelopeUrl(d: Dsn): string {
	return `${d.protocol}://${d.host}/api/${d.projectId}/envelope/?sentry_key=${d.publicKey}&sentry_version=7&sentry_client=${APP_ID}%2F${APP_VERSION}`;
}

function hex32(): string {
	const b = new Uint8Array(16);
	crypto.getRandomValues(b);
	return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Chrome stack lines -> Sentry frames, oldest call first. */
export function parseFrames(
	stack: string,
): Array<{ function: string; filename: string; lineno?: number; colno?: number }> {
	const frames = [];
	for (const line of stack.split("\n")) {
		const m = line.trim().match(/^at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/);
		if (m) frames.push({ function: m[1] ?? "?", filename: m[2], lineno: Number(m[3]), colno: Number(m[4]) });
	}
	return frames.reverse();
}

export function buildEnvelope(entry: ErrorEntry, dsn: string, userMessage?: string, now = Date.now()): string {
	const eventId = hex32();
	const isReport = entry.kind === "report";
	const event = {
		event_id: eventId,
		// When it was reported, so Sentry sorts by that; when it happened goes in extra.
		timestamp: now / 1000,
		platform: "javascript",
		level: isReport ? "info" : "error",
		logger: entry.source,
		release: `${APP_ID}@${entry.appVersion}`,
		environment: entry.appVersion.includes("dev") ? "development" : "production",
		fingerprint: [entry.fingerprint],
		tags: {
			source: entry.source,
			kind: entry.kind,
			where: entry.where ?? "none",
			provider: entry.provider,
			spotify: entry.spotifyVersion,
			spicetify: entry.spicetifyVersion,
			manual: userMessage !== undefined ? "yes" : "no",
		},
		// A user report without an error is a message, not a fake exception.
		...(isReport
			? { message: { formatted: "User report" } }
			: {
					exception: {
						values: [
							{
								type: entry.name,
								value: entry.message,
								stacktrace: { frames: parseFrames(entry.stack) },
								// Only errors LS caught and expected count as handled; crashes show as unhandled.
								mechanism: { type: entry.kind, handled: entry.kind === "handled" },
							},
						],
					},
				}),
		breadcrumbs: { values: entry.breadcrumbs.map((message) => ({ message })) },
		// Without these Sentry fills in the sender's IP address (and a location from it).
		user: { ip_address: null, geo: {} },
		sdk: { name: APP_ID, version: APP_VERSION, settings: { infer_ip: "never" } },
		extra: {
			occurredAt: new Date(entry.at).toISOString(),
			...(userMessage ? { userMessage: scrubText(userMessage).slice(0, 2000) } : {}),
		},
	};
	const header = { event_id: eventId, sent_at: new Date().toISOString(), dsn };
	return `${JSON.stringify(header)}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}\n`;
}

interface Quota {
	day: string;
	count: number;
	fingerprints: string[];
}

const today = () => new Date().toISOString().slice(0, 10);

async function readQuota(): Promise<Quota> {
	const q = await v3Get<Quota>("meta", "sentry-quota").catch(() => undefined);
	return q && q.day === today() ? q : { day: today(), count: 0, fingerprints: [] };
}

export type SendResult = "sent" | "not-configured" | "opted-out" | "duplicate" | "limit" | "failed";

export function isReportingConfigured(): boolean {
	return parseDsn(SENTRY_DSN) !== null;
}

/**
 * `manual` = the user pressed Report (with an optional note). Otherwise this
 * is an automatic report and only goes out if the user opted in.
 */
export async function sendReport(
	entry: ErrorEntry,
	opts: { manual: boolean; userMessage?: string; dsn?: string } = { manual: false },
): Promise<SendResult> {
	const dsnString = opts.dsn ?? SENTRY_DSN;
	const dsn = parseDsn(dsnString);
	if (!dsn) return "not-configured";
	if (!opts.manual && !getSetting("autoCrashReports")) return "opted-out";
	const quota = await readQuota();
	if (!opts.manual && quota.fingerprints.includes(entry.fingerprint)) return "duplicate";
	if (quota.count >= DAILY_CAP) return "limit";
	try {
		const res = await fetch(envelopeUrl(dsn), {
			method: "POST",
			// text/plain keeps this a "simple" request: no CORS preflight
			headers: { "Content-Type": "text/plain;charset=UTF-8" },
			body: buildEnvelope(entry, dsnString, opts.manual ? (opts.userMessage ?? "") : undefined),
		});
		if (!res.ok) return "failed";
	} catch {
		return "failed";
	}
	if (entry.id !== undefined) await markReported(entry.id).catch(() => {});
	await v3Put(
		"meta",
		{ day: quota.day, count: quota.count + 1, fingerprints: [...quota.fingerprints, entry.fingerprint] },
		"sentry-quota",
	).catch(() => {});
	return "sent";
}
