import { cosmosGet } from "../shared/api/cosmos-async";
import type { WorldChartKind, WorldTrack } from "../shared/types/world-charts";
import { navigateToUri } from "./utils";

const STATS_FM = "https://api.stats.fm/api/v1";

export const WORLD_SPOTIFY_ENRICH_LIMIT = 10;

interface SpotifySearchTrack {
	id: string;
	name: string;
	artists: Array<{ name: string }>;
}

interface SpotifySearchResponse {
	tracks: { items: SpotifySearchTrack[] };
}

function normalizeForMatch(s: string): string {
	return s
		.toLowerCase()
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function primaryArtistName(artist: string): string {
	return artist.split(",")[0]?.trim() ?? "";
}

export function spotifyTrackUri(trackId: string | undefined): string | null {
	if (!trackId?.trim()) return null;
	return `spotify:track:${trackId.trim()}`;
}

function spotifyArtistUri(artistId: string | undefined): string | null {
	if (!artistId?.trim()) return null;
	return `spotify:artist:${artistId.trim()}`;
}

function spotifyAlbumUri(albumId: string | undefined): string | null {
	if (!albumId?.trim()) return null;
	return `spotify:album:${albumId.trim()}`;
}

export function playWorldTrack(item: WorldTrack): boolean {
	const uri = spotifyTrackUri(item.spotifyTrackId);
	if (!uri) return false;
	const player = Spicetify.Player as typeof Spicetify.Player & {
		playUri?: (uri: string, options?: { contextUri?: string }) => void;
	};
	if (typeof player.playUri === "function") {
		player.playUri(uri);
		return true;
	}
	navigateToUri(uri);
	return true;
}

export function playOrOpenWorldTrack(item: WorldTrack): void {
	if (item.spotifyTrackId && playWorldTrack(item)) return;
	navigateWorldItem(item, "track");
}

export function navigateWorldItem(item: WorldTrack, kind: WorldChartKind): void {
	if (kind === "track") {
		const uri = spotifyTrackUri(item.spotifyTrackId);
		if (uri) {
			navigateToUri(uri);
			return;
		}
		Spicetify.Platform.History.push(`/search/${encodeURIComponent(`${item.title} ${item.artist}`.trim())}`);
		return;
	}
	if (kind === "artist") {
		const uri = spotifyArtistUri(item.spotifyArtistId);
		if (uri) {
			navigateToUri(uri);
			return;
		}
		Spicetify.Platform.History.push(`/search/${encodeURIComponent(item.title)}`);
		return;
	}
	const uri = spotifyAlbumUri(item.spotifyAlbumId);
	if (uri) {
		navigateToUri(uri);
		return;
	}
	Spicetify.Platform.History.push(`/search/${encodeURIComponent(`${item.title} ${item.artist}`.trim())}`);
}

export function trackPlayTooltip(item: WorldTrack): string {
	if (item.spotifyTrackId) return "Play in Spotify";
	return "Open in Spotify search";
}

async function fetchStatsFmTrackSpotifyId(statsFmTrackId: number): Promise<string | null> {
	const res = await fetch(`${STATS_FM}/tracks/${statsFmTrackId}`, { headers: { Accept: "application/json" } });
	if (!res.ok) return null;
	const json = (await res.json()) as {
		item?: { externalIds?: { spotify?: string[] } };
		externalIds?: { spotify?: string[] };
	};
	const track = json.item ?? json;
	const ids = track.externalIds?.spotify ?? [];
	return ids[0] ?? null;
}

function pickSpotifySearchMatch(items: SpotifySearchTrack[], title: string, artist: string): string | null {
	if (!items.length) return null;
	const nt = normalizeForMatch(title);
	const na = normalizeForMatch(primaryArtistName(artist));

	const exact = items.find(
		(item) =>
			normalizeForMatch(item.name) === nt &&
			item.artists.some((a) => {
				const an = normalizeForMatch(a.name);
				return an === na || an.includes(na) || na.includes(an);
			}),
	);
	if (exact) return exact.id;

	const titleOnly = items.find((item) => normalizeForMatch(item.name) === nt);
	if (titleOnly) return titleOnly.id;

	return items[0]?.id ?? null;
}

async function searchSpotifyTrackId(title: string, artist: string): Promise<string | null> {
	const primary = primaryArtistName(artist);
	const queries = primary ? [`track:${title} artist:${primary}`, `${title} ${primary}`] : [title];

	for (const q of queries) {
		const result = await cosmosGet<SpotifySearchResponse>(
			`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=8`,
		);
		if (!result.ok) continue;
		const id = pickSpotifySearchMatch(result.data.tracks?.items ?? [], title, artist);
		if (id) return id;
	}
	return null;
}

async function resolveSpotifyTrackId(track: WorldTrack): Promise<string | null> {
	if (track.spotifyTrackId) return track.spotifyTrackId;
	if (track.statsFmTrackId != null) {
		const fromDetail = await fetchStatsFmTrackSpotifyId(track.statsFmTrackId);
		if (fromDetail) return fromDetail;
	}
	if (!track.artist?.trim()) return null;
	return searchSpotifyTrackId(track.title, track.artist);
}

export async function enrichTracksWithSpotifyIds(
	tracks: WorldTrack[],
	options?: { max?: number },
): Promise<WorldTrack[]> {
	const max = Math.min(options?.max ?? WORLD_SPOTIFY_ENRICH_LIMIT, tracks.length);
	const out = tracks.map((t) => ({ ...t }));

	for (let i = 0; i < max; i++) {
		const t = out[i];
		if (t.spotifyTrackId) continue;
		const id = await resolveSpotifyTrackId(t);
		if (id) out[i] = { ...t, spotifyTrackId: id };
	}

	return out;
}
