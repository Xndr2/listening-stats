import { cosmosGet } from "../api/cosmos-async";
import { enrichArtists, isSpotifyArtistUri } from "../stats/artist-enrichment";
import { db } from "../storage/db";
import type { StatsResult, TopTrack } from "../types/stats";
import { normalizeSpotifyImageUrl } from "../util/spotify-image-url";

interface SpotifyAlbum {
	id: string;
	images: Array<{ url: string }>;
}

interface SpotifyAlbumsResponse {
	albums: (SpotifyAlbum | null)[];
}

interface SpotifyTrackLite {
	id: string;
	album?: { images?: Array<{ url?: string }> };
}

interface SpotifyTracksResponse {
	tracks: (SpotifyTrackLite | null)[];
}

interface SpotifyArtistLite {
	id: string;
	images?: Array<{ url?: string }>;
}

interface SpotifyArtistsResponse {
	artists: (SpotifyArtistLite | null)[];
}

function spotifyAlbumId(albumUri: string): string | null {
	const m = /^spotify:album:([a-zA-Z0-9]+)$/.exec(albumUri.trim());
	return m ? m[1] : null;
}

function spotifyTrackId(trackUri: string): string | null {
	const m = /^spotify:track:([a-zA-Z0-9]+)$/.exec(trackUri.trim());
	return m ? m[1] : null;
}

function normalizeInPlaceShareImages(stats: StatsResult): void {
	for (const t of stats.topTracks) {
		const n = normalizeSpotifyImageUrl(t.albumArt);
		if (n) t.albumArt = n;
	}
	for (const a of stats.topArtists) {
		const n = normalizeSpotifyImageUrl(a.imageUrl ?? undefined);
		if (n) a.imageUrl = n;
	}
	for (const al of stats.topAlbums ?? []) {
		const n = normalizeSpotifyImageUrl(al.albumArt);
		if (n) al.albumArt = n;
	}
	for (const r of stats.recentPlays ?? []) {
		const n = normalizeSpotifyImageUrl(r.albumArt);
		if (n) r.albumArt = n;
	}
}

function dedupeTopTracks(topTracks: TopTrack[], limit: number): TopTrack[] {
	const out: TopTrack[] = [];
	const seen = new Set<string>();
	for (const t of topTracks) {
		if (seen.has(t.trackUri)) continue;
		seen.add(t.trackUri);
		out.push(t);
		if (out.length >= limit) break;
	}
	return out;
}

function copyAlbumArtFromRecentPlays(stats: StatsResult): void {
	const byTrack = new Map<string, string>();
	for (const r of stats.recentPlays ?? []) {
		const u = r.albumArt?.trim();
		if (u) byTrack.set(r.trackUri, u);
	}
	for (const t of stats.topTracks) {
		if (!t.albumArt?.trim()) {
			const u = byTrack.get(t.trackUri);
			if (u) t.albumArt = u;
		}
	}
}

function copyAlbumArtFromTopAlbums(stats: StatsResult): void {
	for (const al of stats.topAlbums ?? []) {
		const art = al.albumArt?.trim();
		if (!art) continue;
		for (const t of stats.topTracks) {
			if (!t.albumArt?.trim() && t.albumUri === al.albumUri) {
				t.albumArt = art;
			}
		}
	}
}

async function hydrateAlbumArtForTracks(tracks: TopTrack[]): Promise<void> {
	const need = tracks.filter(
		(t) => (!t.albumArt || !String(t.albumArt).trim()) && t.albumUri?.startsWith("spotify:album:"),
	);
	if (need.length === 0) return;

	const idToTracks = new Map<string, TopTrack[]>();
	for (const t of need) {
		const id = spotifyAlbumId(t.albumUri);
		if (!id) continue;
		const arr = idToTracks.get(id) ?? [];
		arr.push(t);
		idToTracks.set(id, arr);
	}

	const uniqueIds = [...idToTracks.keys()];
	for (let i = 0; i < uniqueIds.length; i += 20) {
		const slice = uniqueIds.slice(i, i + 20);
		const ids = slice.join(",");
		const res = await cosmosGet<SpotifyAlbumsResponse>(
			`https://api.spotify.com/v1/albums?ids=${encodeURIComponent(ids)}`,
		);
		if (!res.ok) continue;
		const byId = new Map<string, string>();
		for (const al of res.data.albums ?? []) {
			if (!al?.id) continue;
			const url = al.images?.[0]?.url;
			if (url) byId.set(al.id, url);
		}
		for (const id of slice) {
			const url = byId.get(id);
			if (!url) continue;
			for (const t of idToTracks.get(id) ?? []) {
				t.albumArt = url;
			}
		}
	}
}

