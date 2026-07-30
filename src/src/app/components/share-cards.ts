/**
 * Canvas share-card engine.
 *
 * Every variant is a `build()` function that computes ALL geometry up front
 * (pure, synchronous) and returns `{ height, draw }`. The renderer measures,
 * positions, then draws - measured and drawn layout can never diverge, and
 * every variant adapts its content to the available height instead of
 * overflowing the card.
 */

import { hydrateShareCardAssets } from "../../shared/share/hydrate-share-assets";
import type { StatsResult, TopArtist, TopTrack } from "../../shared/types/stats";
import { normalizeSpotifyImageUrl } from "../../shared/util/spotify-image-url";
import { formatNumber } from "../format";

export type ShareVariant = "top5" | "time" | "genre" | "streak" | "throwback" | "wrapped" | "recap";
export type ShareSize = "square" | "story";

export interface ShareRenderOptions {
	followTheme?: boolean;
	showUsername?: boolean;
	showPeriodLabel?: boolean;
	activeProviderId?: string;
	periodDayCount?: number;
	hasStreakData?: boolean;
}

export const TARGET_DIMENSIONS: Record<ShareSize, { width: number; height: number }> = {
	square: { width: 1080, height: 1080 },
	story: { width: 1080, height: 1920 },
};

const VARIANT_LABELS: { id: ShareVariant; label: string }[] = [
	{ id: "top5", label: "Top 5" },
	{ id: "time", label: "Total time" },
	{ id: "genre", label: "Genre" },
	{ id: "streak", label: "Streak" },
	{ id: "throwback", label: "Throwback" },
	{ id: "wrapped", label: "Wrapped" },
	{ id: "recap", label: "Recap" },
];

/**
 * A card type is offered only when the current stats can fill it - no
 * half-empty cards. Streak additionally requires the provider to have
 * streak data at all.
 */
export function getAvailableVariants(
	stats: StatsResult,
	caps: { hasGenreData: boolean; hasStreakData: boolean } | undefined,
	restrictTo?: ShareVariant[],
): { id: ShareVariant; label: string }[] {
	const hasTracks = stats.topTracks.length > 0;
	const usable = VARIANT_LABELS.filter((v) => {
		if (restrictTo && !restrictTo.includes(v.id)) return false;
		if (v.id === "recap" && !restrictTo) return false; // recap only through the recap flow
		switch (v.id) {
			case "top5":
			case "throwback":
				return hasTracks;
			case "time":
				return stats.totalDuration > 0;
			case "genre":
				return (caps?.hasGenreData ?? true) && stats.topGenres.some((g) => g.count > 0);
			case "streak":
				return (caps?.hasStreakData ?? false) && (stats.streak ?? 0) > 0;
			default:
				return true;
		}
	});
	if (usable.length === 0) return VARIANT_LABELS.filter((v) => v.id === (restrictTo?.[0] ?? "wrapped"));
	return usable;
}

// ── Palette ──────────────────────────────────────────────────────────────────

const CV_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
const ACCENT: [number, number, number] = [30, 215, 96];

interface SharePalette {
	accent: [number, number, number];
	bgA: string;
	bgB: string;
	bgC: string;
	text: string;
	muted: string;
	dim: string;
	faint: string;
	chunkBg: string;
	chunkBorder: string;
	barTrack: string;
}

function rgb(c: [number, number, number], a = 1): string {
	return a === 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function parseCssColorToRgb(value: string | null | undefined): [number, number, number] | null {
	if (!value) return null;
	const v = value.trim();
	const rgbMatch = v.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
	if (rgbMatch) return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
	const hex = v.replace("#", "");
	if (/^[\da-f]{6}$/i.test(hex)) {
		return [
			Number.parseInt(hex.slice(0, 2), 16),
			Number.parseInt(hex.slice(2, 4), 16),
			Number.parseInt(hex.slice(4, 6), 16),
		];
	}
	return null;
}

function getSharePalette(followTheme: boolean): SharePalette {
	if (!followTheme) {
		return {
			accent: ACCENT,
			bgA: "#0c160e",
			bgB: "#122318",
			bgC: "#0a1d12",
			text: "#ffffff",
			muted: "rgba(255,255,255,0.72)",
			dim: "rgba(255,255,255,0.55)",
			faint: "rgba(255,255,255,0.45)",
			chunkBg: "rgba(255,255,255,0.05)",
			chunkBorder: "rgba(255,255,255,0.09)",
			barTrack: "rgba(255,255,255,0.10)",
		};
	}
	const style = getComputedStyle(document.documentElement);
	const accent =
		parseCssColorToRgb(style.getPropertyValue("--spice-button")) ??
		parseCssColorToRgb(style.getPropertyValue("--spice-text")) ??
		ACCENT;
	const base = parseCssColorToRgb(style.getPropertyValue("--spice-main")) ?? [12, 22, 14];
	const text = parseCssColorToRgb(style.getPropertyValue("--spice-text")) ?? [255, 255, 255];
	return {
		accent,
		bgA: rgb([Math.max(0, base[0] - 10), Math.max(0, base[1] - 10), Math.max(0, base[2] - 10)]),
		bgB: rgb(base),
		bgC: rgb([Math.max(0, base[0] - 6), Math.max(0, base[1] - 6), Math.max(0, base[2] - 6)]),
		text: rgb(text),
		muted: rgb(text, 0.72),
		dim: rgb(text, 0.55),
		faint: rgb(text, 0.45),
		chunkBg: rgb(text, 0.06),
		chunkBorder: rgb(text, 0.14),
		barTrack: rgb(text, 0.12),
	};
}

// ── Primitives ───────────────────────────────────────────────────────────────

type Ctx2D = CanvasRenderingContext2D;

const PAD = 72;
const CONTENT_TOP = 170;
const CONTENT_BOTTOM = 128;

/** Consistent line-height step used by all variants. */
function lh(px: number): number {
	return Math.round(px * 1.25);
}

function roundRectPath(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function fillRoundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
	roundRectPath(ctx, x, y, w, h, r);
	ctx.fill();
}

function truncate(ctx: Ctx2D, text: string, maxWidth: number): string {
	if (maxWidth <= 8) return "…";
	if (ctx.measureText(text).width <= maxWidth) return text;
	let t = text;
	while (t.length > 0 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
	return `${t}…`;
}

export function loadImage(url: string): Promise<HTMLImageElement | null> {
	const resolved = normalizeSpotifyImageUrl(url);
	if (!resolved) return Promise.resolve(null);
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		setTimeout(() => resolve(null), 5000);
		img.src = resolved;
	});
}

