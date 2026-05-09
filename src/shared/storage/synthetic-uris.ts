/**
 * Synthetic URIs for imports without Spotify IDs: listening-stats:{type}:{hash}.
 * Hash: first 12 hex chars of SHA-256(lower(track|artist|album)).
 */

async function sha256Truncated(input: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(input.toLowerCase());
	const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
		.slice(0, 12);
}

/**
 * Generate deterministic synthetic URIs for a track+artist+album combination.
 *
 * All three URIs share the same hash derived from the compound key
 * (trackName + artistName + albumName), lowercased before hashing.
 */
export async function generateSyntheticUris(
	trackName: string,
	artistName: string,
	albumName: string,
): Promise<{ trackUri: string; artistUri: string; albumUri: string }> {
	const compound = trackName + artistName + albumName;
	const hash = await sha256Truncated(compound);
	return {
		trackUri: `listening-stats:track:${hash}`,
		artistUri: `listening-stats:artist:${hash}`,
		albumUri: `listening-stats:album:${hash}`,
	};
}
