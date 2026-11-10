/**
 * Connecting and disconnecting providers. Each connect checks the details
 * against the real API before saving, so a typo is caught here instead of
 * as an error on every widget later.
 */
import { EVENTS, emit } from "../constants/events";
import { getSetting, type ProviderId, setSetting } from "../settings/registry";
import { mirrorCredentials } from "../storage/credential-mirror";
import { isValidApiKey, isValidLfmUsername, lfmCall, writeLastFmConfig } from "./lastfm/client";
import { fetchSfmUser, isValidUsername, writeStatsFmConfig } from "./statsfm/client";

function changed(): void {
	emit(EVENTS.SETTINGS_CHANGED, { name: "connections", value: null });
	void mirrorCredentials().catch(() => {});
}

/** Returns the display name on success; throws an Error with a user-facing message. */
export async function connectStatsFm(input: string): Promise<string> {
	const username = input
		.trim()
		.replace(/^https?:\/\/(www\.)?stats\.fm\/(user\/)?/i, "")
		.replace(/\/$/, "");
	if (!isValidUsername(username))
		throw new Error("Use the username from your stats.fm profile link, like stats.fm/your-name.");
	const user = await fetchSfmUser(username);
	writeStatsFmConfig({
		username: user.customId || username,
		isPlus: user.isPlus === true,
		connectedAt: Date.now(),
		lastValidated: Date.now(),
	});
	changed();
	return user.displayName;
}

export async function connectLastFm(usernameInput: string, keyInput: string): Promise<string> {
	const username = usernameInput.trim();
	const apiKey = keyInput.trim();
	if (!isValidLfmUsername(username)) throw new Error("That doesn't look like a Last.fm username.");
	if (!isValidApiKey(apiKey))
		throw new Error("A Last.fm API key is 32 letters and numbers. You can create one at last.fm/api.");
	const res = await lfmCall<{ user?: { name?: string } }>("user.getinfo", {}, { username, apiKey });
	writeLastFmConfig({ apiKey, username: res.user?.name ?? username });
	changed();
	return res.user?.name ?? username;
}

export function disconnect(id: Exclude<ProviderId, "local">): void {
	if (id === "statsfm") writeStatsFmConfig(null);
	else writeLastFmConfig(null);
	if (getSetting("activeProvider") === id) setSetting("activeProvider", "local");
	changed();
}