/** Gradient pairs for image-less tiles - seeded so an item always gets the same look. */
const TILE_GRADS: [string, string][] = [
	["#1d4ed8", "#22d3ee"],
	["#7c3aed", "#ec4899"],
	["#059669", "#a3e635"],
	["#dc2626", "#f97316"],
	["#0e7490", "#2dd4bf"],
	["#b45309", "#fbbf24"],
	["#4338ca", "#a78bfa"],
];

function tileSeedHash(seed: string): number {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
	return Math.abs(hash);
}

/** Image-less tile: seeded gradient monogram - reads as deliberate, never broken. */
function fallbackTile(ctx: Ctx2D, x: number, y: number, size: number, radius: number, seed: string) {
	const pair = TILE_GRADS[tileSeedHash(seed || "♫") % TILE_GRADS.length];
	const grad = ctx.createLinearGradient(x, y, x + size, y + size);
	grad.addColorStop(0, pair[0]);
	grad.addColorStop(1, pair[1]);
	ctx.fillStyle = grad;
	fillRoundRect(ctx, x, y, size, size, radius);
	const shade = ctx.createLinearGradient(x, y, x, y + size);
	shade.addColorStop(0, "rgba(0,0,0,0)");
	shade.addColorStop(1, "rgba(0,0,0,0.28)");
	ctx.fillStyle = shade;
	fillRoundRect(ctx, x, y, size, size, radius);
	const letter = (seed.match(/[\p{L}\p{N}]/u)?.[0] ?? "♪").toUpperCase();
	ctx.fillStyle = "rgba(255,255,255,0.92)";
	ctx.font = `800 ${Math.round(size * 0.44)}px ${CV_FONT}`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(letter, x + size / 2, y + size / 2 + Math.round(size * 0.03));
	ctx.textAlign = "left";
	ctx.textBaseline = "alphabetic";
}

async function drawTile(
	ctx: Ctx2D,
	url: string | undefined | null,
	x: number,
	y: number,
	size: number,
	radius: number,
	seed: string,
): Promise<void> {
	const img = url ? await loadImage(url) : null;
	if (!img) {
		fallbackTile(ctx, x, y, size, radius, seed);
		return;
	}
	ctx.save();
	roundRectPath(ctx, x, y, size, size, radius);
	ctx.clip();
	ctx.drawImage(img, x, y, size, size);
	ctx.restore();
}

const KICKER_PX = 34;
const KICKER_BLOCK = KICKER_PX + 28; // baseline + gap to content

function drawKicker(ctx: Ctx2D, text: string, x: number, y: number, palette: SharePalette, titleCase = false): number {
	const prev = ctx.letterSpacing;
	ctx.fillStyle = palette.dim;
	ctx.font = `700 ${KICKER_PX}px ${CV_FONT}`;
	ctx.letterSpacing = "0.1em";
	ctx.fillText(titleCase ? text : text.toUpperCase(), x, y + KICKER_PX);
	ctx.letterSpacing = prev;
	return y + KICKER_BLOCK;
}

function drawCapsLabel(ctx: Ctx2D, text: string, x: number, baselineY: number, px: number, color: string) {
	const prev = ctx.letterSpacing;
	ctx.fillStyle = color;
	ctx.font = `700 ${px}px ${CV_FONT}`;
	ctx.letterSpacing = "0.08em";
	ctx.fillText(text.toUpperCase(), x, baselineY);
	ctx.letterSpacing = prev;
}

function drawChunkBg(ctx: Ctx2D, x: number, y: number, w: number, h: number, palette: SharePalette) {
	ctx.fillStyle = palette.chunkBg;
	fillRoundRect(ctx, x, y, w, h, 20);
	ctx.strokeStyle = palette.chunkBorder;
	ctx.lineWidth = 2;
	roundRectPath(ctx, x, y, w, h, 20);
	ctx.stroke();
}

function formatPeakHour(hour: number): string {
	const h = ((Math.floor(hour) % 24) + 24) % 24;
	const v = h % 12 || 12;
	return `${v} ${h < 12 ? "AM" : "PM"}`;
}

function formatBestDay(dateStr: string): string {
	const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return dateStr;
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	const mi = Number(m[2]);
	if (mi < 1 || mi > 12) return dateStr;
	return `${months[mi - 1]} ${Number(m[3])}`;
}

// ── Card chrome ──────────────────────────────────────────────────────────────

function drawBackground(ctx: Ctx2D, w: number, h: number, palette: SharePalette) {
	const ang = 160 * (Math.PI / 180);
	const ux = Math.sin(ang);
	const uy = -Math.cos(ang);
	const half = Math.hypot(w, h) / 2;
	const bg = ctx.createLinearGradient(w / 2 - ux * half, h / 2 - uy * half, w / 2 + ux * half, h / 2 + uy * half);
	bg.addColorStop(0, palette.bgA);
	bg.addColorStop(0.5, palette.bgB);
	bg.addColorStop(1, palette.bgC);
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, w, h);

	const g1 = ctx.createRadialGradient(w, 0, 0, w, 0, w * 0.8);
	g1.addColorStop(0, rgb(palette.accent, 0.35));
	g1.addColorStop(1, rgb(palette.accent, 0));
	ctx.fillStyle = g1;
	ctx.fillRect(0, 0, w, h);

	const g2 = ctx.createRadialGradient(0, h, 0, 0, h, h * 0.7);
	g2.addColorStop(0, rgb(palette.accent, 0.15));
	g2.addColorStop(1, rgb(palette.accent, 0));
	ctx.fillStyle = g2;
	ctx.fillRect(0, 0, w, h);
}

function drawWatermarkBar(ctx: Ctx2D, w: number, captionText: string, palette: SharePalette) {
	const cx = PAD;
	const cy = 52;
	ctx.fillStyle = rgb(palette.accent);
	ctx.beginPath();
	ctx.arc(cx + 18, cy + 18, 18, 0, Math.PI * 2);
	ctx.fill();

	const prevLs = ctx.letterSpacing;
	ctx.fillStyle = palette.dim;
	ctx.font = `600 28px ${CV_FONT}`;
	ctx.letterSpacing = "0.04em";
	ctx.textBaseline = "middle";
	ctx.fillText("LISTENING STATS · SPICETIFY", cx + 48, cy + 18);
	ctx.letterSpacing = prevLs;

	if (captionText) {
		ctx.fillStyle = palette.dim;
		ctx.font = `500 26px ${CV_FONT}`;
		const titleEnd = cx + 48 + ctx.measureText("LISTENING STATS · SPICETIFY").width;
		const capMax = Math.max(60, w - PAD - titleEnd - 28);
		ctx.textAlign = "right";
		ctx.fillText(truncate(ctx, captionText, capMax), w - PAD, cy + 18);
		ctx.textAlign = "left";
	}
	ctx.textBaseline = "alphabetic";
}

