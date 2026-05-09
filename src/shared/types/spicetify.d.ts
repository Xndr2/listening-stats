declare namespace Spicetify {
	const React: typeof import("react");
	const ReactDOM: typeof import("react-dom");

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
		function request(
			method: Method,
			url: string,
			body?: Body,
			headers?: Record<string, string>,
		): Promise<Response>;
	}
}
