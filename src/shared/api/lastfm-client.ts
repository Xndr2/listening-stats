// ── User data types (for Last.fm as a stats provider) ──

export interface LfmRecentTrack {
	name: string;
	artist: string;
	album: string;
	albumArt?: string;
	playedAt: number; // Unix ms
}

export interface LfmTopTrack {
	name: string;
	artist: string;
	playCount: number;
	album?: string;
	albumArt?: string;
}

export interface LfmTopArtist {
	name: string;
	playCount: number;
	imageUrl?: string;
}

export interface LfmTopAlbum {
	name: string;
	artist: string;
	playCount: number;
	imageUrl?: string;
}

export interface LfmUserInfo {
	username: string;
	totalScrobbles: number;
	registered: string;
	imageUrl?: string;
}

// ── Last.fm API raw response types (for typed lastfmUserFetch) ──

interface LfmImage {
	size: string;
	"#text": string;
}

interface LfmRecentTrackRaw {
	name: string;
	artist: { "#text": string } | { name: string };
	album: { "#text": string };
	image: LfmImage[];
	date?: { uts: string };
	"@attr"?: { nowplaying: string };
}

interface LfmTopTrackRaw {
	name: string;
	artist: { name: string };
	playcount: string;
	image: LfmImage[];
}

interface LfmTopArtistRaw {
	name: string;
	playcount: string;
	image: LfmImage[];
}

interface LfmTopAlbumRaw {
	name: string;
	artist: { name: string };
	playcount: string;
	image: LfmImage[];
}

interface LfmUserInfoRaw {
	user: {
		name: string;
		playcount: string;
		registered: { "#text": string };
		image: LfmImage[];
	};
}

interface LfmRecentTracksRaw {
	recenttracks: {
		track: LfmRecentTrackRaw[];
	};
}

interface LfmTopTracksRaw {
	toptracks: {
		track: LfmTopTrackRaw[];
	};
}

interface LfmTopArtistsRaw {
	topartists: {
		artist: LfmTopArtistRaw[];
	};
}

interface LfmTopAlbumsRaw {
	topalbums: {
		album: LfmTopAlbumRaw[];
	};
}

const BASE = "https://ws.audioscrobbler.com/2.0/";

// ── User data API (for Last.fm stats provider) ──

const LASTFM_PLACEHOLDER_HASHES = ["2a96cbd8b46e442fc41c2b86b821562f", "c6f59c1e5e7240a4c0d427abd71f3dbb"];

/** Last.fm returns a bare object (not a one-element array) when a list has exactly one item. */
function asArray<T>(value: T[] | T | undefined | null): T[] {
	if (Array.isArray(value)) return value;
	return value == null ? [] : [value];
}

function isPlaceholderImage(url: string): boolean {
	return LASTFM_PLACEHOLDER_HASHES.some((h) => url.includes(h));
}

function bestImage(images: Array<{ size: string; "#text": string }> | undefined): string | undefined {
	const img = images?.find((i) => i.size === "large")?.["#text"]?.trim();
	return img && !isPlaceholderImage(img) ? img : undefined;
}

async function lastfmUserFetch<T>(apiKey: string, method: string, params: Record<string, string>): Promise<T> {
	const url = new URL(BASE);
	url.searchParams.set("api_key", apiKey);
	url.searchParams.set("format", "json");
	url.searchParams.set("method", method);
	for (const [k, v] of Object.entries(params)) {
		url.searchParams.set(k, v);
	}

	const res = await fetch(url.toString());
	if (!res.ok) {
		if (res.status === 403) throw new Error("Invalid Last.fm API key");
		if (res.status === 429) throw new Error("Last.fm rate limited");
		throw new Error(`Last.fm API error: ${res.status}`);
	}
	const data = await res.json();
	if (data.error) {
		throw new Error(data.message || `Last.fm error ${data.error}`);
	}
	return data as T;
}