function drawFooterBar(ctx: Ctx2D, h: number, captionText: string, palette: SharePalette) {
	ctx.fillStyle = palette.faint;
	ctx.font = `28px ${CV_FONT}`;
	ctx.fillText(captionText, PAD, h - 52);
}

// ── Variant framework ────────────────────────────────────────────────────────

interface CardEnv {
	stats: StatsResult;
	size: ShareSize;
	palette: SharePalette;
	periodLabel: string;
	periodDayCount: number;
	allowStreak: boolean;
	/** Set for the recap variant - days in the recap window. */
	recapDayCount?: number;
}

interface BuiltCard {
	height: number;
	draw: (ctx: Ctx2D, x: number, y: number, w: number) => Promise<void>;
}

type CardBuilder = (ctx: Ctx2D, env: CardEnv, w: number, availH: number) => BuiltCard;

// ── Shared list rows (top5 / wrapped) ────────────────────────────────────────

interface RowLayout {
	tile: number;
	gap: number;
	rank: number;
	titlePx: number;
	subPx: number;
	countPx: number;
	capsPx: number;
	radius: number;
}

function rowHeight(l: RowLayout): number {
	return l.tile + l.gap;
}

/**
 * One media row: [rank] [tile] [title / subtitle] [right value / caps label].
 * Text baselines sit at 38% / 78% of the tile so the pair is vertically
 * centered with even spacing regardless of tile size.
 */
async function drawMediaRow(
	ctx: Ctx2D,
	env: CardEnv,
	l: RowLayout,
	x: number,
	y: number,
	w: number,
	row: {
		rank: number;
		art?: string | null;
		seed: string;
		title: string;
		subtitle: string;
		rightValue?: string;
		rightCaps?: string;
	},
): Promise<void> {
	const { palette } = env;
	const gapArt = 24;
	// Right column reservation
	let rightW = 0;
	if (row.rightValue) {
		ctx.font = `700 ${l.countPx}px ${CV_FONT}`;
		rightW = Math.max(rightW, ctx.measureText(row.rightValue).width);
	}
	if (row.rightCaps) {
		ctx.font = `700 ${l.capsPx}px ${CV_FONT}`;
		rightW = Math.max(rightW, ctx.measureText(row.rightCaps).width * 1.08);
	}
	const rightReserve = rightW > 0 ? rightW + 28 : 0;

	ctx.fillStyle = rgb(palette.accent);
	ctx.font = `800 ${Math.round(l.tile * 0.52)}px ${CV_FONT}`;
	ctx.textAlign = "right";
	ctx.fillText(`${row.rank}`, x + l.rank, y + l.tile / 2 + Math.round(l.tile * 0.19));
	ctx.textAlign = "left";

	const artX = x + l.rank + gapArt;
	await drawTile(ctx, row.art ?? undefined, artX, y, l.tile, l.radius, row.seed);

	const textX = artX + l.tile + gapArt;
	const textMax = Math.max(64, x + w - rightReserve - 20 - textX);
	const titleBase = y + Math.round(l.tile * 0.42);
	const subBase = y + Math.round(l.tile * 0.82);

	ctx.fillStyle = palette.text;
	ctx.font = `600 ${l.titlePx}px ${CV_FONT}`;
	ctx.fillText(truncate(ctx, row.title, textMax), textX, titleBase);
	ctx.fillStyle = palette.dim;
	ctx.font = `${l.subPx}px ${CV_FONT}`;
	ctx.fillText(truncate(ctx, row.subtitle, textMax), textX, subBase);

	if (row.rightValue) {
		ctx.fillStyle = palette.text;
		ctx.font = `700 ${l.countPx}px ${CV_FONT}`;
		ctx.textAlign = "right";
		ctx.fillText(row.rightValue, x + w, titleBase);
		ctx.textAlign = "left";
	}
	if (row.rightCaps) {
		ctx.textAlign = "right";
		const prev = ctx.letterSpacing;
		ctx.fillStyle = palette.dim;
		ctx.font = `700 ${l.capsPx}px ${CV_FONT}`;
		ctx.letterSpacing = "0.08em";
		ctx.fillText(row.rightCaps.toUpperCase(), x + w, subBase);
		ctx.letterSpacing = prev;
		ctx.textAlign = "left";
	}
}

// ── Variant: Top 5 ───────────────────────────────────────────────────────────

const buildTop5: CardBuilder = (_ctx, env, _w, availH) => {
	const { stats, size, palette } = env;
	const isStory = size === "story";
	const tracks = stats.topTracks.slice(0, 5);
	const layout: RowLayout = isStory
		? { tile: 124, gap: 34, rank: 56, titlePx: 42, subPx: 30, countPx: 34, capsPx: 20, radius: 12 }
		: { tile: 96, gap: 26, rank: 48, titlePx: 36, subPx: 26, countPx: 30, capsPx: 18, radius: 10 };

	const listH = tracks.length * rowHeight(layout) - layout.gap;
	const chunkH = 200;
	const chunkGap = 56;
	const withInsight = isStory && stats.totalPlays > 0;
	let height = KICKER_BLOCK + 16 + listH;
	if (withInsight) height += chunkGap + chunkH;
	// Shrink to fit: drop insight first, list rows never overflow in practice
	const showInsight = withInsight && height <= availH;
	if (!showInsight && withInsight) height -= chunkGap + chunkH;

	return {
		height,
		draw: async (c, x, y, width) => {
			y = drawKicker(c, "My top 5", x, y, palette) + 16;
			for (let i = 0; i < tracks.length; i++) {
				const t = tracks[i];
				await drawMediaRow(c, env, layout, x, y, width, {
					rank: i + 1,
					art: t.albumArt,
					seed: t.trackName,
					title: t.trackName,
					subtitle: t.artistName,
					rightValue: t.count > 0 ? `${t.count}` : undefined,
					rightCaps: t.count > 0 ? "plays" : undefined,
				});
				y += rowHeight(layout);
			}
			y -= layout.gap;
			if (!showInsight) return;
			y += chunkGap;
			const totalFive = tracks.reduce((s, t) => s + t.count, 0);
			const sharePct = Math.round((totalFive / stats.totalPlays) * 100);
			drawChunkBg(c, x, y, width, chunkH, palette);
			const inX = x + 32;
			drawCapsLabel(c, "Top 5 share", inX, y + 52, 24, palette.dim);
			c.fillStyle = palette.text;
			c.font = `800 52px ${CV_FONT}`;
			c.fillText(`${sharePct}% of all plays`, inX, y + 124);
			c.fillStyle = palette.muted;
			c.font = `28px ${CV_FONT}`;
			c.textAlign = "right";
			c.fillText(`${formatNumber(totalFive)} of ${formatNumber(stats.totalPlays)} plays`, x + width - 32, y + 124);
			c.textAlign = "left";
		},
	};
};

