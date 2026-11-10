/** All providers, and which ones the user has connected. */
import type { ProviderId } from "../settings/registry";
import { getSetting } from "../settings/registry";
import { readLastFmConfig } from "./lastfm/client";
import { lastFmProvider } from "./lastfm/lastfm-provider";
import { localProvider } from "./local/local-provider";
import { readStatsFmConfig } from "./statsfm/client";
import { statsFmProvider } from "./statsfm/statsfm-provider";
import type { Provider } from "./types";

export const PROVIDERS: Record<ProviderId, Provider> = {
	local: localProvider,
	statsfm: statsFmProvider,
	lastfm: lastFmProvider,
};

export function isConnected(id: ProviderId): boolean {
	if (id === "statsfm") return readStatsFmConfig() !== null;
	if (id === "lastfm") return readLastFmConfig() !== null;
	return true;
}

/** The chosen provider, or local when the chosen one isn't connected any more. */
export function activeProviderId(): ProviderId {
	const id = getSetting("activeProvider");
	return isConnected(id) ? id : "local";
}
