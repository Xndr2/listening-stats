/**
 * The playlist operations LS needs, mapped onto Spotify's internal Platform
 * APIs (the same ones Spotify's own UI uses, so no Web API rate limits).
 * Signatures were read from client 1.2.95. Returns null when a client update
 * removed something, so callers can report "not available" instead of crashing.
 */

export interface OwnedPlaylist {
	uri: string;
	name: string;
	description: string;
}

export interface PlaylistApi {
	listOwned(): Promise<OwnedPlaylist[]>;
	create(name: string): Promise<string>;
	trackUris(uri: string): Promise<string[]>;
	replaceTracks(uri: string, trackUris: string[]): Promise<void>;
	setDetails(uri: string, details: { name?: string; description: string }): Promise<void>;
	setPublic(uri: string, isPublic: boolean): Promise<void>;
}

interface RootItem {
	type?: string;
	uri?: string;
	name?: string;
	description?: string;
	isOwnedBySelf?: boolean;
	items?: RootItem[];
}

type AnyFn = (...args: unknown[]) => Promise<unknown>;

export function spotifyPlaylistApi(): PlaylistApi | null {
	const P = (globalThis as unknown as { Spicetify?: { Platform?: Record<string, Record<string, AnyFn> | undefined> } })
		.Spicetify?.Platform;
	const root = P?.RootlistAPI;
	const pl = P?.PlaylistAPI;
	if (!root?.getContents || !root.createPlaylist || !pl?.add || !pl.remove || !pl.getContents || !pl.updateDetails)
		return null;

	const contents = async (uri: string) => {
		const out: Array<{ uri: string; uid: string }> = [];
		for (let offset = 0; ; offset += 100) {
			const page = (await pl.getContents(uri, { limit: 100, offset })) as {
				items?: Array<{ uri: string; uid: string }>;
			};
			const items = page.items ?? [];
			out.push(...items.map(({ uri, uid }) => ({ uri, uid })));
			if (items.length < 100) return out;
		}
	};

	return {
		async listOwned() {
			const tree = (await root.getContents({})) as RootItem;
			const out: OwnedPlaylist[] = [];
			const walk = (items: RootItem[] = []) => {
				for (const i of items) {
					if (i.type === "playlist" && i.isOwnedBySelf && i.uri) {
						out.push({ uri: i.uri, name: i.name ?? "", description: i.description ?? "" });
					}
					if (i.items) walk(i.items);
				}
			};
			walk(tree.items);
			return out;
		},
		async create(name) {
			const uri = (await root.createPlaylist(name, { before: "start" })) as string | null;
			if (!uri) throw new Error("Spotify didn't create the playlist.");
			return uri;
		},
		async trackUris(uri) {
			return (await contents(uri)).map((i) => i.uri);
		},
		async replaceTracks(uri, trackUris) {
			// Add the new tracks first, then remove the old rows by uid. If the
			// add fails, the playlist keeps its old contents instead of ending up empty.
			const old = await contents(uri);
			if (trackUris.length) await pl.add(uri, trackUris, { after: "end" });
			for (let i = 0; i < old.length; i += 100) await pl.remove(uri, old.slice(i, i + 100));
		},
		async setDetails(uri, details) {
			await pl.updateDetails(uri, details);
		},
		async setPublic(uri, isPublic) {
			// "VIEWER" = anyone with the link, "BLOCKED" = only you. Missing on some clients.
			await P?.PlaylistPermissionsAPI?.setBasePermission?.(uri, isPublic ? "VIEWER" : "BLOCKED");
		},
	};
}