// ── Variant: Total time ──────────────────────────────────────────────────────

const buildTime: CardBuilder = (_ctx, env, _w, availH) => {
	const { stats, size, palette, periodLabel, periodDayCount } = env;
	const isStory = size === "story";
	const totalHours = Math.floor(stats.totalDuration / 3_600_000);
	const heroPx = isStory ? 330 : 250;
	const unitPx = isStory ? 84 : 64;
	const bodyPx = isStory ? 40 : 36;
	const topArtist = stats.topArtists[0]?.artistName ?? "";

	const chunkH = 210;
	const chunkGap = 56;
	const podRow = 88;
	const podRows = Math.min(3, stats.topArtists.length);
	const podH = podRows > 0 ? 96 + podRows * podRow : 0;

	const heroGlyphH = Math.floor(heroPx * 0.78);
	let height = KICKER_BLOCK + 20 + heroGlyphH + 28 + lh(unitPx);
	if (topArtist) height += 24 + lh(bodyPx);
	let showChunks = false;
	let showPodium = false;
	if (isStory) {
		if (height + chunkGap + chunkH <= availH) {
			showChunks = true;
			height += chunkGap + chunkH;
		}
		if (podH > 0 && height + 40 + podH <= availH) {
			showPodium = true;
			height += 40 + podH;
		}
	}

	return {
		height,
		draw: async (c, x, y, width) => {
			const head = periodLabel.trim() ? `${periodLabel} · I listened` : "Listening time";
			y = drawKicker(c, head, x, y, palette, true) + 20;

			c.font = `900 ${heroPx}px ${CV_FONT}`;
			c.fillStyle = rgb(palette.accent);
			c.fillText(`${totalHours}`, x, y + heroGlyphH);
			y += heroGlyphH + 28;
			c.fillStyle = palette.text;
			c.font = `700 ${unitPx}px ${CV_FONT}`;
			c.fillText("hours", x, y + unitPx);
			y += lh(unitPx);

			if (topArtist) {
				y += 24;
				c.fillStyle = palette.muted;
				c.font = `${bodyPx}px ${CV_FONT}`;
				const prefix = "Mostly to ";
				c.fillText(prefix, x, y + bodyPx);
				const prefixW = c.measureText(prefix).width;
				c.fillStyle = rgb(palette.accent);
				c.font = `700 ${bodyPx}px ${CV_FONT}`;
				c.fillText(truncate(c, `${topArtist}.`, width - prefixW), x + prefixW, y + bodyPx);
				y += lh(bodyPx);
			}

			if (showChunks) {
				y += chunkGap;
				const midGap = 24;
				const colW = (width - midGap) / 2;
				const daysEquiv = Math.round(totalHours / 24);
				const minsPerDay = Math.round((totalHours * 60) / Math.max(1, periodDayCount));
				drawChunkBg(c, x, y, colW, chunkH, palette);
				drawChunkBg(c, x + colW + midGap, y, colW, chunkH, palette);
				drawCapsLabel(c, "Equivalent to", x + 32, y + 52, 24, palette.dim);
				c.fillStyle = palette.text;
				c.font = `800 56px ${CV_FONT}`;
				c.fillText(`${daysEquiv} days`, x + 32, y + 124);
				c.fillStyle = palette.muted;
				c.font = `26px ${CV_FONT}`;
				c.fillText("of nonstop play", x + 32, y + 168);
				const rx = x + colW + midGap + 32;
				drawCapsLabel(c, "Daily average", rx, y + 52, 24, palette.dim);
				c.fillStyle = palette.text;
				c.font = `800 56px ${CV_FONT}`;
				c.fillText(`${minsPerDay} min`, rx, y + 124);
				c.fillStyle = palette.muted;
				c.font = `26px ${CV_FONT}`;
				if (stats.totalPlays > 0)
					c.fillText(truncate(c, `across ${formatNumber(stats.totalPlays)} plays`, colW - 64), rx, y + 168);
				y += chunkH;
			}

			if (showPodium) {
				y += 40;
				drawChunkBg(c, x, y, width, podH, palette);
				drawCapsLabel(c, "Top artists", x + 32, y + 52, 26, palette.dim);
				let ry = y + 80;
				for (let i = 0; i < podRows; i++) {
					const a = env.stats.topArtists[i];
					const avatar = 64;
					c.fillStyle = rgb(palette.accent);
					c.font = `800 38px ${CV_FONT}`;
					c.textAlign = "right";
					c.fillText(`${i + 1}`, x + 32 + 30, ry + avatar / 2 + 13);
					c.textAlign = "left";
					await drawTile(c, a.imageUrl ?? undefined, x + 32 + 52, ry, avatar, avatar / 2, a.artistName);
					const nameX = x + 32 + 52 + avatar + 22;
					const playsLbl = a.count > 0 ? `${formatNumber(a.count)} ${a.count === 1 ? "play" : "plays"}` : "";
					c.font = `28px ${CV_FONT}`;
					const playsW = c.measureText(playsLbl).width + 24;
					c.fillStyle = palette.text;
					c.font = `600 36px ${CV_FONT}`;
					c.fillText(truncate(c, a.artistName, x + width - 32 - playsW - nameX), nameX, ry + avatar / 2 + 12);
					c.fillStyle = palette.dim;
					c.font = `28px ${CV_FONT}`;
					c.textAlign = "right";
					c.fillText(playsLbl, x + width - 32, ry + avatar / 2 + 11);
					c.textAlign = "left";
					ry += podRow;
				}
			}
		},
	};
};

// ── Variant: Genre ───────────────────────────────────────────────────────────

