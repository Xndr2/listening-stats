export function navigateToUri(uri: string): void {
	const parts = uri.split(":");
	if (parts.length >= 3) {
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

export function downloadBufferAsFile(
	buffer: ArrayBuffer,
	filename: string,
	mimeType = "application/zip",
): void {
	const blob = new Blob([buffer], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
