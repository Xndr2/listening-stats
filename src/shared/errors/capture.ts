/**
 * Catches uncaught errors and rejections that come from our own code, logs
 * them and (if the user opted in) reports them. Errors from Spotify or other
 * extensions share the window; their stacks don't mention our bundles, so
 * they are ignored.
 */
import { type ErrorEntry, type ErrorKind, type ErrorSource, logError } from "./log";
import { sendReport } from "./sentry";

// How our bundles show up in stack traces inside Spotify.
const OUR_FRAMES = ["spicetify-routes-listening-stats", "/extensions/listening-stats/"];

export function isOurs(stack: string | undefined): boolean {
	return !!stack && OUR_FRAMES.some((f) => stack.includes(f));
}

/** Log + auto-report. For errors we caught ourselves and want recorded. */
export async function captureError(
	err: unknown,
	source: ErrorSource,
	kind: ErrorKind = "handled",
	where?: string,
): Promise<ErrorEntry> {
	const entry = await logError(err, source, kind, where);
	void sendReport(entry, { manual: false });
	return entry;
}

let installed = false;

export function installGlobalCapture(source: ErrorSource): void {
	if (installed) return;
	installed = true;
	window.addEventListener("error", (e) => {
		const err = e.error ?? e.message;
		const stack = err instanceof Error ? err.stack : `${e.filename}`;
		if (isOurs(stack)) void captureError(err, source, "uncaught");
	});
	window.addEventListener("unhandledrejection", (e) => {
		const reason = e.reason;
		if (reason instanceof Error && isOurs(reason.stack)) void captureError(reason, source, "rejection");
	});
}