const buildGenre: CardBuilder = (_ctx, env, _w, availH) => {
	const { stats, size, palette } = env;
	const isStory = size === "story";
	const limit = isStory ? 6 : 5;
	const top = stats.topGenres.slice(0, limit);
	const totalCount = top.reduce((s, g) => s + g.count, 0);
	const maxCount = top[0]?.count || 1;
	const topPct = totalCount > 0 ? Math.round((maxCount / totalCount) * 100) : 0;

	const barH = isStory ? 36 : 32;
	const rowGap = isStory ? 40 : 32;
	const barsH = top.length * (barH + rowGap) - rowGap;

	const leaders = top.slice(0, 3).filter((_, i) => stats.topTracks[i]);
	const leaderRow = 96;
	const leadersH = leaders.length > 0 ? 88 + leaders.length * leaderRow : 0;

	let height = KICKER_BLOCK + 24 + barsH;
	let showLeaders = false;
	if (isStory && leadersH > 0 && height + 56 + leadersH <= availH) {
		showLeaders = true;
		height += 56 + leadersH;
	}

	return {
		height,
		draw: async (c, x, y, width) => {
			if (top.length === 0 || totalCount === 0) return;
			y = drawKicker(c, `I was ${topPct}% ${top[0].genre}`, x, y, palette) + 24;

			const labelPx = isStory ? 40 : 36;
			const pctPx = isStory ? 34 : 32;
			c.font = `600 ${labelPx}px ${CV_FONT}`;
			let labelW = 0;
			for (const g of top) labelW = Math.max(labelW, c.measureText(g.genre).width);
			labelW = Math.min(labelW + 8, Math.floor(width * 0.36));
			const pctReserve = 110;

			for (let i = 0; i < top.length; i++) {
				const g = top[i];
				const ry = y + i * (barH + rowGap);
				const pct = g.count / totalCount;
				const mid = ry + barH / 2;
				c.fillStyle = palette.text;
				c.font = `600 ${labelPx}px ${CV_FONT}`;
				c.textBaseline = "middle";
				c.fillText(truncate(c, g.genre, labelW), x, mid);
				const barX = x + labelW + 24;
				const barW = Math.max(64, width - pctReserve - (barX - x) - 20);
				c.fillStyle = palette.barTrack;
				fillRoundRect(c, barX, ry, barW, barH, barH / 2);
				c.fillStyle = rgb(palette.accent, 1 - i * 0.13);
				fillRoundRect(c, barX, ry, Math.max(barH, barW * (g.count / maxCount)), barH, barH / 2);
				c.fillStyle = palette.muted;
				c.font = `600 ${pctPx}px ${CV_FONT}`;
				c.textAlign = "right";
				c.fillText(`${Math.round(pct * 100)}%`, x + width, mid);
				c.textAlign = "left";
				c.textBaseline = "alphabetic";
			}
			y += barsH;

			if (!showLeaders) return;
			y += 56;
			drawChunkBg(c, x, y, width, leadersH, palette);
			drawCapsLabel(c, "Genre leaders", x + 32, y + 52, 26, palette.dim);
			let ly = y + 80;
			const art = 64;
			for (let i = 0; i < leaders.length; i++) {
				const g = leaders[i];
				const t = stats.topTracks[i];
				await drawTile(c, t.albumArt, x + 32, ly, art, 8, t.trackName);
				const textX = x + 32 + art + 24;
				c.font = `700 24px ${CV_FONT}`;
				const genreW = c.measureText(g.genre.toUpperCase()).width + 28;
				const textMax = Math.max(100, x + width - 32 - genreW - textX);
				c.fillStyle = palette.text;
				c.font = `600 32px ${CV_FONT}`;
				c.fillText(truncate(c, t.trackName, textMax), textX, ly + 28);
				c.fillStyle = palette.dim;
				c.font = `24px ${CV_FONT}`;
				c.fillText(truncate(c, t.artistName, textMax), textX, ly + 60);
				c.fillStyle = rgb(palette.accent);
				c.textAlign = "right";
				drawCapsLabel(c, g.genre, 0, 0, 0, "transparent"); // no-op to keep helper referenced pattern consistent
				const prev = c.letterSpacing;
				c.font = `700 24px ${CV_FONT}`;
				c.letterSpacing = "0.08em";
				c.fillText(g.genre.toUpperCase(), x + width - 32, ly + 44);
				c.letterSpacing = prev;
				c.textAlign = "left";
				ly += leaderRow;
			}
		},
	};
};

// ── Variant: Streak ──────────────────────────────────────────────────────────

