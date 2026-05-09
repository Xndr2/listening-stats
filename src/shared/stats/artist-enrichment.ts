import type { ArtistRecord } from "../types/stats";
import { cosmosGet } from "../api/cosmos-async";
import { db } from "../storage/db";

const BATCH_SIZE = 50;
const ENRICHMENT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SpotifyArtist {
	id: string;
	name: string;
	genres: string[];
	images: Array<{ url: string; height: number; width: number }>;
}

interface SpotifyArtistsResponse {
	artists: SpotifyArtist[];
}

export async function enrichArtists(artistUris: string[]): Promise<void> {
	if (artistUris.length === 0) return;

	// Deduplicate URIs
	const uniqueUris = [...new Set(artistUris)];

	// Filter out already-enriched (within TTL)
	const now = Date.now();
	const existing = await db.artists.where("uri").anyOf(uniqueUris).toArray();
	const enrichedSet = new Set(
		existing.filter((a) => now - a.updatedAt < ENRICHMENT_TTL_MS).map((a) => a.uri),
	);
	const unenriched = uniqueUris.filter((uri) => !enrichedSet.has(uri));

	if (unenriched.length === 0) return;

	// Batch into groups of 50 (per API-01 max 50 per request)
	for (let i = 0; i < unenriched.length; i += BATCH_SIZE) {
		const batch = unenriched.slice(i, i + BATCH_SIZE);
		// Spotify /v1/artists expects bare IDs
		const ids = batch.map((uri) => uri.replace("spotify:artist:", "")).join(",");
		const result = await cosmosGet<SpotifyArtistsResponse>(
			`https://api.spotify.com/v1/artists?ids=${ids}`,
		);

		if (result.ok) {
			const records: ArtistRecord[] = result.data.artists.map((a) => ({
				uri: `spotify:artist:${a.id}`,
				name: a.name,
				genres: a.genres,
				imageUrl: a.images[0]?.url ?? null,
				updatedAt: Date.now(),
			}));
			await db.artists.bulkPut(records);
		}
		// Best-effort: skip failed batches
	}
}
