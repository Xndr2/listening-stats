import type { ListeningStats, ProviderType } from "../types/listeningstats";
import { formatDuration, formatDurationLong, getPeriodDisplayName } from "./stats";

interface ShareCardOptions {
  stats: ListeningStats;
  period: string;
  format: "story" | "landscape";
  providerType?: ProviderType | null;
}

function getProviderLabel(providerType?: ProviderType | null): string {
  if (providerType === "lastfm") return "via Last.fm";
  if (providerType === "local") return "via Local Tracking";
  return "";
}

const STORY_W = 1080;
const STORY_H = 1350;
const LAND_W = 1200;
const LAND_H = 630;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const GREEN = "#1db954";
const GREEN_LIGHT = "#1ed760";
const GOLD = "#ffd700";
const SILVER = "#c0c0c0";
const BRONZE = "#cd7f32";

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 5000);
    img.src = url;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "...").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "...";
}

function rankColor(i: number): string {
  return i === 0 ? GOLD : i === 1 ? SILVER : i === 2 ? BRONZE : "#888";
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Dark gradient base
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#0d0d0d");
  grad.addColorStop(1, "#111118");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle green glow in top-left corner
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.6);
  glow.addColorStop(0, "rgba(29, 185, 84, 0.08)");
  glow.addColorStop(1, "rgba(29, 185, 84, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Accent bar at top
  const accentGrad = ctx.createLinearGradient(0, 0, w, 0);
  accentGrad.addColorStop(0, GREEN);
  accentGrad.addColorStop(1, GREEN_LIGHT);
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, w, 4);
}

function drawSectionPanel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  fillRoundRect(ctx, x, y, w, h, r);
  // Subtle top border
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