const buildStreak: CardBuilder = (_ctx, env, w, availH) => {
	const { stats, size, palette } = env;
	const isStory = size === "story";
	const streak = stats.streak ?? 0;
	const cols = isStory ? 12 : 10;
	const rows = 7;
	const gap = 12;
	const bodyPx = isStory ? 38 : 32;

	const chunkH = 200;
	const chunkGap = 48;
	const data = (stats.dailyPlayCounts ?? []).slice(-(cols * rows));

	// Grid must fit BOTH width and its height share of the card
	const textBelow = 40 + lh(bodyPx); // gap + sentence
	const fixedAbove = KICKER_BLOCK + 24;
	const wantChunks = isStory && data.length > 0;
	const reservedBelow = textBelow + (wantChunks ? chunkGap + chunkH * 2 + 28 : 0);
	const gridMaxH = Math.max(160, availH - fixedAbove - reservedBelow);
	const cellFromW = Math.floor((w - gap * (cols - 1)) / cols);
	const cellFromH = Math.floor((gridMaxH - gap * (rows - 1)) / rows);
	const cell = Math.max(16, Math.min(cellFromW, cellFromH));
	const gridW = cols * (cell + gap) - gap;
	const gridH = rows * (cell + gap) - gap;

	let height = fixedAbove + gridH + textBelow;
	let showChunks = false;
	if (wantChunks && height + chunkGap + chunkH <= availH) {
		showChunks = true;
		height += chunkGap + chunkH;
	}
	let showBestDay = false;
	if (showChunks && height + 28 + 176 <= availH) {
		showBestDay = true;
		height += 28 + 176;
	}

	return {
		height,
		draw: async (c, x, y, width) => {
			if (streak === 0) return;
			y = drawKicker(c, `${streak}-day streak`, x, y, palette) + 24;

			const gridX = x + Math.floor((width - gridW) / 2);
			const max = Math.max(1, ...data.map((d) => d.count));
			for (let wi = 0; wi < cols; wi++) {
				for (let di = 0; di < rows; di++) {
					const idx = wi * rows + di;
					const count = data[idx]?.count ?? 0;
					const t = Math.min(1, count / max);
					c.fillStyle = rgb(palette.accent, 0.08 + t * 0.92);
					fillRoundRect(c, gridX + wi * (cell + gap), y + di * (cell + gap), cell, cell, Math.min(6, cell / 4));
				}
			}
			y += gridH + 40;

			c.fillStyle = palette.muted;
			c.font = `${bodyPx}px ${CV_FONT}`;
			const prefix = "Listened every day for ";
			c.fillText(prefix, x, y + bodyPx);
			const pw = c.measureText(prefix).width;
			c.fillStyle = palette.text;
			c.font = `700 ${bodyPx}px ${CV_FONT}`;
			c.fillText(truncate(c, `${streak} days.`, width - pw), x + pw, y + bodyPx);
			y += lh(bodyPx);

			if (!showChunks) return;
			y += chunkGap;
			const totalMins = data.reduce((s, d) => s + d.count * 3, 0);
			const avgMins = data.length ? Math.round(totalMins / data.length) : 0;
			const midGap = 24;
			const colW = (width - midGap) / 2;
			drawChunkBg(c, x, y, colW, chunkH, palette);
			drawChunkBg(c, x + colW + midGap, y, colW, chunkH, palette);
			drawCapsLabel(c, "Daily average", x + 32, y + 52, 24, palette.dim);
			c.fillStyle = palette.text;
			c.font = `800 56px ${CV_FONT}`;
			c.fillText(`${avgMins} min`, x + 32, y + 122);
			c.fillStyle = palette.muted;
			c.font = `26px ${CV_FONT}`;
			c.fillText(truncate(c, `over the last ${data.length} days`, colW - 64), x + 32, y + 164);
			const rx = x + colW + midGap + 32;
			drawCapsLabel(c, "Longest streak", rx, y + 52, 24, palette.dim);
			c.fillStyle = rgb(palette.accent);
			c.font = `800 56px ${CV_FONT}`;
			c.fillText(`${streak} days`, rx, y + 122);
			c.fillStyle = palette.muted;
			c.font = `26px ${CV_FONT}`;
			c.fillText("your best run this year", rx, y + 164);
			y += chunkH;

			if (!showBestDay) return;
			y += 28;
			const firstDay = data[0];
			if (!firstDay) return;
			const bestDay = data.reduce((best, cur) => (cur.count > best.count ? cur : best), firstDay);
			drawChunkBg(c, x, y, width, 176, palette);
			drawCapsLabel(c, "Best day", x + 32, y + 52, 24, palette.dim);
			const playsLbl = `${bestDay.count} ${bestDay.count === 1 ? "play" : "plays"}`;
			c.font = `800 36px ${CV_FONT}`;
			const playsW = c.measureText(playsLbl).width + 24;
			c.fillStyle = palette.text;
			c.font = `700 36px ${CV_FONT}`;
			c.fillText(truncate(c, formatBestDay(bestDay.date), width - 64 - playsW), x + 32, y + 118);
			c.fillStyle = rgb(palette.accent);
			c.font = `800 36px ${CV_FONT}`;
			c.textAlign = "right";
			c.fillText(playsLbl, x + width - 32, y + 118);
			c.textAlign = "left";
		},
	};
};

// ── Variant: Throwback ───────────────────────────────────────────────────────

const buildThrowback: CardBuilder = (_ctx, env, w, availH) => {
	const { stats, size, palette } = env;
	const isStory = size === "story";
	const track = stats.topTracks[0];
	const titlePx = isStory ? 84 : 60;
	const metaPx = isStory ? 40 : 32;
	const chunkH = 200;
	const chunkGap = 64;

	const textH = 64 + lh(titlePx) + 12 + lh(metaPx);
	const wantChunk = isStory && stats.totalPlays > 0;
	const reserved = KICKER_BLOCK + 28 + textH + (wantChunk ? chunkGap + chunkH : 0);
	const artMax = isStory ? 880 : 480;
	const art = Math.min(artMax, w, Math.max(280, availH - reserved));

	let height = KICKER_BLOCK + 28 + art + textH;
	let showChunk = false;
	if (wantChunk && height + chunkGap + chunkH <= availH) {
		showChunk = true;
		height += chunkGap + chunkH;
	}

	return {
		height,
		draw: async (c, x, y, width) => {
			if (!track) return;
			y = drawKicker(c, "Most-played", x, y, palette) + 28;
			const artX = x + Math.floor((width - art) / 2);
			await drawTile(c, track.albumArt, artX, y, art, 20, track.trackName);
			y += art + 64;

			c.fillStyle = palette.text;
			c.font = `800 ${titlePx}px ${CV_FONT}`;
			c.fillText(truncate(c, track.trackName, width), x, y + titlePx);
			y += lh(titlePx) + 12;
			c.fillStyle = palette.muted;
			c.font = `${metaPx}px ${CV_FONT}`;
			const playPhrase = track.count > 0 ? (track.count === 1 ? "1 play" : `${track.count} plays`) : "";
			c.fillText(
				truncate(c, playPhrase ? `${track.artistName} · ${playPhrase}` : track.artistName, width),
				x,
				y + metaPx,
			);
			y += lh(metaPx);

			if (!showChunk) return;
			y += chunkGap;
			drawChunkBg(c, x, y, width, chunkH, palette);
			const colW = width / 3;
			const ty = y + 56;
			const sharePct = Math.round((track.count / stats.totalPlays) * 100);
			c.textAlign = "center";
			const prev = c.letterSpacing;
			c.fillStyle = palette.dim;
			c.font = `700 22px ${CV_FONT}`;
			c.letterSpacing = "0.08em";
			c.fillText("PLAYS", x + colW * 0.5, ty);
			c.fillText("SHARE", x + colW * 1.5, ty);
			c.fillText("RANK", x + colW * 2.5, ty);
			c.letterSpacing = prev;
			c.fillStyle = rgb(palette.accent);
			c.font = `800 52px ${CV_FONT}`;
			c.fillText(`${track.count}`, x + colW * 0.5, ty + 84);
			c.fillStyle = palette.text;
			c.fillText(`${sharePct}%`, x + colW * 1.5, ty + 84);
			c.fillText("#1", x + colW * 2.5, ty + 84);
			c.textAlign = "left";
			c.strokeStyle = palette.chunkBorder;
			c.lineWidth = 2;
			c.beginPath();
			c.moveTo(x + colW, y + 28);
			c.lineTo(x + colW, y + chunkH - 28);
			c.moveTo(x + 2 * colW, y + 28);
			c.lineTo(x + 2 * colW, y + chunkH - 28);
			c.stroke();
		},
	};
};