export async function lastfmGetUserInfo(apiKey: string, username: string): Promise<LfmUserInfo> {
	const data = await lastfmUserFetch<LfmUserInfoRaw>(apiKey, "user.getinfo", {
		user: username,
	});
	const user = data.user;
	return {
		username: user.name,
		totalScrobbles: parseInt(user.playcount, 10) || 0,
		registered: user.registered?.["#text"] || "",
		imageUrl: bestImage(user.image),
	};
}

export async function lastfmGetRecentTracks(
	apiKey: string,
	username: string,
	limit = 50,
	page = 1,
	from?: number,
	to?: number,
): Promise<LfmRecentTrack[]> {
	const params: Record<string, string> = {
		user: username,
		limit: String(limit),
		page: String(page),
	};
	if (from !== undefined) params.from = String(Math.floor(from / 1000));
	if (to !== undefined) params.to = String(Math.floor(to / 1000));

	const data = await lastfmUserFetch<LfmRecentTracksRaw>(apiKey, "user.getrecenttracks", params);
	const tracks = asArray(data.recenttracks?.track);
	return tracks
		.filter((t) => t.date || t["@attr"]?.nowplaying)
		.map((t) => {
			const artistName =
				"#text" in t.artist ? (t.artist as { "#text": string })["#text"] : (t.artist as { name: string }).name;
			return {
				name: t.name,
				artist: artistName,
				album: t.album?.["#text"] || "",
				albumArt: bestImage(t.image),
				playedAt: t.date?.uts ? parseInt(t.date.uts, 10) * 1000 : Date.now(),
			};
		});
}

export async function lastfmGetTopTracks(
	apiKey: string,
	username: string,
	period: string,
	limit = 200,
): Promise<LfmTopTrack[]> {
	const data = await lastfmUserFetch<LfmTopTracksRaw>(apiKey, "user.gettoptracks", {
		user: username,
		period,
		limit: String(limit),
	});
	const tracks = asArray(data.toptracks?.track);
	return tracks.map((t) => ({
		name: t.name,
		artist: t.artist?.name || "",
		playCount: parseInt(t.playcount, 10) || 0,
		albumArt: bestImage(t.image),
	}));
}

export async function lastfmGetTopArtists(
	apiKey: string,
	username: string,
	period: string,
	limit = 100,
): Promise<LfmTopArtist[]> {
	const data = await lastfmUserFetch<LfmTopArtistsRaw>(apiKey, "user.gettopartists", {
		user: username,
		period,
		limit: String(limit),
	});
	const artists = asArray(data.topartists?.artist);
	return artists.map((a) => ({
		name: a.name,
		playCount: parseInt(a.playcount, 10) || 0,
		imageUrl: bestImage(a.image),
	}));
}

export async function lastfmGetTopAlbums(
	apiKey: string,
	username: string,
	period: string,
	limit = 100,
): Promise<LfmTopAlbum[]> {
	const data = await lastfmUserFetch<LfmTopAlbumsRaw>(apiKey, "user.gettopalbums", {
		user: username,
		period,
		limit: String(limit),
	});
	const albums = asArray(data.topalbums?.album);
	return albums.map((a) => ({
		name: a.name,
		artist: a.artist?.name || "",
		playCount: parseInt(a.playcount, 10) || 0,
		imageUrl: bestImage(a.image),
	}));
}

interface LfmTrackInfoRaw {
	track?: { userplaycount?: string };
}

export async function lastfmGetTrackUserPlaycount(
	apiKey: string,
	username: string,
	artist: string,
	track: string,
): Promise<number | null> {
	try {
		const data = await lastfmUserFetch<LfmTrackInfoRaw>(apiKey, "track.getInfo", {
			artist,
			track,
			username,
			autocorrect: "1",
		});
		const raw = data.track?.userplaycount;
		return raw !== undefined ? parseInt(raw, 10) || 0 : null;
	} catch {
		return null;
	}
}
