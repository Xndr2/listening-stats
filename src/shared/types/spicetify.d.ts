declare namespace Spicetify {
	const React: typeof import("react");
	const ReactDOM: typeof import("react-dom");

	namespace Platform {
		namespace History {
			function push(path: string): void;
		}

		/** Position argument for rootlist/playlist mutations. */
		type PlaylistPosition = { before: "start" | number } | { after: "end" | number | { uri: string } };

		/**
		 * Internal desktop-client APIs (not the public Web API - no developer-app
		 * rate limits). Undocumented and version-dependent: feature-detect optional
		 * members at runtime.
		 */
		const RootlistAPI: {
			createPlaylist(name: string, position: PlaylistPosition): Promise<string | { uri?: string }>;
		};

		const PlaylistAPI: {
			getMetadata(uri: string): Promise<{ name?: string; images?: { url: string }[] }>;
			getContents(
				uri: string,
				opts?: { limit?: number; offset?: number },
			): Promise<{ items: { uri: string; uid: string }[]; totalLength?: number }>;
			add(playlistUri: string, trackUris: string[], position: PlaylistPosition): Promise<void>;
			remove(playlistUri: string, items: { uri: string; uid: string }[]): Promise<void>;
			setAttributes(
				playlistUri: string,
				attributes: { name?: string; description?: string; picture?: string },
			): Promise<void>;
			/** Returns an upload token for register-image. Missing on some client versions. */
			uploadImage?(file: File): Promise<unknown>;
			clear?(playlistUri: string): Promise<void>;
			resync?(playlistUri: string): Promise<void>;
		};

		/** Playlist visibility: "VIEWER" = public, "BLOCKED" = private. Missing on some client versions. */
		const PlaylistPermissionsAPI:
			| {
					setBasePermission?(playlistUri: string, permission: "VIEWER" | "BLOCKED"): Promise<void>;
			  }
			| undefined;

		/** Client session; accessToken authorizes internal spclient endpoints. */
		const Session: { accessToken?: string } | undefined;

		/** Current user lookup. Missing on some client versions - always feature-detect. */
		const UserAPI:
			| {
					getUser?(): Promise<{ username?: string; displayName?: string } | null | undefined>;
			  }
			| undefined;
	}

	namespace Locale {
		function formatNumber(n: number): string;
		function formatRelativeTime(ms: number): string;
	}

	namespace ReactComponent {
		type TooltipWrapperProps = {
			children?: import("react").ReactNode;
			label: string;
			placement?: string;
		};
		const TooltipWrapper: import("react").FC<TooltipWrapperProps>;

		type ToggleProps = {
			value: boolean;
			onSelected: (v: boolean) => void;
		};
		const Toggle: import("react").FC<ToggleProps>;
	}

	/** Filtered copy of `config-xpui.ini`  -  lists enabled apps/extensions, not filesystem paths. */
	namespace Config {
		const version: string;
		const current_theme: string;
		const color_scheme: string;
		const extensions: string[];
		const custom_apps: string[];
		const check_spicetify_update: boolean;
	}
	namespace Player {
		function addEventListener(event: string, callback: (...args: unknown[]) => void): void;
		function removeEventListener(event: string, callback: (...args: unknown[]) => void): void;
		/** Current playback position in milliseconds */
		function getProgress(): number;
		/** Total track duration in milliseconds */
		function getDuration(): number;
		/** Repeat mode: 0=off, 1=all, 2=one */
		function getRepeat(): 0 | 1 | 2;
		/** Current player state including track metadata */
		let data:
			| {
					isPaused: boolean;
					item: {
						uri: string;
						name: string;
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
	/** Display a toast notification */
	function showNotification(message: string, isError?: boolean): void;
	namespace CosmosAsync {
		interface Response {
			body: unknown;
			headers: Record<string, string>;
			status: number;
			uri?: string;
		}
		interface Body {
			[key: string]: unknown;
		}
		type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";
		function get(url: string, body?: Body, headers?: Record<string, string>): Promise<unknown>;
		function post(url: string, body?: Body, headers?: Record<string, string>): Promise<unknown>;
		function put(url: string, body?: Body, headers?: Record<string, string>): Promise<unknown>;
		function del(url: string, body?: Body, headers?: Record<string, string>): Promise<unknown>;
		function request(method: Method, url: string, body?: Body, headers?: Record<string, string>): Promise<Response>;
	}
}