// ── Variant: Wrapped / Recap ─────────────────────────────────────────────────

interface WrappedSection {
	kind: "tracks" | "artists" | "genres";
	rows: number;
}

const buildWrapped: CardBuilder = (_ctx, env, _w, availH) => {
	const { stats, size, palette, periodLabel, allowStreak, recapDayCount } = env;
	const isStory = size === "story";
	const isRecap = recapDayCount != null;

	const heroPx = isStory ? 190 : 108;
	const unitPx = isStory ? 52 : 36;
	const metaPx = isStory ? 28 : 22;
	const sectionKickerPx = isStory ? 24 : 20;
	const sectionKickerBlock = sectionKickerPx + 20;
	const sectionGap = isStory ? 36 : 24;

	const listLayout: RowLayout = isStory
		? { tile: 84, gap: 18, rank: 40, titlePx: 32, subPx: 24, countPx: 26, capsPx: 16, radius: 9 }
		: { tile: 56, gap: 13, rank: 30, titlePx: 23, subPx: 17, countPx: 20, capsPx: 13, radius: 7 };
	const genreBarH = isStory ? 24 : 18;
	const genreGap = isStory ? 20 : 14;

	const heroGlyphH = Math.floor(heroPx * 0.78);
	// Square puts "hours" inline with the number to save a full text row
	const heroH = isStory ? heroGlyphH + 24 + lh(unitPx) + 12 + lh(metaPx) : heroGlyphH + 16 + lh(metaPx);
	const fixed = KICKER_BLOCK + 8 + heroH;

	// Fill sections greedily into the remaining height
	const budgetAfter = (used: number) => availH - fixed - used;
	const sections: WrappedSection[] = [];
	let used = 0;
	const sectionH = (kind: WrappedSection["kind"], rows: number) =>
		kind === "genres"
			? sectionKickerBlock + rows * (genreBarH + genreGap) - genreGap
			: sectionKickerBlock + rows * rowHeight(listLayout) - listLayout.gap;

	// Every section (including the first, after the hero block) is preceded by sectionGap
	const tryAdd = (kind: WrappedSection["kind"], want: number, available: number) => {
		if (available === 0) return;
		let rows = Math.min(want, available);
		while (rows > 0) {
			const h = sectionGap + sectionH(kind, rows);
			if (h <= budgetAfter(used)) {
				sections.push({ kind, rows });
				used += h;
				return;
			}
			rows--;
		}
	};

	tryAdd("tracks", isStory ? 4 : 3, stats.topTracks.length);
	// Square: two artist rows so the genre section still fits below
	tryAdd("artists", isStory ? 4 : 2, stats.topArtists.length);
	tryAdd("genres", isStory ? 3 : 2, stats.topGenres.filter((g) => g.count > 0).length);

	const height = fixed + used;
	const totalHours = Math.floor(stats.totalDuration / 3_600_000);
	const hasHourData = (stats.hourlyDistribution ?? []).some((v) => v > 0);
	const streak = isRecap || allowStreak ? (stats.streak ?? 0) : 0;

	return {
		height,
		draw: async (c, x, y, width) => {
			const head = isRecap
				? periodLabel.trim()
					? `${periodLabel} · Recap`
					: "Monthly Recap"
				: periodLabel.trim()
					? `${periodLabel} · Wrapped`
					: "Wrapped";
			y = drawKicker(c, head, x, y, palette, true) + 8;

			c.font = `900 ${heroPx}px ${CV_FONT}`;
			c.fillStyle = rgb(palette.accent);
			const heroBaseline = y + heroGlyphH;
			c.fillText(`${totalHours}`, x, heroBaseline);
			if (isStory) {
				y += heroGlyphH + 24;
				c.fillStyle = palette.text;
				c.font = `700 ${unitPx}px ${CV_FONT}`;
				c.fillText("hours", x, y + unitPx);
				y += lh(unitPx) + 12;
			} else {
				const numW = c.measureText(`${totalHours}`).width;
				c.fillStyle = palette.text;
				c.font = `700 ${unitPx}px ${CV_FONT}`;
				c.fillText("hours", x + numW + 20, heroBaseline);
				y += heroGlyphH + 16;
			}

			let meta =
				stats.totalPlays > 0 ? `${formatNumber(stats.totalPlays)} plays · ${stats.uniqueArtistCount} artists` : "";
			if (hasHourData && meta) meta += ` · peak ${formatPeakHour(stats.peakHour)}`;
			if (streak > 0 && stats.totalPlays > 0) {
				if (isRecap) {
					meta +=
						streak >= (recapDayCount ?? Number.POSITIVE_INFINITY)
							? " · listened every day"
							: ` · best run ${streak} days`;
				} else {
					meta += ` · ${streak}-day streak`;
				}
			}
			c.fillStyle = palette.muted;
			c.font = `${metaPx}px ${CV_FONT}`;
			c.fillText(truncate(c, meta, width), x, y + metaPx);
			y += lh(metaPx);

			for (let si = 0; si < sections.length; si++) {
				const sec = sections[si];
				y += sectionGap;

				const prevLs = c.letterSpacing;
				c.fillStyle = palette.dim;
				c.font = `700 ${sectionKickerPx}px ${CV_FONT}`;
				c.letterSpacing = "0.1em";
				const label = sec.kind === "tracks" ? "TOP TRACKS" : sec.kind === "artists" ? "TOP ARTISTS" : "TOP GENRES";
				c.fillText(label, x, y + sectionKickerPx);
				c.letterSpacing = prevLs;
				y += sectionKickerBlock;

				if (sec.kind === "genres") {
					const allGenres = stats.topGenres.filter((g) => g.count > 0);
					const top = allGenres.slice(0, sec.rows);
					const totalCount = allGenres.reduce((s, g) => s + g.count, 0);
					const maxCount = top[0]?.count || 1;
					c.font = `600 ${genreBarH + 2}px ${CV_FONT}`;
					let labelW = 0;
					for (const g of top) labelW = Math.max(labelW, c.measureText(g.genre).width);
					labelW = Math.min(labelW + 6, Math.floor(width * 0.32));
					for (let i = 0; i < top.length; i++) {
						const g = top[i];
						const ry = y + i * (genreBarH + genreGap);
						const mid = ry + genreBarH / 2;
						c.textBaseline = "middle";
						c.fillStyle = palette.text;
						c.font = `600 ${genreBarH + 2}px ${CV_FONT}`;
						c.fillText(truncate(c, g.genre, labelW), x, mid);
						const barX = x + labelW + 20;
						const pctReserve = 76;
						const barW = Math.max(48, width - pctReserve - (barX - x) - 16);
						c.fillStyle = palette.barTrack;
						fillRoundRect(c, barX, ry, barW, genreBarH, genreBarH / 2);
						c.fillStyle = rgb(palette.accent, 1 - i * 0.15);
						fillRoundRect(c, barX, ry, Math.max(genreBarH, barW * (g.count / maxCount)), genreBarH, genreBarH / 2);
						c.fillStyle = palette.dim;
						c.font = `600 ${genreBarH}px ${CV_FONT}`;
						c.textAlign = "right";
						c.fillText(`${Math.round((g.count / totalCount) * 100)}%`, x + width, mid);
						c.textAlign = "left";
						c.textBaseline = "alphabetic";
					}
					y += sec.rows * (genreBarH + genreGap) - genreGap;
				} else {
					const rows: Array<{ art?: string | null; seed: string; title: string; sub: string; count: number }> =
						sec.kind === "tracks"
							? stats.topTracks.slice(0, sec.rows).map((t: TopTrack) => ({
									art: t.albumArt,
									seed: t.trackName,
									title: t.trackName,
									sub: t.artistName,
									count: t.count,
								}))
							: stats.topArtists.slice(0, sec.rows).map((a: TopArtist) => ({
									art: a.imageUrl,
									seed: a.artistName,
									title: a.artistName,
									sub: a.count > 0 ? `${formatNumber(a.count)} ${a.count === 1 ? "play" : "plays"}` : "",
									count: sec.kind === "artists" ? 0 : a.count,
								}));
					for (let i = 0; i < rows.length; i++) {
						const r = rows[i];
						await drawMediaRow(c, env, listLayout, x, y, width, {
							rank: i + 1,
							art: r.art,
							seed: r.seed,
							title: r.title,
							subtitle: r.sub,
							rightValue: sec.kind === "tracks" && r.count > 0 ? `${r.count}` : undefined,
							rightCaps: sec.kind === "tracks" && r.count > 0 ? "plays" : undefined,
						});
						y += rowHeight(listLayout);
					}
					y -= listLayout.gap;
				}
			}
		},
	};
};

