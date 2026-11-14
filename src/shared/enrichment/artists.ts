/**
 * Looks up genres and images for artists in the local history.
 *
 * First choice is Spotify's own Web API with the client's token (nothing goes
 * to anyone but Spotify). Spotify often throttles that token for long
 * stretches, so when allowed, stats.fm's public search is used instead: it
 * gets artist names (never a username) and results are only accepted when
 * the Spotify artist id matches exactly. That second source is used when the
 * user connected stats.fm or turned on "genres via stats.fm".
 */
import { LOG_PREFIX } from "../constants/app";
import { getJson } from "../net/http";
import { isConnected } from "../providers/registry";
import { getSetting } from "../settings/registry";
import { allArtistRecords, putArtistRecords } from "../storage/artists";
import { forEachPlayEventChunk } from "../storage/play-events";
import type { ArtistRecord } from "../types/play-event";

const BATCH = 50;
const STALE_MS = 30 * 86_400_000;
let pausedUntil = 0;

interface WebArtist {
	id: string;
	name: string;
	genres?: string[];
	images?: Array<{ url: string; width?: number }>;
}

export class RateLimited extends Error {
	constructor(
		public retryAfterMs: number,
		message = `Spotify asked to wait ${Math.round(retryAfterMs / 1000)}s`,
	) {
		super(message);
	}
}

/** Retry gap when Spotify's API can't be reached (offline, blocked). */
const UNREACHABLE_RETRY_MS = 5 * 60_000;

function token(): string | undefined {
	try {
		return Spicetify.Platform?.AuthorizationAPI?.getState?.()?.token?.accessToken;
	} catch {
		return undefined;
	}
}

/** One Web API call for up to 50 artist ids. */
export async function fetchArtists(ids: string[]): Promise<WebArtist[]> {
	const t = token();
	if (!t) throw new Error("No Spotify session token");
	// A network failure is expected now and then; it waits like a rate limit
	// instead of being reported as a crash.
	const res = await fetch(`https://api.spotify.com/v1/artists?ids=${ids.join(",")}`, {
		headers: { Authorization: `Bearer ${t}` },
	}).catch(() => {
		throw new RateLimited(UNREACHABLE_RETRY_MS, "Couldn't reach Spotify, retrying in 5 minutes");
	});
	if (res.status === 429) throw new RateLimited((Number(res.headers.get("retry-after")) || 60) * 1000);
	// The session token expired between reading and use; Spotify renews it itself.
	if (res.status === 401) throw new RateLimited(60_000, "Spotify session expired, retrying in a minute");
	if (!res.ok) throw new Error(`Spotify artist lookup failed (${res.status})`);
	const body = (await res.json()) as { artists?: Array<WebArtist | null> };
	return (body.artists ?? []).filter((a): a is WebArtist => !!a && typeof a.id === "string");
}

async function artistsNeedingLookupWithNames(now = Date.now(), since = 0): Promise<Map<string, string>> {
	const records = await allArtistRecords();
	const want = new Map<string, string>();
	await forEachPlayEventChunk(since, now + 1, (rows) => {
		for (const e of rows) {
			// Imported rows can carry odd ids; one bad id fails the whole batch of 50.
			if (!/^spotify:artist:[A-Za-z0-9]{22}$/.test(e.artistUri)) continue;
			const r = records.get(e.artistUri);
			if (!r || now - r.updatedAt > STALE_MS) want.set(e.artistUri, e.artistName.split(",")[0]?.trim() ?? "");
		}
	});
	return want;
}

function toRecord(a: WebArtist, now: number): ArtistRecord {
	const img = [...(a.images ?? [])].sort((x, y) => (x.width ?? 0) - (y.width ?? 0)).find((i) => (i.width ?? 0) >= 160);
	return {
		uri: `spotify:artist:${a.id}`,
		name: a.name,
		genres: Array.isArray(a.genres) ? a.genres.filter((g) => typeof g === "string") : [],
		imageUrl: img?.url ?? a.images?.[0]?.url ?? null,
		updatedAt: now,
	};
}

/** Whether artist names may go to stats.fm for genre lookups. */
export function statsFmGenresAllowed(): boolean {
	return getSetting("genresViaStatsFm") || isConnected("statsfm");
}

interface SfmSearchArtist {
	name: string;
	genres?: string[];
	image?: string | null;
	externalIds?: { spotify?: string[] };
}

/** One artist through stats.fm search, accepted only on an exact Spotify id match. */
export async function lookupViaStatsFm(uri: string, name: string): Promise<ArtistRecord> {
	const id = uri.slice("spotify:artist:".length);
	const qs = new URLSearchParams({ query: name, type: "artist", limit: "10" });
	const body = await getJson<{ items?: { artists?: SfmSearchArtist[] } }>(
		`https://api.stats.fm/api/v1/search/elastic?${qs}`,
	);
	const hit = body?.items?.artists?.find((a) => a.externalIds?.spotify?.includes(id));
	// No match is saved too (empty genres), so the artist isn't searched again for a month.
	return {
		uri,
		name,
		genres: hit?.genres?.filter((g) => typeof g === "string") ?? [],
		imageUrl: hit?.image ?? null,
		updatedAt: Date.now(),
	};
}

const STATSFM_PER_RUN = 60;

/**
 * Looks up at most `maxBatches` Spotify batches, then (when allowed) up to
 * 60 more artists through stats.fm. Returns how many artists were saved.
 */
export async function enrichArtists(
	maxBatches = 4,
	lookup = fetchArtists,
	viaStatsFm = lookupViaStatsFm,
): Promise<number> {
	const need = await artistsNeedingLookupWithNames();
	const uris = [...need.keys()];
	let saved = 0;
	let next = 0;
	if (Date.now() >= pausedUntil) {
		for (; next < uris.length && next / BATCH < maxBatches; next += BATCH) {
			const ids = uris.slice(next, next + BATCH).map((u) => u.slice("spotify:artist:".length));
			try {
				const now = Date.now();
				const found = await lookup(ids);
				await putArtistRecords(found.map((a) => toRecord(a, now)));
				saved += found.length;
			} catch (err) {
				if (err instanceof RateLimited) {
					pausedUntil = Date.now() + err.retryAfterMs;
					console.info(`${LOG_PREFIX} artist lookup paused: ${err.message}`);
					break;
				}
				throw err;
			}
		}
	}
	if (!statsFmGenresAllowed()) return saved;
	const rest = uris.slice(next, next + STATSFM_PER_RUN);
	for (let i = 0; i < rest.length; i += 6) {
		const batch = await Promise.all(
			rest.slice(i, i + 6).map((u) => viaStatsFm(u, need.get(u) ?? "").catch(() => null)),
		);
		const ok = batch.filter((r): r is ArtistRecord => !!r);
		await putArtistRecords(ok);
		saved += ok.length;
	}
	return saved;
}
