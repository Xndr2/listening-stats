/**
 * fetch with a timeout, abort support, typed errors and a per-host circuit
 * breaker: after 3 failures in a row a host is left alone for a minute
 * instead of hammering it while it's down or rate limiting us.
 */

export type HttpErrorKind =
	| "offline"
	| "timeout"
	| "rate-limited"
	| "not-found"
	| "auth"
	| "server"
	| "bad-response"
	| "circuit-open";

export class HttpError extends Error {
	constructor(
		public kind: HttpErrorKind,
		message: string,
		public status?: number,
		public retryAfterMs?: number,
	) {
		super(message);
		this.name = "HttpError";
	}
}

interface Breaker {
	failures: number;
	openUntil: number;
}

const breakers = new Map<string, Breaker>();
const FAILURES_TO_OPEN = 3;
const OPEN_MS = 60_000;

function breakerFor(host: string): Breaker {
	let b = breakers.get(host);
	if (!b) {
		b = { failures: 0, openUntil: 0 };
		breakers.set(host, b);
	}
	return b;
}

export async function getJson<T>(
	url: string,
	opts: { signal?: AbortSignal; timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T> {
	const host = new URL(url).host;
	const b = breakerFor(host);
	if (Date.now() < b.openUntil) throw new HttpError("circuit-open", `${host} is paused after repeated failures`);

	const ctrl = new AbortController();
	const timer = setTimeout(
		() => ctrl.abort(new HttpError("timeout", `${host} took too long`)),
		opts.timeoutMs ?? 15_000,
	);
	const onAbort = () => ctrl.abort(opts.signal?.reason);
	opts.signal?.addEventListener("abort", onAbort);

	const fail = (e: HttpError): never => {
		// Our own mistakes (404, bad key) don't mean the host is down.
		if (e.kind !== "not-found" && e.kind !== "auth") {
			b.failures++;
			if (b.failures >= FAILURES_TO_OPEN) b.openUntil = Date.now() + (e.retryAfterMs ?? OPEN_MS);
		}
		throw e;
	};

	try {
		let res: Response;
		try {
			res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json", ...opts.headers } });
		} catch (err) {
			if (opts.signal?.aborted) throw err; // caller cancelled: not a host failure
			if (err instanceof HttpError) return fail(err);
			if (ctrl.signal.reason instanceof HttpError) return fail(ctrl.signal.reason);
			return fail(new HttpError("offline", `Couldn't reach ${host}`));
		}
		if (res.status === 429) {
			const retry = Number(res.headers.get("retry-after"));
			return fail(
				new HttpError("rate-limited", `${host} asked us to slow down`, 429, retry > 0 ? retry * 1000 : undefined),
			);
		}
		if (res.status === 404) return fail(new HttpError("not-found", `Not found on ${host}`, 404));
		if (res.status === 401 || res.status === 403)
			return fail(new HttpError("auth", `${host} refused access`, res.status));
		if (!res.ok) return fail(new HttpError("server", `${host} returned ${res.status}`, res.status));
		let body: T;
		try {
			body = (await res.json()) as T;
		} catch {
			return fail(new HttpError("bad-response", `${host} sent something unreadable`));
		}
		b.failures = 0;
		return body;
	} finally {
		clearTimeout(timer);
		opts.signal?.removeEventListener("abort", onAbort);
	}
}
