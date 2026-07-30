const NAVIGABLE_URI_TYPES = new Set(["track", "artist", "album", "playlist", "show", "episode", "user"]);

export function navigateToUri(uri: string): void {
	const parts = uri.split(":");
	// Only real Spotify catalog URIs map to routes. Local files
	// (spotify:local:…) and synthetic import URIs (listening-stats:…) have no
	// page to open - pushing /local/… would land on a broken route.
	if (parts.length >= 3 && parts[0] === "spotify" && NAVIGABLE_URI_TYPES.has(parts[1]) && parts[2]) {
		Spicetify.Platform.History.push(`/${parts[1]}/${parts[2]}`);
	}
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

export function downloadBufferAsFile(buffer: ArrayBuffer, filename: string, mimeType = "application/zip"): void {
	const blob = new Blob([buffer], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
