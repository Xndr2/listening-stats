const COVER_SIZE = 640;

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		// Required so the canvas stays untainted and toDataURL works
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`cover art failed to load: ${url}`));
		img.src = url;
	});
}

/**
 * Draw the playlist cover: the top track's album art (or a plain gradient when
 * unavailable) with a "Listening Stats <PERIOD>" label band at the bottom.
 * Returns a JPEG data URL.
 */
export async function generateCoverDataUrl(albumArtUrl: string | undefined, periodLabel: string): Promise<string> {
	const canvas = document.createElement("canvas");
	canvas.width = COVER_SIZE;
	canvas.height = COVER_SIZE;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("canvas 2d context unavailable");

	let art: HTMLImageElement | null = null;
	if (albumArtUrl) {
		art = await loadImage(albumArtUrl).catch(() => null);
	}

	if (art) {
		ctx.drawImage(art, 0, 0, COVER_SIZE, COVER_SIZE);
	} else {
		const bg = ctx.createLinearGradient(0, 0, COVER_SIZE, COVER_SIZE);
		bg.addColorStop(0, "#1e3264");
		bg.addColorStop(1, "#121212");
		ctx.fillStyle = bg;
		ctx.fillRect(0, 0, COVER_SIZE, COVER_SIZE);
	}

	// Darken the lower third so the label stays readable on any art
	const shade = ctx.createLinearGradient(0, COVER_SIZE * 0.55, 0, COVER_SIZE);
	shade.addColorStop(0, "rgba(0,0,0,0)");
	shade.addColorStop(1, "rgba(0,0,0,0.85)");
	ctx.fillStyle = shade;
	ctx.fillRect(0, 0, COVER_SIZE, COVER_SIZE);

	ctx.fillStyle = "#ffffff";
	ctx.textBaseline = "alphabetic";
	ctx.font = "600 36px CircularSp, 'Helvetica Neue', Arial, sans-serif";
	ctx.fillText("Listening Stats", 40, COVER_SIZE - 96);

	// Shrink the period line until it fits the canvas width
	let size = 64;
	ctx.font = `700 ${size}px CircularSp, 'Helvetica Neue', Arial, sans-serif`;
	while (size > 24 && ctx.measureText(periodLabel).width > COVER_SIZE - 80) {
		size -= 4;
		ctx.font = `700 ${size}px CircularSp, 'Helvetica Neue', Arial, sans-serif`;
	}
	ctx.fillText(periodLabel, 40, COVER_SIZE - 36);

	return canvas.toDataURL("image/jpeg", 0.9);
}
