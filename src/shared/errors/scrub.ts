/**
 * Strips anything personal from text before it is stored or reported:
 * credential values the user saved, Spotify user and playlist ids, URL query
 * strings (Last.fm puts the API key there) and anything that looks like a key.
 */
import { V2_KEYS } from "../constants/storage-keys";

const REDACTED = "[redacted]";

/** Values from the user's saved provider connections that must never leave the device. */
export function storedSecrets(): string[] {
	const out: string[] = [];
	try {
		const key = localStorage.getItem(V2_KEYS.LASTFM_API_KEY);
		if (key) out.push(key);
		for (const k of [V2_KEYS.STATSFM_CONFIG, V2_KEYS.LASTFM_CONFIG]) {
			const raw = localStorage.getItem(k);
			if (!raw) continue;
			const cfg = JSON.parse(raw) as Record<string, unknown>;
			for (const field of ["apiKey", "username"]) {
				const v = cfg[field];
				if (typeof v === "string" && v) out.push(v);
			}
		}
	} catch {
		// unreadable config: nothing to add
	}
	// Short values (a 2-letter username) would shred unrelated text; skip them.
	return [...new Set(out)].filter((s) => s.length >= 3);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PATTERNS: Array<[RegExp, string]> = [
	[/spotify:user:[^\s:"'/)]+/g, `spotify:user:${REDACTED}`],
	[/spotify:playlist:[A-Za-z0-9]+/g, `spotify:playlist:${REDACTED}`],
	[/(https?:\/\/[^\s?#"')]+)\?[^\s#"')]*/g, `$1?${REDACTED}`],
	[/(api_key|apikey|token|sentry_key|access_token)=[^\s&"')]+/gi, `$1=${REDACTED}`],
	[/\/users\/[^/\s"')?]+/g, `/users/${REDACTED}`],
];

export function scrubText(text: string, secrets: string[] = storedSecrets()): string {
	let out = text;
	for (const s of secrets) out = out.replace(new RegExp(escapeRe(s), "gi"), REDACTED);
	for (const [re, sub] of PATTERNS) out = out.replace(re, sub);
	return out;
}