function drawSectionTitle(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number, s: number,
) {
  // Green accent dot
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.arc(x + 5 * s, y - 5 * s, 4 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = `bold ${18 * s}px ${FONT}`;
  ctx.fillText(text, x + 16 * s, y);
}

function drawStatPill(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  value: string, label: string, s: number, valueColor = "#fff",
) {
  // Pill background
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  fillRoundRect(ctx, x, y, w, h, h / 2);

  // Value
  ctx.fillStyle = valueColor;
  ctx.font = `bold ${18 * s}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(value, x + w / 2, y + h * 0.42);

  // Label
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = `${10 * s}px ${FONT}`;
  ctx.fillText(label, x + w / 2, y + h * 0.72);
  ctx.textAlign = "left";
}

async function drawArt(
  ctx: CanvasRenderingContext2D,
  url: string | undefined, x: number, y: number, size: number, radius: number,
): Promise<boolean> {
  if (!url) return false;
  const img = await loadImage(url);
  if (!img) return false;
  ctx.save();
  roundRect(ctx, x, y, size, size, radius);
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
  return true;
}

function drawPlaceholderArt(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number, radius: number,
) {
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  fillRoundRect(ctx, x, y, size, size, radius);
}

// ==================== STORY CARD (1080 x 1350) ====================

async function generateStoryCard(stats: ListeningStats, period: string, providerType?: ProviderType | null): Promise<HTMLCanvasElement> {
  const w = STORY_W;
  const h = STORY_H;
  const s = 1;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  drawBackground(ctx, w, h);

  const pad = 48;
  const innerW = w - pad * 2;
  const rightEdge = w - pad;

  // ── Header ──
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${38}px ${FONT}`;
  ctx.fillText("My Listening Stats", pad, 60);

  ctx.fillStyle = GREEN;
  ctx.font = `600 ${17}px ${FONT}`;
  const storyPeriodText = getPeriodDisplayName(period);
  ctx.fillText(storyPeriodText, pad, 88);

  const providerLabel = getProviderLabel(providerType);
  if (providerLabel) {
    const periodTextW = ctx.measureText(storyPeriodText).width;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `${14}px ${FONT}`;
    ctx.fillText("  \u2022  " + providerLabel, pad + periodTextW, 88);
  }

  // ── Stat pills row ──
  const pillY = 110;
  const pillH = 54;
  const pillGap = 10;
  const pillW = (innerW - pillGap * 3) / 4;

  drawStatPill(ctx, pad, pillY, pillW, pillH, formatDurationLong(stats.totalTimeMs), "LISTENED", s);
  drawStatPill(ctx, pad + pillW + pillGap, pillY, pillW, pillH, `${stats.trackCount}`, "TRACKS", s);
  drawStatPill(ctx, pad + (pillW + pillGap) * 2, pillY, pillW, pillH, `${stats.uniqueArtistCount}`, "ARTISTS", s);
  if (stats.streakDays > 0) {
    drawStatPill(ctx, pad + (pillW + pillGap) * 3, pillY, pillW, pillH, `${stats.streakDays}d`, "STREAK", s, GREEN);
  } else {
    drawStatPill(ctx, pad + (pillW + pillGap) * 3, pillY, pillW, pillH, `${Math.floor(stats.skipRate * 100)}%`, "SKIP RATE", s);
  }

  // ── Top Genres ──
  let y = 192;
  if (stats.topGenres.length > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `500 ${13}px ${FONT}`;
    const genreStr = stats.topGenres.slice(0, 5).map(g => g.genre).join("   \u2022   ");
    ctx.fillText(truncateText(ctx, genreStr, innerW), pad, y);
    y += 28;
  }

  // ── Helper to draw a list section ──
  const N = 5;
  const artSize = 44;
  const trackRowH = 56;
  const panelPad = 14;

  // ── Top 5 Tracks ──
  const trackCount = Math.min(N, stats.topTracks.length);
  const trackPanelH = 36 + trackRowH * trackCount + panelPad;
  drawSectionPanel(ctx, pad - 16, y, innerW + 32, trackPanelH, 14);

  let sy = y + 10;
  drawSectionTitle(ctx, "Top Tracks", pad, sy + 18, s);
  sy += 32;

  for (let i = 0; i < trackCount; i++) {
    const t = stats.topTracks[i];
    const rowY = sy + i * trackRowH;
    const artY = rowY + (trackRowH - artSize) / 2;

    const drew = await drawArt(ctx, t.albumArt, pad, artY, artSize, 6);
    if (!drew) drawPlaceholderArt(ctx, pad, artY, artSize, 6);

    const textX = pad + artSize + 12;
    const centerY = rowY + trackRowH / 2;

    ctx.fillStyle = rankColor(i);
    ctx.font = `bold ${14}px ${FONT}`;
    const rankStr = `${i + 1}`;
    ctx.fillText(rankStr, textX, centerY - 7);

    const rankW = ctx.measureText(rankStr).width + 7;
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${14}px ${FONT}`;
    ctx.fillText(truncateText(ctx, t.trackName, rightEdge - textX - rankW - 80), textX + rankW, centerY - 7);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${12}px ${FONT}`;
    ctx.fillText(truncateText(ctx, t.artistName, rightEdge - textX - rankW - 80), textX + rankW, centerY + 10);

    if (t.playCount) {
      ctx.fillStyle = GREEN;
      ctx.font = `600 ${12}px ${FONT}`;
      ctx.textAlign = "right";
      ctx.fillText(`${t.playCount} plays`, rightEdge, centerY + 1);
      ctx.textAlign = "left";
    }
  }

  y += trackPanelH + 16;

  // ── Top 5 Artists ──
  const artistImgSize = 38;
  const artistRowH = 50;
  const artistCount = Math.min(N, stats.topArtists.length);
  const artistPanelH = 36 + artistRowH * artistCount + panelPad;
  drawSectionPanel(ctx, pad - 16, y, innerW + 32, artistPanelH, 14);

  sy = y + 10;
  drawSectionTitle(ctx, "Top Artists", pad, sy + 18, s);
  sy += 32;

  for (let i = 0; i < artistCount; i++) {
    const a = stats.topArtists[i];
    const rowY = sy + i * artistRowH;
    const imgY = rowY + (artistRowH - artistImgSize) / 2;

    const drew = await drawArt(ctx, a.artistImage, pad, imgY, artistImgSize, artistImgSize / 2);
    if (!drew) drawPlaceholderArt(ctx, pad, imgY, artistImgSize, artistImgSize / 2);

    const textX = pad + artistImgSize + 12;
    const centerY = rowY + artistRowH / 2;

    ctx.fillStyle = rankColor(i);
    ctx.font = `bold ${14}px ${FONT}`;
    const rankStr = `${i + 1}`;
    ctx.fillText(rankStr, textX, centerY + 2);

    const rankW = ctx.measureText(rankStr).width + 7;
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${15}px ${FONT}`;
    ctx.fillText(truncateText(ctx, a.artistName, rightEdge - textX - rankW - 80), textX + rankW, centerY + 2);

    if (a.playCount) {
      ctx.fillStyle = GREEN;
      ctx.font = `600 ${12}px ${FONT}`;
      ctx.textAlign = "right";
      ctx.fillText(`${a.playCount} plays`, rightEdge, centerY + 2);
      ctx.textAlign = "left";
    }
  }

  y += artistPanelH + 16;

  // ── Top 5 Albums ──
  if (stats.topAlbums.length > 0) {
    const albumRowH = 56;
    const albumCount = Math.min(N, stats.topAlbums.length);
    const albumPanelH = 36 + albumRowH * albumCount + panelPad;
    drawSectionPanel(ctx, pad - 16, y, innerW + 32, albumPanelH, 14);

    sy = y + 10;
    drawSectionTitle(ctx, "Top Albums", pad, sy + 18, s);
    sy += 32;

    for (let i = 0; i < albumCount; i++) {
      const a = stats.topAlbums[i];
      const rowY = sy + i * albumRowH;
      const artY = rowY + (albumRowH - artSize) / 2;

      const drew = await drawArt(ctx, a.albumArt, pad, artY, artSize, 6);
      if (!drew) drawPlaceholderArt(ctx, pad, artY, artSize, 6);

      const textX = pad + artSize + 12;
      const centerY = rowY + albumRowH / 2;

      ctx.fillStyle = rankColor(i);
      ctx.font = `bold ${14}px ${FONT}`;
      const rankStr = `${i + 1}`;
      ctx.fillText(rankStr, textX, centerY - 7);

      const rankW = ctx.measureText(rankStr).width + 7;
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${14}px ${FONT}`;
      ctx.fillText(truncateText(ctx, a.albumName, rightEdge - textX - rankW - 20), textX + rankW, centerY - 7);

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `${12}px ${FONT}`;
      ctx.fillText(truncateText(ctx, a.artistName, rightEdge - textX - rankW - 20), textX + rankW, centerY + 10);
    }
  }

  // ── Watermark ──
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.font = `${13}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("Listening Stats for Spicetify", w / 2, h - 28);
  ctx.textAlign = "left";

  return canvas;
}

// ==================== LANDSCAPE CARD (1200 x 630) ====================

async function generateLandscapeCard(stats: ListeningStats, period: string, providerType?: ProviderType | null): Promise<HTMLCanvasElement> {
  const w = LAND_W;
  const h = LAND_H;
  const s = 1;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  drawBackground(ctx, w, h);

  const pad = 36;
  const N = 5;

  // ── Header bar (full width) ──
  const headerH = 88;

  ctx.fillStyle = "#fff";
  ctx.font = `bold ${24}px ${FONT}`;
  ctx.fillText("My Listening Stats", pad, 36);

  // Period pill + provider
  ctx.fillStyle = "rgba(29,185,84,0.15)";
  const periodText = getPeriodDisplayName(period);
  ctx.font = `600 ${12}px ${FONT}`;
  const periodW = ctx.measureText(periodText).width + 14;
  fillRoundRect(ctx, pad, 46, periodW, 20, 10);
  ctx.fillStyle = GREEN;
  ctx.fillText(periodText, pad + 7, 59);

  const landProviderLabel = getProviderLabel(providerType);
  if (landProviderLabel) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `${11}px ${FONT}`;
    ctx.fillText(landProviderLabel, pad + periodW + 8, 59);
  }

  // Stat pills in header row (right-aligned)
  const spH = 38;
  const spGap = 8;
  const pillCount = stats.streakDays > 0 ? 4 : 3;
  const spW = 110;
  const pillsRight = w - pad;
  const pillsLeft = pillsRight - pillCount * spW - (pillCount - 1) * spGap;

  drawStatPill(ctx, pillsLeft, 24, spW, spH, formatDuration(stats.totalTimeMs), "LISTENED", s);
  drawStatPill(ctx, pillsLeft + spW + spGap, 24, spW, spH, `${stats.trackCount}`, "TRACKS", s);
  drawStatPill(ctx, pillsLeft + (spW + spGap) * 2, 24, spW, spH, `${stats.uniqueArtistCount}`, "ARTISTS", s);
  if (stats.streakDays > 0) {
    drawStatPill(ctx, pillsLeft + (spW + spGap) * 3, 24, spW, spH, `${stats.streakDays}d`, "STREAK", s, GREEN);
  }

  // Genres below header
  if (stats.topGenres.length > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${11}px ${FONT}`;
    const genreStr = stats.topGenres.slice(0, 4).map(g => g.genre).join("  \u2022  ");
    ctx.fillText(truncateText(ctx, genreStr, w - pad * 2), pad, 78);
  }

  // ── Three equal columns below header ──
  const colTop = headerH + 4;
  const colGap = 16;
  const totalColW = w - pad * 2 - colGap * 2;
  const colW = Math.floor(totalColW / 3);
  const col1X = pad;
  const col2X = pad + colW + colGap;
  const col3X = pad + (colW + colGap) * 2;
  const colBottom = h - 32;
  const colH = colBottom - colTop;

  // Column panels
  drawSectionPanel(ctx, col1X - 8, colTop, colW + 16, colH, 12);
  drawSectionPanel(ctx, col2X - 8, colTop, colW + 16, colH, 12);
  drawSectionPanel(ctx, col3X - 8, colTop, colW + 16, colH, 12);

  const rowH = Math.floor((colH - 40) / N);
  const artSz = Math.min(34, rowH - 8);

  // ── Column 1: Top Tracks ──
  let cy = colTop + 8;
  drawSectionTitle(ctx, "Top Tracks", col1X, cy + 16, s);
  cy += 30;

  for (let i = 0; i < Math.min(N, stats.topTracks.length); i++) {
    const t = stats.topTracks[i];
    const rowY = cy + i * rowH;
    const artY = rowY + (rowH - artSz) / 2;

    const drew = await drawArt(ctx, t.albumArt, col1X, artY, artSz, 4);
    if (!drew) drawPlaceholderArt(ctx, col1X, artY, artSz, 4);

    const textX = col1X + artSz + 8;
    const centerY = rowY + rowH / 2;
    const maxTextW = col1X + colW - textX - 4;

    ctx.fillStyle = rankColor(i);
    ctx.font = `bold ${12}px ${FONT}`;
    const rk = `${i + 1}`;
    ctx.fillText(rk, textX, centerY - 5);

    const rkW = ctx.measureText(rk).width + 5;
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${12}px ${FONT}`;
    ctx.fillText(truncateText(ctx, t.trackName, maxTextW - rkW), textX + rkW, centerY - 5);

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `${10}px ${FONT}`;
    const meta = t.playCount ? `${t.artistName} \u2022 ${t.playCount} plays` : t.artistName;
    ctx.fillText(truncateText(ctx, meta, maxTextW - rkW), textX + rkW, centerY + 9);
  }

  // ── Column 2: Top Artists ──
  cy = colTop + 8;
  drawSectionTitle(ctx, "Top Artists", col2X, cy + 16, s);
  cy += 30;

  for (let i = 0; i < Math.min(N, stats.topArtists.length); i++) {
    const a = stats.topArtists[i];
    const rowY = cy + i * rowH;
    const imgY = rowY + (rowH - artSz) / 2;

    const drew = await drawArt(ctx, a.artistImage, col2X, imgY, artSz, artSz / 2);
    if (!drew) drawPlaceholderArt(ctx, col2X, imgY, artSz, artSz / 2);

    const textX = col2X + artSz + 8;
    const centerY = rowY + rowH / 2;
    const maxTextW = col2X + colW - textX - 4;

    ctx.fillStyle = rankColor(i);
    ctx.font = `bold ${12}px ${FONT}`;
    const rk = `${i + 1}`;
    ctx.fillText(rk, textX, centerY + 1);

    const rkW = ctx.measureText(rk).width + 5;
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${13}px ${FONT}`;
    ctx.fillText(truncateText(ctx, a.artistName, maxTextW - rkW), textX + rkW, centerY + 1);

    if (a.playCount) {
      ctx.fillStyle = GREEN;
      ctx.font = `${10}px ${FONT}`;
      ctx.fillText(truncateText(ctx, `${a.playCount} plays`, maxTextW - rkW), textX + rkW, centerY + 15);
    }
  }

  // ── Column 3: Top Albums ──
  cy = colTop + 8;
  drawSectionTitle(ctx, "Top Albums", col3X, cy + 16, s);
  cy += 30;

  for (let i = 0; i < Math.min(N, stats.topAlbums.length); i++) {
    const a = stats.topAlbums[i];
    const rowY = cy + i * rowH;
    const artY = rowY + (rowH - artSz) / 2;

    const drew = await drawArt(ctx, a.albumArt, col3X, artY, artSz, 4);
    if (!drew) drawPlaceholderArt(ctx, col3X, artY, artSz, 4);

    const textX = col3X + artSz + 8;
    const centerY = rowY + rowH / 2;
    const maxTextW = col3X + colW - textX - 4;

    ctx.fillStyle = rankColor(i);
    ctx.font = `bold ${12}px ${FONT}`;
    const rk = `${i + 1}`;
    ctx.fillText(rk, textX, centerY - 5);

    const rkW = ctx.measureText(rk).width + 5;
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${12}px ${FONT}`;
    ctx.fillText(truncateText(ctx, a.albumName, maxTextW - rkW), textX + rkW, centerY - 5);

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `${10}px ${FONT}`;
    ctx.fillText(truncateText(ctx, a.artistName, maxTextW - rkW), textX + rkW, centerY + 9);
  }

  // Watermark
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.font = `${11}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("Listening Stats for Spicetify", w / 2, h - 10);
  ctx.textAlign = "left";

  return canvas;
}

export async function generateShareCard(options: ShareCardOptions): Promise<Blob> {
  const { stats, period, format, providerType } = options;

  const canvas = format === "story"
    ? await generateStoryCard(stats, period, providerType)
    : await generateLandscapeCard(stats, period, providerType);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  });
}

export async function shareOrDownload(blob: Blob): Promise<"shared" | "copied" | "downloaded"> {
  if (navigator.share) {
    try {
      const file = new File([blob], "listening-stats.png", { type: "image/png" });
      await navigator.share({ files: [file] });
      return "shared";
    } catch { /* user cancelled or not supported */ }
  }

  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    return "copied";
  } catch { /* clipboard not supported */ }

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
