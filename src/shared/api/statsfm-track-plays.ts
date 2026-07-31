import { LS_KEYS } from "../constants/storage-keys";
import type { SfmTopTrack } from "../types/statsfm";

const BASE = "https://api.stats.fm/api/v1";

const PAGE_SIZE = 100;
const MAX_OFFSET = 4000;

function spotifyIdFromTrackUri(uri: string): string | null {
	const m = uri.match(/^spotify:track:(.+)$/i);
	return m ? m[1] : null;
}

function statsFmRangeForDashboardPeriod(periodId: string): string | null {
	const map: Record<string, string> = {
		"sfm-today": "today",
		"sfm-weeks": "weeks",
		"sfm-months": "months",
		"sfm-all-time": "lifetime",
	};
	return map[periodId] ?? null;
}

/**
 * Paginates stats.fm top tracks until the Spotify id is found or the list ends.
 * Free accounts may cap pages; we scan up to MAX_OFFSET for deep catalog tracks.
 */
async function fetchStatsFmTopTrackStreams(username: string, trackUri: string, range: string): Promise<number | null> {
	const spotifyId = spotifyIdFromTrackUri(trackUri);
	if (!spotifyId || !username.trim()) return null;

	for (let offset = 0; offset < MAX_OFFSET; offset += PAGE_SIZE) {
		const url = new URL(`${BASE}/users/${encodeURIComponent(username.trim())}/top/tracks`);
		url.searchParams.set("range", range);
		url.searchParams.set("limit", String(PAGE_SIZE));
		url.searchParams.set("offset", String(offset));

		let res: Response;
		try {
			res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
		} catch {
			return null;
		}
		if (!res.ok) return null;
		const json = (await res.json()) as { items?: SfmTopTrack[]; item?: SfmTopTrack[] };
		const items = json.items ?? json.item ?? [];
		if (!Array.isArray(items) || items.length === 0) return null;
		for (const row of items) {
			const sid = row.track?.externalIds?.spotify?.[0];
			if (sid === spotifyId) return row.streams;
		}
		if (items.length < PAGE_SIZE) return null;
	}
	return null;
}

export async function fetchStatsFmLifetimeTrackStreams(username: string, trackUri: string): Promise<number | null> {
	return fetchStatsFmTopTrackStreams(username, trackUri, "lifetime");
}

export async function fetchStatsFmPeriodTrackStreams(
	username: string,
	trackUri: string,
	dashboardPeriodId: string,
): Promise<number | null> {
	const range = statsFmRangeForDashboardPeriod(dashboardPeriodId);
	if (!range) return null;
	return fetchStatsFmTopTrackStreams(username, trackUri, range);
}

export function readStatsFmUsername(): string | null {
	try {
		const raw = localStorage.getItem(LS_KEYS.STATSFM_CONFIG);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { username?: string };
		return typeof parsed.username === "string" ? parsed.username : null;
	} catch {
		return null;
	}
}
