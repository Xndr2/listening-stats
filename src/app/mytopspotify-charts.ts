import type { WorldTrack } from "../shared/types/world-charts";

const SONGS_URL = "https://mytopspotify.io/spotify-top-songs.json";
const ARTISTS_URL = "https://mytopspotify.io/spotify-top-artists.json";

const FETCH_HEADERS: Record<string, string> = {
	Accept: "application/json",
	"User-Agent": "Mozilla/5.0 (compatible; ListeningStats/2.x; +https://github.com/Xndr2/listening-stats)",
};

function formatMytopListeners(raw: string | undefined): string {
	if (!raw?.trim()) return "-";
	const digits = raw.replace(/[^\d]/g, "");
	if (!digits) return raw.trim();
	const n = Number(digits);
	if (!Number.isFinite(n)) return raw.trim();
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M listeners`;
	if (n >= 1_000) return `${Math.round(n / 1_000)}K listeners`;
	return `${n} listeners`;
}

interface MytopSong {
	name: string;
	artist: string;
	image?: string;
	spotifyId?: string;
}

interface MytopArtist {
	position?: number;
	name: string;
	image?: string;
	listeners?: string;
}

interface MytopEnvelope<T> {
	data?: T[];
}

function normalizeKey(title: string, artist: string): string {
	return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}

/** Spotify id + title/artist keys → CDN cover from mytopspotify daily export. */
export async function fetchMytopImageLookups(): Promise<{
	bySpotifyId: Map<string, string>;
	byTitleArtist: Map<string, string>;
}> {
	const bySpotifyId = new Map<string, string>();
	const byTitleArtist = new Map<string, string>();
	try {
		const res = await fetch(SONGS_URL, { headers: FETCH_HEADERS });
		if (!res.ok) return { bySpotifyId, byTitleArtist };
		const json = (await res.json()) as MytopEnvelope<MytopSong>;
		const rows = json.data ?? [];
		for (const row of rows) {
			if (row.image) {
				if (row.spotifyId) bySpotifyId.set(row.spotifyId, row.image);
				byTitleArtist.set(normalizeKey(row.name, row.artist), row.image);
			}
		}
	} catch {
		// ignore
	}
	return { bySpotifyId, byTitleArtist };
}

function stripSpotifyMeta<T extends WorldTrack & { spotifyTrackId?: string }>(t: T): WorldTrack {
	const { spotifyTrackId: _omit, ...rest } = t;
	return rest;
}

/** Fill missing `artUrl` using mytopspotify (Spotify id first, then title+artist). */
export function enrichWorldTracksWithMytopImages(
	tracks: Array<WorldTrack & { spotifyTrackId?: string }>,
	lookups: { bySpotifyId: Map<string, string>; byTitleArtist: Map<string, string> },
): WorldTrack[] {
	return tracks.map((t) => {
		if (t.artUrl) return stripSpotifyMeta(t);
		if (t.spotifyTrackId) {
			const u = lookups.bySpotifyId.get(t.spotifyTrackId);
			if (u) return stripSpotifyMeta({ ...t, artUrl: u });
		}
		const u2 = lookups.byTitleArtist.get(normalizeKey(t.title, t.artist));
		if (u2) return stripSpotifyMeta({ ...t, artUrl: u2 });
		return stripSpotifyMeta(t);
	});
}

/** Map mytopspotify daily global JSON into `WorldTrack` rows (no rank-movement; plays are listener totals when present). */
export async function fetchMytopWorldTracks(): Promise<WorldTrack[]> {
	const res = await fetch(SONGS_URL, { headers: FETCH_HEADERS });
	if (!res.ok) throw new Error(`mytop songs HTTP ${res.status}`);
	const json = (await res.json()) as MytopEnvelope<MytopSong>;
	const rows = json.data ?? [];
	return rows.slice(0, 8).map((row, i) => {
		const rank = i + 1;
		const id = row.spotifyId ?? `mytop-t-${rank}-${row.name}`;
		return {
			id: `mytop-t-${id}`,
			title: row.name,
			artist: row.artist,
			country: "GL",
			plays: "",
			delta: null,
			...(row.image ? { artUrl: row.image } : {}),
		};
	});
}

export async function fetchMytopWorldArtists(): Promise<WorldTrack[]> {
	const res = await fetch(ARTISTS_URL, { headers: FETCH_HEADERS });
	if (!res.ok) throw new Error(`mytop artists HTTP ${res.status}`);
	const json = (await res.json()) as MytopEnvelope<MytopArtist>;
	const rows = json.data ?? [];
	return rows.slice(0, 8).map((row, i) => {
		const rank = row.position ?? i + 1;
		const id = `mytop-a-${rank}-${row.name}`;
		return {
			id,
			title: row.name,
			artist: "",
			country: "GL",
			plays: formatMytopListeners(row.listeners),
			delta: null,
			...(row.image ? { artUrl: row.image } : {}),
		};
	});
}

export { normalizeKey };
