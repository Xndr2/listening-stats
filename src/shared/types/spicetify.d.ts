/**
 * Minimal typings for the parts of the Spicetify global we use.
 *
 * Grow this file as modules are ported from v2 - v2's copy lives at
 * ../listening-stats/src/shared/types/spicetify.d.ts and covers Platform
 * (RootlistAPI, PlaylistAPI, Session, UserAPI), Locale, and more.
 *
 * These APIs are undocumented and version-dependent: mark members optional
 * and feature-detect at runtime when a Spotify update could remove them.
 */
declare namespace Spicetify {
	const React: typeof import("react");
	const ReactDOM: typeof import("react-dom");

	namespace Player {
		function addEventListener(event: string, callback: (...args: unknown[]) => void): void;
		function removeEventListener(event: string, callback: (...args: unknown[]) => void): void;
		/** Current playback position in milliseconds */
		function getProgress(): number;
		/** Total track duration in milliseconds */
		function getDuration(): number;
		function playUri(uri: string, context?: unknown, options?: unknown): Promise<void>;
		/** Current player state including track metadata */
		let data:
			| {
					isPaused: boolean;
					item: {
						uri: string;
						name: string;
						/** "track" | "episode" | "chapter" ... */
						type?: string;
						/** "narration" for Spotify DJ voice clips, "ad" for ads. */
						provider?: string;
						duration?: { milliseconds: number };
						metadata?: {
							title?: string;
							artist_name?: string;
							artist_uri?: string;
							album_title?: string;
							album_uri?: string;
							image_url?: string;
							image_xlarge_url?: string;
						};
					} | null;
			  }
			| null
			| undefined;
	}

	namespace Platform {
		namespace History {
			function push(path: string): void;
		}
		const username: string | undefined;
		const ClipboardAPI: { copy?: (text: string) => Promise<void> } | undefined;
		const AuthorizationAPI: { getState?: () => { token?: { accessToken?: string } } | undefined } | undefined;
		/** Missing on some clients: feature-detect. */
		const PrivateSessionAPI: { subscribeToPrivateSession?: (cb: (enabled: boolean) => void) => unknown } | undefined;
	}

	namespace LocalStorage {
		function get(key: string): string | null;
		function set(key: string, value: string): void;
		function remove(key: string): void;
	}

	namespace CosmosAsync {
		type Body = Record<string, unknown>;
		function get(url: string, body?: Body, headers?: Record<string, string>): Promise<unknown>;
		function post(url: string, body?: Body, headers?: Record<string, string>): Promise<unknown>;
	}

	/** Filtered copy of `config-xpui.ini`. */
	namespace Config {
		const version: string;
		const current_theme: string;
		const color_scheme: string;
		const extensions: string[];
		const custom_apps: string[];
	}

	/**
	 * Spotify's own React components. Not guaranteed to exist on every client
	 * version - wrap them (see v2 src/app/components/spicetify-ui.tsx).
	 */
	namespace ReactComponent {
		const TooltipWrapper: import("react").FC<{
			children?: import("react").ReactNode;
			label: string;
			placement?: string;
		}>;
		const Toggle: import("react").FC<{ value: boolean; onSelected: (v: boolean) => void }>;
	}

	/** Display a toast notification */
	function showNotification(message: string, isError?: boolean): void;
}
