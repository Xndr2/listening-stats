/**
 * Image URLs come from APIs and from imported files. Loading an arbitrary
 * URL would let a crafted file make Spotify ping any server, so only https
 * images on known music CDNs are rendered.
 */
const IMAGE_HOSTS = [
	"i.scdn.co",
	"mosaic.scdn.co",
	"image-cdn-ak.spotifycdn.com",
	"image-cdn-fa.spotifycdn.com",
	"lastfm.freetls.fastly.net",
	"lastfm-img.freetls.fastly.net",
	"cdn.stats.fm",
];
const IMAGE_SUFFIXES = [".mzstatic.com", ".scdn.co", ".spotifycdn.com"];

export function isSafeImageUrl(url: string | null | undefined): url is string {
	if (!url) return false;
	try {
		const u = new URL(url);
		if (u.protocol !== "https:") return false;
		return IMAGE_HOSTS.includes(u.hostname) || IMAGE_SUFFIXES.some((s) => u.hostname.endsWith(s));
	} catch {
		return false;
	}
}
