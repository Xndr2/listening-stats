/**
 * Draws share cards on a canvas. Cards leave Spotify, so they pick their own
 * background (tinted from the top cover, dark, light or the theme accent)
 * instead of following the user's theme.
 */
import { isSafeImageUrl } from "../../shared/util/url-allowlist";

export type CardLayout = "story" | "square" | "wide";
export type CardBackground = "cover" | "dark" | "light" | "accent";

export interface CardItem {
	title: string;
	subtitle: string;
	image?: string;
	value: string;
}

export interface CardStat {
	label: string;
	value: string;
}

export interface CardData {
	heading: string;
	period: string;
	hero?: string;
	heroLabel?: string;
	items: CardItem[];
	/** Shown instead of a list when the card is a stats card. */
	stats?: CardStat[];
	footer?: string;
	caption?: string;
	/** Items have no artwork (genres). */
	textOnly?: boolean;
}

export const SIZES: Record<CardLayout, { w: number; h: number }> = {
	story: { w: 1080, h: 1920 },
	square: { w: 1080, h: 1080 },
	wide: { w: 1200, h: 630 },
};

async function loadImage(url: string | undefined): Promise<ImageBitmap | null> {
	if (!isSafeImageUrl(url)) return null;
	try {
		const res = await fetch(url);
		return await createImageBitmap(await res.blob());
	} catch {
		return null;
	}
}

/** Average colour of an image, darkened so light text stays readable. */
function tint(img: ImageBitmap | null): string {
	if (!img) return "rgb(32, 32, 32)";
	const c = new OffscreenCanvas(8, 8);
	const ctx = c.getContext("2d");
	if (!ctx) return "rgb(32, 32, 32)";
	ctx.drawImage(img, 0, 0, 8, 8);
	const d = ctx.getImageData(0, 0, 8, 8).data;
	let r = 0;
	let g = 0;
	let b = 0;
	for (let i = 0; i < d.length; i += 4) {
		r += d[i];
		g += d[i + 1];
		b += d[i + 2];
	}
	const n = d.length / 4;
	const k = 0.5;
	return `rgb(${Math.round((r / n) * k)}, ${Math.round((g / n) * k)}, ${Math.round((b / n) * k)})`;
}

interface Palette {
	top: string;
	bottom: string;
	text: string;
	sub: string;
	faint: string;
	accent: string;
}

function palette(bg: CardBackground, accent: string, cover: ImageBitmap | null): Palette {
	switch (bg) {
		case "light":
			return {
				top: "#fafafa",
				bottom: "#e8e8e8",
				text: "#111",
				sub: "rgba(0,0,0,0.62)",
				faint: "rgba(0,0,0,0.4)",
				accent: "#111",
			};
		case "accent":
			return {
				top: accent,
				bottom: "rgb(12, 12, 12)",
				text: "#fff",
				sub: "rgba(255,255,255,0.78)",
				faint: "rgba(255,255,255,0.5)",
				accent: "#fff",
			};
		case "dark":
			return {
				top: "rgb(30, 30, 30)",
				bottom: "rgb(8, 8, 8)",
				text: "#fff",
				sub: "rgba(255,255,255,0.7)",
				faint: "rgba(255,255,255,0.45)",
				accent,
			};
		default:
			return {
				top: tint(cover),
				bottom: "rgb(10, 10, 10)",
				text: "#fff",
				sub: "rgba(255,255,255,0.72)",
				faint: "rgba(255,255,255,0.5)",
				accent,
			};
	}
}

function fontFamily(): string {
	return getComputedStyle(document.body).fontFamily || "sans-serif";
}

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number): string {
	if (ctx.measureText(text).width <= max) return text;
	let t = text;
	while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
	return `${t.trimEnd()}…`;
}

function roundImage(
	ctx: CanvasRenderingContext2D,
	img: ImageBitmap | null,
	x: number,
	y: number,
	s: number,
	r: number,
) {
	ctx.save();
	ctx.beginPath();
	ctx.roundRect(x, y, s, s, r);
	ctx.clip();
	if (img) ctx.drawImage(img, x, y, s, s);
	else {
		ctx.fillStyle = "rgba(128,128,128,0.25)";
		ctx.fillRect(x, y, s, s);
	}
	ctx.restore();
}

/** A vertical list of rows in the box (x, y, w, h); row height adapts to the count. */
function drawList(
	ctx: CanvasRenderingContext2D,
	p: Palette,
	font: string,
	items: CardItem[],
	images: Array<ImageBitmap | null>,
	box: { x: number; y: number; w: number; h: number },
	textOnly: boolean,
) {
	const n = Math.max(1, items.length);
	const row = Math.min(box.h / n, 220);
	const art = textOnly ? 0 : Math.round(row * 0.72);
	const titleSize = Math.round(Math.min(52, row * 0.26));
	const subSize = Math.round(titleSize * 0.74);
	const rankW = Math.round(titleSize * 1.4);
	items.forEach((it, i) => {
		const top = box.y + i * row;
		const mid = top + row / 2;
		ctx.fillStyle = p.faint;
		ctx.font = `800 ${titleSize}px ${font}`;
		ctx.fillText(String(i + 1), box.x, mid + titleSize * 0.35);
		const x = box.x + rankW + (art ? art + Math.round(titleSize * 0.6) : 0);
		if (art) roundImage(ctx, images[i] ?? null, box.x + rankW, mid - art / 2, art, Math.round(art * 0.08));
		const max = box.x + box.w - x;
		ctx.fillStyle = p.text;
		ctx.font = `700 ${titleSize}px ${font}`;
		ctx.fillText(fitText(ctx, it.title, max), x, mid - subSize * 0.15);
		ctx.fillStyle = p.sub;
		ctx.font = `500 ${subSize}px ${font}`;
		ctx.fillText(fitText(ctx, [it.subtitle, it.value].filter(Boolean).join(" · "), max), x, mid + subSize * 1.15);
	});
}