const BUILDERS: Record<ShareVariant, CardBuilder> = {
	top5: buildTop5,
	time: buildTime,
	genre: buildGenre,
	streak: buildStreak,
	throwback: buildThrowback,
	wrapped: buildWrapped,
	recap: buildWrapped,
};

// ── Renderer ─────────────────────────────────────────────────────────────────

export async function renderShareCardCanvas(
	stats: StatsResult,
	variant: ShareVariant,
	size: ShareSize,
	periodLabel: string,
	username: string,
	options?: ShareRenderOptions,
): Promise<HTMLCanvasElement> {
	const dim = TARGET_DIMENSIONS[size];
	const canvas = document.createElement("canvas");
	canvas.width = dim.width;
	canvas.height = dim.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas 2D context unavailable");

	await hydrateShareCardAssets(stats);
	const palette = getSharePalette(!!options?.followTheme);
	const providerId = options?.activeProviderId ?? "local";
	const allowStreak = options?.hasStreakData ?? providerId === "local";
	const safeVariant = !allowStreak && variant === "streak" ? "top5" : variant;

	const captionParts: string[] = [];
	if (options?.showUsername !== false && username) captionParts.push(`@${username}`);
	if (options?.showPeriodLabel !== false) captionParts.push(periodLabel);
	const captionText = captionParts.join(" · ");

	drawBackground(ctx, dim.width, dim.height, palette);
	drawWatermarkBar(ctx, dim.width, captionText, palette);

	const env: CardEnv = {
		stats,
		size,
		palette,
		periodLabel,
		periodDayCount: Math.max(1, options?.periodDayCount ?? stats.listeningDays ?? 28),
		allowStreak,
		recapDayCount:
			safeVariant === "recap" ? Math.max(1, options?.periodDayCount ?? stats.listeningDays ?? 28) : undefined,
	};

	const contentW = dim.width - PAD * 2;
	const availH = dim.height - CONTENT_TOP - CONTENT_BOTTOM;
	const built = BUILDERS[safeVariant](ctx, env, contentW, availH);
	const extra = Math.max(0, availH - built.height);
	const bias = safeVariant === "wrapped" || safeVariant === "recap" ? 0.08 : 0.3;
	const contentY = CONTENT_TOP + Math.floor(extra * bias);
	await built.draw(ctx, PAD, contentY, contentW);

	drawFooterBar(ctx, dim.height, captionText, palette);
	return canvas;
}

// ── Export helpers ───────────────────────────────────────────────────────────

export async function renderShareCardBlob(
	stats: StatsResult,
	variant: ShareVariant,
	size: ShareSize,
	periodLabel: string,
	username: string,
	options?: ShareRenderOptions,
): Promise<Blob> {
	const canvas = await renderShareCardCanvas(stats, variant, size, periodLabel, username, options);
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				reject(new Error("PNG blob creation failed"));
				return;
			}
			resolve(blob);
		}, "image/png");
	});
}

export async function exportShareCardPng(
	stats: StatsResult,
	variant: ShareVariant,
	size: ShareSize,
	periodLabel: string,
	username: string,
	options?: ShareRenderOptions,
): Promise<void> {
	const blob = await renderShareCardBlob(stats, variant, size, periodLabel, username, options);
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "listening-stats-share.png";
	a.click();
	URL.revokeObjectURL(url);
}

export async function copyShareCardToClipboard(
	stats: StatsResult,
	variant: ShareVariant,
	size: ShareSize,
	periodLabel: string,
	username: string,
	options?: ShareRenderOptions,
): Promise<void> {
	const blob = await renderShareCardBlob(stats, variant, size, periodLabel, username, options);
	if (!navigator.clipboard?.write) {
		throw new Error("Clipboard API not available");
	}
	await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export async function shareOrDownload(blob: Blob): Promise<"shared" | "copied" | "downloaded"> {
	if (navigator.share) {
		try {
			const file = new File([blob], "listening-stats.png", { type: "image/png" });
			await navigator.share({ files: [file] });
			return "shared";
		} catch {
			/* fall through */
		}
	}
	try {
		await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
		return "copied";
	} catch {
		/* fall through */
	}
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "listening-stats.png";
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
	return "downloaded";
}
