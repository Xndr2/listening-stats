/**
 * Synthetic URIs for imports without Spotify IDs: listening-stats:{type}:{hash}.
 * Hash: first 12 hex chars of SHA-256 over the lowercased identity of each
 * entity - track: track+artist+album, artist: artist, album: artist+album.
 * The keys must identify the entity itself: stats aggregation groups by these
 * URIs, so hashing the full compound into the artist/album URIs would split
 * one artist into a bucket per track.
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

/** Generate deterministic synthetic URIs for a track+artist+album combination. */
export async function generateSyntheticUris(
	trackName: string,
	artistName: string,
	albumName: string,
): Promise<{ trackUri: string; artistUri: string; albumUri: string }> {
	const [trackHash, artistHash, albumHash] = await Promise.all([
		sha256Truncated(trackName + artistName + albumName),
		sha256Truncated(artistName),
		sha256Truncated(artistName + albumName),
	]);
	return {
		trackUri: `listening-stats:track:${trackHash}`,
		artistUri: `listening-stats:artist:${artistHash}`,
		albumUri: `listening-stats:album:${albumHash}`,
	};
}