function drawStats(
	ctx: CanvasRenderingContext2D,
	p: Palette,
	font: string,
	stats: CardStat[],
	box: { x: number; y: number; w: number; h: number },
) {
	const cols = 2;
	const rows = Math.ceil(stats.length / cols);
	const cw = box.w / cols;
	const rh = Math.min(box.h / rows, 260);
	stats.forEach((s, i) => {
		const x = box.x + (i % cols) * cw;
		const y = box.y + Math.floor(i / cols) * rh;
		ctx.fillStyle = p.sub;
		ctx.font = `700 ${Math.round(rh * 0.14)}px ${font}`;
		ctx.fillText(s.label.toUpperCase(), x, y + rh * 0.3);
		ctx.fillStyle = p.text;
		ctx.font = `800 ${Math.round(rh * 0.34)}px ${font}`;
		ctx.fillText(fitText(ctx, s.value, cw - 24), x, y + rh * 0.72);
	});
}

export async function renderCard(
	data: CardData,
	layout: CardLayout,
	bg: CardBackground,
	accent: string,
): Promise<HTMLCanvasElement> {
	const { w, h } = SIZES[layout];
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas isn't available");
	const font = fontFamily();
	const images = data.textOnly ? [] : await Promise.all(data.items.map((i) => loadImage(i.image)));
	const p = palette(bg, accent, images[0] ?? null);

	const grad = ctx.createLinearGradient(0, 0, 0, h);
	grad.addColorStop(0, p.top);
	grad.addColorStop(1, p.bottom);
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, w, h);
	ctx.textBaseline = "alphabetic";

	const pad = layout === "wide" ? 56 : 84;
	const brandSize = layout === "wide" ? 22 : 32;
	ctx.fillStyle = p.sub;
	ctx.font = `700 ${brandSize}px ${font}`;
	ctx.fillText("Listening Stats", pad, pad + brandSize * 0.6);

	if (layout === "wide") {
		// Cover of #1 on the left, list on the right.
		const art = h - pad * 2;
		const withArt = !data.textOnly && !data.stats;
		if (withArt) roundImage(ctx, images[0] ?? null, pad, pad, art, 16);
		const x = withArt ? pad * 2 + art : pad;
		const max = w - x - pad;
		ctx.fillStyle = p.accent;
		ctx.font = `700 24px ${font}`;
		ctx.fillText(data.period, x, pad + 64);
		ctx.fillStyle = p.text;
		ctx.font = `800 46px ${font}`;
		ctx.fillText(fitText(ctx, data.heading, max), x, pad + 116);
		let y = pad + 140;
		if (data.hero) {
			ctx.fillStyle = p.sub;
			ctx.font = `600 24px ${font}`;
			ctx.fillText(fitText(ctx, `${data.hero} ${data.heroLabel ?? ""}`, max), x, y + 22);
			y += 40;
		}
		const box = { x, y: y + 6, w: max, h: h - pad - 30 - (y + 6) };
		if (data.stats) drawStats(ctx, p, font, data.stats, box);
		else drawList(ctx, p, font, data.items, images, box, !!data.textOnly);
	} else {
		const big = layout === "story";
		ctx.fillStyle = p.text;
		ctx.font = `800 ${big ? 84 : 64}px ${font}`;
		ctx.fillText(fitText(ctx, data.heading, w - pad * 2), pad, pad + (big ? 200 : 140));
		ctx.fillStyle = p.accent;
		ctx.font = `700 ${big ? 44 : 34}px ${font}`;
		ctx.fillText(data.period, pad, pad + (big ? 266 : 192));
		let y = pad + (big ? 300 : 222);
		if (data.hero) {
			const s = big ? 136 : 92;
			ctx.fillStyle = p.text;
			ctx.font = `800 ${s}px ${font}`;
			ctx.fillText(data.hero, pad, y + s);
			ctx.fillStyle = p.sub;
			ctx.font = `600 ${big ? 40 : 30}px ${font}`;
			ctx.fillText(data.heroLabel ?? "", pad, y + s + (big ? 56 : 44));
			y += s + (big ? 120 : 84);
		}
		const box = { x: pad, y, w: w - pad * 2, h: h - y - pad - 70 };
		if (data.stats) drawStats(ctx, p, font, data.stats, box);
		else drawList(ctx, p, font, data.items, images, box, !!data.textOnly);
	}

	if (data.caption || data.footer) {
		ctx.fillStyle = p.faint;
		ctx.font = `600 ${layout === "wide" ? 20 : 30}px ${font}`;
		const text = [data.caption, data.footer].filter(Boolean).join(" · ");
		ctx.fillText(fitText(ctx, text, w - pad * 2), pad, h - pad + (layout === "wide" ? 20 : 10));
	}
	return canvas;
}

export function canvasBlob(c: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) =>
		c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the image"))), "image/png"),
	);
}
