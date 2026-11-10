/** "spotify:image:<id>" -> "https://i.scdn.co/image/<id>"; https URLs pass through. */
export function spotifyImageUrl(raw: string | undefined | null): string | undefined {
	if (!raw) return undefined;
	if (raw.startsWith("spotify:image:")) return `https://i.scdn.co/image/${raw.slice("spotify:image:".length)}`;
	if (raw.startsWith("https://")) return raw;
	return undefined;
}
