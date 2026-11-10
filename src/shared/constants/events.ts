/**
 * Window events. The page (index.js) and the background extension
 * (extension.js) run in the same window, so these are how they talk.
 */
export const EVENTS = {
	SETTINGS_CHANGED: "listening-stats:settings-changed",
	PLAY_RECORDED: "listening-stats:play-recorded",
	TRACKER_HEALTH: "listening-stats:tracker-health",
	PLAYLISTS_CHANGED: "listening-stats:playlists-changed",
	ERROR_LOGGED: "listening-stats:error-logged",
} as const;

export function emit<T>(name: string, detail?: T): void {
	window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function listen<T>(name: string, fn: (detail: T) => void): () => void {
	const handler = (e: Event) => fn((e as CustomEvent<T>).detail);
	window.addEventListener(name, handler);
	return () => window.removeEventListener(name, handler);
}
