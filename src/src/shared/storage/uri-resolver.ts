/**
 * After import: resolve `listening-stats:*` synthetic URIs via Spotify search.
 * Throttled requests (~2-3s apart); updates matching rows in one modify() per URI.
 * resolvedAt: null = pending, 0 = no match, timestamp = resolved.
 */

import { circuitBreaker } from "../api/circuit-breaker";
import { cosmosGet } from "../api/cosmos-async";
import { db } from "./db";

// ──────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────

const RESOLVE_DELAY_MIN_MS = 2000;
const RESOLVE_DELAY_JITTER_MS = 1000;

// ──────────────────────────────────────────────────────
// Internal types
// ──────────────────────────────────────────────────────

interface SpotifySearchTrack {
	id: string;
	name: string;
	uri: string;
	artists: Array<{ id: string; name: string; uri: string }>;
	album: {
		id: string;
		name: string;
		uri: string;
		images: Array<{ url: string; height: number; width: number }>;
	};
}

interface SpotifySearchResponse {
	tracks: {
		items: SpotifySearchTrack[];
	};
}

// ──────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ──────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────

/**
 * Resolve all unresolved synthetic URIs in the DB to real Spotify URIs.
 *
 * @param options.delayMs - Override delay between searches (default: 2000-3000ms random).
 *   Pass 0 in tests to make them synchronous.
 */
export async function resolveImportedUris(options?: { delayMs?: number }): Promise<void> {
	// Step 1: Query all events with synthetic trackUris that haven't been attempted yet
	const candidates = await db.playEvents.where("trackUri").startsWith("listening-stats:").toArray();

	// Filter to only unresolved ones (resolvedAt null or undefined; resolvedAt=0 means permanently unresolvable)
	const unresolved = candidates.filter((e) => e.resolvedAt === null || e.resolvedAt === undefined);

	// Step 2: Early return if nothing to do
	if (unresolved.length === 0) return;

	// Step 3: Deduplicate by synthetic trackUri  -  1 search per unique URI
	const uniqueSyntheticUris = [...new Set(unresolved.map((e) => e.trackUri))];

	// Map from synthetic trackUri to { trackName, artistName } metadata (first match)
	const metaByUri = new Map<string, { trackName: string; artistName: string }>();
	for (const event of unresolved) {
		if (!metaByUri.has(event.trackUri)) {
			metaByUri.set(event.trackUri, {
				trackName: event.trackName,
				artistName: event.artistName,
			});
		}
	}

	// Step 4: Slow-drip loop  -  one search per unique synthetic URI
	for (const syntheticUri of uniqueSyntheticUris) {
		if (circuitBreaker.isOpen()) break;

		const meta = metaByUri.get(syntheticUri);
		if (!meta) continue;
		const { trackName, artistName } = meta;

		// Build Spotify search URL with encoded query
		const query = encodeURIComponent(`track:${trackName} artist:${artistName}`);
		const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`;

		const result = await cosmosGet<SpotifySearchResponse>(url);

		if (!result.ok) {
			// Rate limit or circuit open: stop the batch
			if (result.error.type === "rate_limited" || result.error.type === "circuit_open") {
				break;
			}
			// Other errors (http_error, network_error): mark as unresolvable and continue
			await db.playEvents.where("trackUri").equals(syntheticUri).modify({ resolvedAt: 0 });
		} else {
			// Case-insensitive track + primary artist match within top 5 results
			const items = result.data.tracks.items;
			const match = items.find(
				(item) =>
					item.name.toLowerCase() === trackName.toLowerCase() &&
					item.artists[0]?.name.toLowerCase() === artistName.toLowerCase(),
			);

			if (match) {
				// Apply match to every row sharing this synthetic URI
				await db.playEvents
					.where("trackUri")
					.equals(syntheticUri)
					.modify({
						trackUri: `spotify:track:${match.id}`,
						artistUri: `spotify:artist:${match.artists[0].id}`,
						albumUri: `spotify:album:${match.album.id}`,
						albumArt: match.album.images[0]?.url ?? null,
						resolvedAt: Date.now(),
					});
			} else {
				// No confident match: mark unresolvable (resolvedAt 0)
				await db.playEvents.where("trackUri").equals(syntheticUri).modify({ resolvedAt: 0 });
			}
		}

		await sleep(options?.delayMs ?? RESOLVE_DELAY_MIN_MS + Math.random() * RESOLVE_DELAY_JITTER_MS);
	}
}