async function hydrateAlbumArtFromTracksApi(tracks: TopTrack[]): Promise<void> {
	const need = tracks.filter((t) => (!t.albumArt || !String(t.albumArt).trim()) && spotifyTrackId(t.trackUri));
	if (need.length === 0) return;

	const idToTracks = new Map<string, TopTrack[]>();
	for (const t of need) {
		const id = spotifyTrackId(t.trackUri);
		if (!id) continue;
		const arr = idToTracks.get(id) ?? [];
		arr.push(t);
		idToTracks.set(id, arr);
	}

	const uniqueIds = [...idToTracks.keys()];
	for (let i = 0; i < uniqueIds.length; i += 50) {
		const slice = uniqueIds.slice(i, i + 50);
		const ids = slice.join(",");
		const res = await cosmosGet<SpotifyTracksResponse>(
			`https://api.spotify.com/v1/tracks?ids=${encodeURIComponent(ids)}`,
		);
		if (!res.ok) continue;
		for (let j = 0; j < slice.length; j++) {
			const id = slice[j];
			const tr = res.data.tracks?.[j];
			const url = tr?.album?.images?.[0]?.url;
			if (!url || !id) continue;
			for (const row of idToTracks.get(id) ?? []) {
				row.albumArt = url;
			}
		}
	}
}

/**
 * Fetches artist portraits into the in-memory stats object. Share cards must not rely on DB TTL
 * skips from enrichArtists - this always fills missing portraits when Spotify returns images.
 */
async function hydrateTopArtistPortraitsFromApi(stats: StatsResult): Promise<void> {
	const need = stats.topArtists.filter(
		(a) => (!a.imageUrl || !String(a.imageUrl).trim()) && isSpotifyArtistUri(a.artistUri ?? ""),
	);
	if (need.length === 0) return;

	for (let i = 0; i < need.length; i += 50) {
		const batch = need.slice(i, i + 50);
		const ids = batch.map((a) => a.artistUri.replace(/^spotify:artist:/i, "")).join(",");
		const res = await cosmosGet<SpotifyArtistsResponse>(
			`https://api.spotify.com/v1/artists?ids=${encodeURIComponent(ids)}`,
		);
		if (!res.ok) continue;
		const artists = res.data.artists ?? [];
		for (let j = 0; j < batch.length; j++) {
			const row = batch[j];
			const artist = artists[j];
			const raw = artist?.images?.[0]?.url;
			if (!raw?.trim()) continue;
			const url = normalizeSpotifyImageUrl(raw) ?? raw;
			if (url.trim()) row.imageUrl = url;
		}
	}
}

/** When Spotify has no artist image, reuse that artist's top-track album art as a square avatar. */
function copyArtistImageFromTopTracks(stats: StatsResult): void {
	const byArtist = new Map<string, string>();
	for (const t of stats.topTracks) {
		const art = t.albumArt?.trim();
		const uri = t.artistUri?.trim();
		if (!art || !uri) continue;
		if (!byArtist.has(uri)) byArtist.set(uri, art);
	}
	for (const a of stats.topArtists) {
		if (a.imageUrl?.trim()) continue;
		const key = a.artistUri?.trim() ?? "";
		const u = key ? byArtist.get(key) : undefined;
		if (u) {
			const n = normalizeSpotifyImageUrl(u) ?? u;
			if (n.trim()) a.imageUrl = n;
		}
	}
}

/** Uri mismatch (stats.fm placeholders vs Spotify ids) - match first top track by artist name. */
function copyArtistImageFromTopTracksByName(stats: StatsResult): void {
	const byName = new Map<string, string>();
	for (const t of stats.topTracks) {
		const art = t.albumArt?.trim();
		const name = t.artistName?.trim().toLowerCase();
		if (!art || !name) continue;
		if (!byName.has(name)) byName.set(name, art);
	}
	for (const a of stats.topArtists) {
		if (a.imageUrl?.trim()) continue;
		const name = a.artistName?.trim().toLowerCase();
		if (!name) continue;
		const u = byName.get(name);
		if (u) {
			const n = normalizeSpotifyImageUrl(u) ?? u;
			if (n.trim()) a.imageUrl = n;
		}
	}
}

export async function hydrateShareCardAssets(stats: StatsResult): Promise<void> {
	try {
		normalizeInPlaceShareImages(stats);
		const trackPool = dedupeTopTracks(stats.topTracks, 50);
		copyAlbumArtFromRecentPlays(stats);
		copyAlbumArtFromTopAlbums(stats);
		await hydrateAlbumArtForTracks(trackPool);
		await hydrateAlbumArtFromTracksApi(trackPool);

		const artistUris = [...new Set(stats.topArtists.map((a) => a.artistUri).filter(Boolean))];
		if (artistUris.length > 0) {
			await enrichArtists(artistUris);
			const rows = await db.artists.where("uri").anyOf(artistUris).toArray();
			const byUri = new Map(rows.map((r) => [r.uri, r]));
			for (const a of stats.topArtists) {
				const row = byUri.get(a.artistUri);
				const fromDb = normalizeSpotifyImageUrl(row?.imageUrl ?? undefined) ?? row?.imageUrl;
				if (fromDb?.trim() && (!a.imageUrl || !String(a.imageUrl).trim())) {
					a.imageUrl = fromDb;
				}
			}
		}

		await hydrateTopArtistPortraitsFromApi(stats);
		copyArtistImageFromTopTracks(stats);
		copyArtistImageFromTopTracksByName(stats);
	} catch {
		/* ignore */
	}
}
