/**
 * Liked Songs state for the hearts LS shows. One shared map so every heart
 * for the same track agrees, filled in batches through Spotify's own
 * LibraryAPI (the same calls Spotify's heart buttons use).
 */
import { useEffect, useState } from "react";
import { captureError } from "../shared/errors/capture";

type Lib = {
	contains?: (...uris: string[]) => Promise<boolean[]>;
	add?: (a: { uris: string[] }) => Promise<void>;
	remove?: (a: { uris: string[] }) => Promise<void>;
};

const liked = new Map<string, boolean>();
const listeners = new Set<() => void>();
const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

const TRACK = /^spotify:track:[A-Za-z0-9]{22}$/;

function lib(): Lib | undefined {
	return (Spicetify.Platform as unknown as { LibraryAPI?: Lib } | undefined)?.LibraryAPI;
}

export function likesAvailable(): boolean {
	const l = lib();
	return !!(l?.contains && l.add && l.remove);
}

function notify(): void {
	for (const l of listeners) l();
}

/** Looks up everything requested in the last tick in one call per 50 uris. */
function flush(): void {
	timer = null;
	const uris = [...pending];
	pending.clear();
	const l = lib();
	if (!l?.contains || uris.length === 0) return;
	for (let i = 0; i < uris.length; i += 50) {
		const batch = uris.slice(i, i + 50);
		void l
			.contains(...batch)
			.then((res) => {
				for (let j = 0; j < batch.length; j++) liked.set(batch[j], !!res[j]);
				notify();
			})
			.catch(() => {});
	}
}

function request(uris: string[]): void {
	for (const u of uris) if (TRACK.test(u) && !liked.has(u)) pending.add(u);
	if (pending.size && !timer) timer = setTimeout(flush, 0);
}

export async function toggleLike(uri: string): Promise<void> {
	const l = lib();
	if (!l?.add || !l.remove || !TRACK.test(uri)) return;
	const was = liked.get(uri) ?? false;
	liked.set(uri, !was);
	notify();
	try {
		if (was) await l.remove({ uris: [uri] });
		else await l.add({ uris: [uri] });
	} catch (err) {
		liked.set(uri, was);
		notify();
		void captureError(err, "app", "handled", "like");
		Spicetify.showNotification("Spotify didn't save that change.", true);
	}
}

/** Liked state for one track; undefined while unknown. */
export function useLiked(uri: string | undefined): boolean | undefined {
	const [, bump] = useState(0);
	useEffect(() => {
		const fn = () => bump((n) => n + 1);
		listeners.add(fn);
		return () => {
			listeners.delete(fn);
		};
	}, []);
	useEffect(() => {
		if (uri) request([uri]);
	}, [uri]);
	return uri ? liked.get(uri) : undefined;
}
