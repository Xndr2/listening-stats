/** Map spotify:image: IDs from player metadata to https CDN URLs for img/canvas/CSS. */
export function normalizeSpotifyImageUrl(url: string | null | undefined): string | undefined {
	if (url == null) return undefined;
	const s = String(url).trim();
	if (!s) return undefined;
	if (/^spotify:image:/i.test(s)) {
		const id = s.replace(/^spotify:image:/i, "").trim();
		if (!id) return undefined;
		return `https://i.scdn.co/image/${id}`;
	}
	return s;
}
