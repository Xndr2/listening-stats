import { cosmosGet } from "../api/cosmos-async";
import { db } from "../storage/db";
import type { ArtistRecord } from "../types/stats";
import { normalizeSpotifyImageUrl } from "../util/spotify-image-url";

const BATCH_SIZE = 50;
const ENRICHMENT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
/** When Spotify returns no portrait, avoid refetching on every stats pass. */
const NO_IMAGE_RETRY_MS = 6 * 60 * 60 * 1000; // 6 hours

interface SpotifyArtist {
	id: string;
	name: string;
	genres: string[];
	images: Array<{ url: string; height: number; width: number }>;
}

interface SpotifyArtistsResponse {
	artists: (SpotifyArtist | null)[];
}

export function isSpotifyArtistUri(uri: string): boolean {
	return /^spotify:artist:[a-zA-Z0-9]+$/i.test(uri.trim());
}

function shouldSkipRefetch(row: ArtistRecord, now: number): boolean {
	const age = now - row.updatedAt;
	if (row.imageUrl?.trim()) return age < ENRICHMENT_TTL_MS;
	return age < NO_IMAGE_RETRY_MS;
}

export async function enrichArtists(artistUris: string[]): Promise<void> {
	if (artistUris.length === 0) return;

	const uniqueUris = [...new Set(artistUris.filter(isSpotifyArtistUri))];
	if (uniqueUris.length === 0) return;

	const now = Date.now();
	const existing = await db.artists.where("uri").anyOf(uniqueUris).toArray();
	const skipSet = new Set(existing.filter((row) => shouldSkipRefetch(row, now)).map((r) => r.uri));
	const unenriched = uniqueUris.filter((uri) => !skipSet.has(uri));

	if (unenriched.length === 0) return;

	for (let i = 0; i < unenriched.length; i += BATCH_SIZE) {
		const batch = unenriched.slice(i, i + BATCH_SIZE);
		const ids = batch.map((uri) => uri.replace(/^spotify:artist:/i, "")).join(",");
		const result = await cosmosGet<SpotifyArtistsResponse>(
			`https://api.spotify.com/v1/artists?ids=${ids}`,
		);

		if (!result.ok) continue;

		const records: ArtistRecord[] = [];
		const artists = result.data.artists ?? [];
		for (let j = 0; j < batch.length; j++) {
			const uri = batch[j];
			const a = artists[j];
			if (a) {
				const raw = a.images[0]?.url ?? null;
				records.push({
					uri: `spotify:artist:${a.id}`,
					name: a.name,
					genres: a.genres ?? [],
					imageUrl: normalizeSpotifyImageUrl(raw) ?? raw,
					updatedAt: Date.now(),
				});
			} else {
				records.push({
					uri,
					name: "Unknown",
					genres: [],
					imageUrl: null,
					updatedAt: Date.now(),
				});
			}
		}
		if (records.length > 0) await db.artists.bulkPut(records);
	}
}
