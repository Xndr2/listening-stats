import { LS_KEYS } from "../constants/storage-keys";
import { lastfmGetTrackUserPlaycount } from "./lastfm-client";

interface LastfmConfig {
	apiKey: string;
	username: string;
}

function readLastfmConfig(): LastfmConfig | null {
	try {
		const raw = localStorage.getItem(LS_KEYS.LASTFM_CONFIG);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<LastfmConfig>;
		return typeof parsed.apiKey === "string" && typeof parsed.username === "string"
			? { apiKey: parsed.apiKey, username: parsed.username }
			: null;
	} catch {
		return null;
	}
}

export function readLastfmUsername(): string | null {
	return readLastfmConfig()?.username ?? null;
}

export async function fetchLastfmLifetimeTrackPlaycount(artist: string, track: string): Promise<number | null> {
	const config = readLastfmConfig();
	if (!config) return null;
	return lastfmGetTrackUserPlaycount(config.apiKey, config.username, artist, track);
}
