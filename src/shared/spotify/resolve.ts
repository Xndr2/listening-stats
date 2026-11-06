/**
 * Finds the Spotify track, artist or album behind a name, for sources that
 * only give names (Last.fm) or sometimes lack a Spotify id (stats.fm). Uses the same search the Spotify client's own
 * search box uses, so no extra service sees the query.
 *
 * Only a result whose title and artist actually match is accepted: a wrong
 * match would play, like or add the wrong song, which is worse than none.
 * Answers (including "not found") are cached for 30 days.
 */
import { v3Get, v3Put } from "../storage/v3-db";

export interface Resolved {
	uri: string;
	image?: string;
	/** Tracks only. */
	albumName?: string;
	albumUri?: string;
}

type Kind = "track" | "artist" | "album";

const TTL = 30 * 86_400_000;
const memory = new Map<string, Promise<Resolved | null>>();

/** Lowercase, drop "(Remastered)", "- Live", "feat." and punctuation, for comparing names. */
export function norm(s: string): string {
	return s
		.toLowerCase()
		.replace(/\s*[([].*?[)\]]/g, "")
		.replace(/\s+-\s+.*$/, "")
		.replace(/\s+(feat|ft)\.?\s.*$/, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

interface Img {
	url: string;
	width?: number | null;
}

function pickImage(sources: Img[] | undefined): string | undefined {
	if (!sources?.length) return undefined;
	const sorted = [...sources].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
	return (sorted.find((s) => (s.width ?? 0) >= 160) ?? sorted.at(-1))?.url;
}

interface Hit {
	__typename?: string;
	uri?: string;
	name?: string;
	profile?: { name?: string };
	artists?: { items?: Array<{ profile?: { name?: string } }> };
	albumOfTrack?: { name?: string; uri?: string; coverArt?: { sources?: Img[] } };
	coverArt?: { sources?: Img[] };
	visuals?: { avatarImage?: { sources?: Img[] } };
}

type GraphQL = {
	Request?: (def: unknown, vars: Record<string, unknown>) => Promise<{ data?: unknown }>;
	Definitions?: Record<string, unknown>;
};

async function search(term: string): Promise<Hit[]> {
	const gql = (globalThis as { Spicetify?: { GraphQL?: GraphQL } }).Spicetify?.GraphQL;
	const def = gql?.Definitions?.searchModalResults;
	if (!gql?.Request || !def) return [];
	const r = (await gql.Request(def, {
		searchTerm: term,
		offset: 0,
		limit: 10,
		numberOfTopResults: 10,
		includeAudiobooks: false,
		includePreReleases: false,
		includeLocalConcertsField: false,
		includeArtistHasConcertsField: false,
		includeAuthors: false,
	})) as { data?: { searchV2?: { topResultsV2?: { itemsV2?: Array<{ item?: { data?: Hit } }> } } } };
	return (r.data?.searchV2?.topResultsV2?.itemsV2 ?? []).map((i) => i.item?.data).filter((h): h is Hit => !!h?.uri);
}

const artistNames = (h: Hit) => (h.artists?.items ?? []).map((a) => norm(a.profile?.name ?? ""));

export function pickMatch(kind: Kind, hits: Hit[], name: string, artist: string): Resolved | null {
	const n = norm(name);
	const a = norm(artist.split(",")[0] ?? "");
	for (const h of hits) {
		if (kind === "artist" && h.__typename === "Artist" && norm(h.profile?.name ?? "") === n) {
			return { uri: h.uri as string, image: pickImage(h.visuals?.avatarImage?.sources) };
		}
		if (
			kind === "track" &&
			h.__typename === "Track" &&
			norm(h.name ?? "") === n &&
			(!a || artistNames(h).includes(a))
		) {
			return {
				uri: h.uri as string,
				image: pickImage(h.albumOfTrack?.coverArt?.sources),
				albumName: h.albumOfTrack?.name,
				albumUri: h.albumOfTrack?.uri,
			};
		}
		if (
			kind === "album" &&
			h.__typename === "Album" &&
			norm(h.name ?? "") === n &&
			(!a || artistNames(h).includes(a))
		) {
			return { uri: h.uri as string, image: pickImage(h.coverArt?.sources) };
		}
	}
	return null;
}

async function trackAlbum(uri: string): Promise<{ albumName?: string; albumUri?: string }> {
	const gql = (globalThis as { Spicetify?: { GraphQL?: GraphQL } }).Spicetify?.GraphQL;
	const def = gql?.Definitions?.getTrack;
	if (!gql?.Request || !def) return {};
	const r = (await gql.Request(def, { uri })) as {
		data?: { trackUnion?: { albumOfTrack?: { name?: string; uri?: string } } };
	};
	const a = r.data?.trackUnion?.albumOfTrack;
	return { albumName: a?.name, albumUri: a?.uri };
}

// At most a few searches at once, so a 50-row list doesn't flood Spotify.
let running = 0;
const queue: Array<() => void> = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
	if (running >= 4) await new Promise<void>((r) => queue.push(r));
	running++;
	try {
		return await fn();
	} finally {
		running--;
		queue.shift()?.();
	}
}

export function resolve(kind: Kind, name: string, artist = ""): Promise<Resolved | null> {
	const key = `resolve3:${kind}:${norm(name)}|${norm(artist)}`;
	let p = memory.get(key);
	if (!p) {
		p = (async () => {
			const cached = await v3Get<{ at: number; v: Resolved | null }>("cache", key).catch(() => undefined);
			if (cached && Date.now() - cached.at < TTL) return cached.v;
			const hits = await slot(() => search(kind === "artist" ? name : `${name} ${artist}`)).catch(() => null);
			if (hits === null) return null; // search failed: don't cache, try again next time
			let v = pickMatch(kind, hits, name, artist);
			// Quick search results carry no album name; one track lookup adds it.
			if (v && kind === "track" && !v.albumName)
				v = { ...v, ...(await slot(() => trackAlbum(v?.uri ?? "")).catch(() => ({}))) };
			void v3Put("cache", { at: Date.now(), v }, key).catch(() => {});
			return v;
		})();
		memory.set(key, p);
	}
	return p;
}

/**
 * Fills in Spotify uri, cover and album for rows that have no Spotify uri yet,
 * so they can be played, liked, right-clicked and put in playlists. Rows that
 * already have one, or don't match, stay as they were. `artistOf` picks the
 * name to match on (default: the row's artistName).
 */
export function withSpotify<
	T extends { uri: string; name: string; artistName?: string; image?: string; albumName?: string; albumUri?: string },
>(kind: Kind, rows: T[], artistOf: (r: T) => string = (r) => r.artistName ?? ""): Promise<T[]> {
	return Promise.all(
		rows.map(async (r) => {
			if (r.uri.startsWith("spotify:")) return r;
			const hit = await resolve(kind, r.name, artistOf(r)).catch(() => null);
			if (!hit) return r;
			const album =
				kind === "track" ? { albumName: r.albumName ?? hit.albumName, albumUri: r.albumUri ?? hit.albumUri } : {};
			return { ...r, uri: hit.uri, image: r.image ?? hit.image, ...album };
		}),
	);
}
