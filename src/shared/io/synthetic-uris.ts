/**
 * Stand-in uris for imported rows without Spotify ids. Same scheme as v2
 * (listening-stats:{type}:{first 12 hex of sha256(lowercased identity)}) so
 * rows imported by either version group together.
 */
async function hash12(input: string): Promise<string> {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.toLowerCase()));
	return [...new Uint8Array(buf)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
		.slice(0, 12);
}

export async function syntheticUris(
	track: string,
	artist: string,
	album: string,
): Promise<{ trackUri: string; artistUri: string; albumUri: string }> {
	const [t, a, b] = await Promise.all([hash12(track + artist + album), hash12(artist), hash12(artist + album)]);
	return {
		trackUri: `listening-stats:track:${t}`,
		artistUri: `listening-stats:artist:${a}`,
		albumUri: `listening-stats:album:${b}`,
	};
}
