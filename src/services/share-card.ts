import type { ListeningStats, ProviderType } from "../types/listeningstats";
import { getConfig as getLastfmConfig } from "./lastfm";
import {
  formatDuration,
  formatDurationLong,
  getPeriodDisplayName,
} from "./stats";
import { getConfig as getStatsfmConfig } from "./statsfm";

interface ShareCardOptions {
  stats: ListeningStats;
  period: string;
  format: "story" | "landscape";
  providerType?: ProviderType | null;
}

function getProviderLabel(providerType?: ProviderType | null): string {
  if (providerType === "lastfm") return "via Last.fm";
  if (providerType === "statsfm") return "via stats.fm";
  if (providerType === "local") return "via Local Tracking";
  return "";
}

function getUsername(providerType?: ProviderType | null): string | null {
  if (providerType === "lastfm") return getLastfmConfig()?.username || null;
  if (providerType === "statsfm") return getStatsfmConfig()?.username || null;
  return null;
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const GREEN: [number, number, number] = [29, 185, 84];
const GOLD = "#ffd700";
const SILVER = "#c0c0c0";
const BRONZE = "#cd7f32";

// ── Shared Helpers ──

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
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
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
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "\u2026").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "\u2026";
}

function rankColor(i: number): string {
  return i === 0 ? GOLD : i === 1 ? SILVER : i === 2 ? BRONZE : "#888";
}

function rgb(c: [number, number, number], a = 1): string {
  return a === 1
    ? `rgb(${c[0]},${c[1]},${c[2]})`
    : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function formatHourLabel(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

// ── Visual Effect Helpers ──

function extractDominantColor(img: HTMLImageElement): [number, number, number] {
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    const cx = c.getContext("2d")!;
    cx.drawImage(img, 0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    const max = Math.max(d[0], d[1], d[2]);
    if (max < 60) return GREEN;
    return [d[0], d[1], d[2]];
  } catch {
    return GREEN;
  }
}

function drawBlurredBackground(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  blur: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(img, dx - blur, dy - blur, dw + blur * 2, dh + blur * 2);
  ctx.filter = "none";
  ctx.restore();
}

function drawNoiseTexture(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opacity: number,
) {
  const tileSize = 128;
  const offscreen = document.createElement("canvas");
  offscreen.width = tileSize;
  offscreen.height = tileSize;
  const octx = offscreen.getContext("2d")!;
  const imgData = octx.createImageData(tileSize, tileSize);
  const alpha = Math.round(opacity * 255);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const v = Math.random() * 255;
    imgData.data[i] = v;
    imgData.data[i + 1] = v;
    imgData.data[i + 2] = v;
    imgData.data[i + 3] = alpha;
  }
  octx.putImageData(imgData, 0, 0);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let ty = y; ty < y + h; ty += tileSize) {
    for (let tx = x; tx < x + w; tx += tileSize) {
      ctx.drawImage(offscreen, tx, ty);
    }
  }
  ctx.restore();
}

function drawAccentDivider(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  accent: [number, number, number],
) {
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, rgb(accent, 0.6));
  grad.addColorStop(0.5, rgb(accent, 0.15));
  grad.addColorStop(1, rgb(accent, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, 2);
}

function drawHourlyChart(
  ctx: CanvasRenderingContext2D,
  data: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  accent: [number, number, number],
  peakHour: number,
  barCount = 24,
) {
  const maxVal = Math.max(...data, 1);
  const gap = 4;
  const barW = (w - gap * (barCount - 1)) / barCount;
  const chartH = h - 24;
  const minBarH = 4;

  for (let i = 0; i < barCount; i++) {
    const val = data[i] || 0;
    const barH = Math.max(
      val > 0 ? (val / maxVal) * chartH : 0,
      val > 0 ? minBarH : 2,
    );
    const bx = x + i * (barW + gap);
    const by = y + chartH - barH;

    const isPeak = i === peakHour;
    ctx.fillStyle = isPeak ? rgb(accent, 1) : rgb(accent, 0.4);
    fillRoundRect(ctx, bx, by, barW, barH, Math.min(barW / 2, 3));

    if (isPeak) {
      ctx.shadowColor = rgb(accent, 0.6);
      ctx.shadowBlur = 8;
      fillRoundRect(ctx, bx, by, barW, barH, Math.min(barW / 2, 3));
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    }
  }

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = `${11}px ${FONT}`;
  ctx.textAlign = "center";
  for (let i = 0; i < barCount; i += 3) {
    const bx = x + i * (barW + gap) + barW / 2;
    ctx.fillText(formatHourLabel(i), bx, y + h);
  }
  ctx.textAlign = "left";
}

function drawGenrePills(
  ctx: CanvasRenderingContext2D,
  genres: Array<{ genre: string; count: number }>,
  x: number,
  y: number,
  maxW: number,
  accent: [number, number, number],
) {
  ctx.font = `500 ${13}px ${FONT}`;
  const pillH = 28;
  const pillGap = 8;
  const pillPadX = 14;
  let cx = x;

  for (const g of genres.slice(0, 6)) {
    const textW = ctx.measureText(g.genre).width;
    const pillW = textW + pillPadX * 2;
    if (cx + pillW > x + maxW) break;

    ctx.fillStyle = rgb(accent, 0.15);
    fillRoundRect(ctx, cx, y, pillW, pillH, pillH / 2);

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.textBaseline = "middle";
    ctx.fillText(g.genre, cx + pillPadX, y + pillH / 2);
    ctx.textBaseline = "alphabetic";

    cx += pillW + pillGap;
  }
}

async function drawArt(
  ctx: CanvasRenderingContext2D,
  url: string | undefined,
  x: number,
  y: number,
  size: number,
  radius: number,
): Promise<HTMLImageElement | null> {
  if (!url) return null;
  const img = await loadImage(url);
  if (!img) return null;
  ctx.save();
  roundRect(ctx, x, y, size, size, radius);
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
  return img;
}

function drawPlaceholderArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius: number,
) {
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  fillRoundRect(ctx, x, y, size, size, radius);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.font = `${size * 0.4}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("\u266B", x + size / 2, y + size / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawStatCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  label: string,
  accent: [number, number, number],
  highlight = false,
) {
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  fillRoundRect(ctx, x, y, w, h, 12);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 12);
  ctx.stroke();

  ctx.fillStyle = highlight ? rgb(accent) : "#fff";
  ctx.font = `bold ${30}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(value, x + w / 2, y + h * 0.48);

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = `500 ${12}px ${FONT}`;
  ctx.fillText(label, x + w / 2, y + h * 0.76);
  ctx.textAlign = "left";
}

function drawSectionHeader(
  ctx: CanvasRenderingContext2D,
  title: string,
  x: number,
  y: number,
  accent: [number, number, number],
): number {
  ctx.fillStyle = rgb(accent);
  ctx.beginPath();
  ctx.arc(x + 5, y + 12, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${20}px ${FONT}`;
  ctx.fillText(title, x + 18, y + 18);
  return y + 36;
}

// ── Pre-calculate story card height based on available data ──

function calculateStoryHeight(stats: ListeningStats): number {
  const pad = 56;
  let y = pad; // top padding

  // Header (title + period + username)
  y += 80;

  // Hero art + track info
  y += 260 + 100; // art size + text below

  // Stats grid (2x3)
  y += 68 + 10 + 68 + 32; // 2 rows + gap + margin

  // Divider
  y += 16;

  // Top tracks
  const rowH = 68;
  const headerH = 40;
  const trackCount = Math.min(5, stats.topTracks.length);
  if (trackCount > 0) {
    y += headerH + rowH * trackCount + 28;
  }

  // Top artists
  const artistCount = Math.min(5, stats.topArtists.length);
  if (artistCount > 0) {
    y += 16 + headerH + rowH * artistCount + 28;
  }

  // Top albums
  const albumCount = Math.min(5, stats.topAlbums.length);
  if (albumCount > 0) {
    y += 16 + headerH + rowH * albumCount + 28;
  }

  // Hourly chart
  if (stats.hourlyDistribution.some((v) => v > 0)) {
    y += 16 + headerH + 140 + 20;
  }

  // Genre pills
  if (stats.topGenres.length > 0) {
    y += 16 + 36 + 20;
  }

  y += 48; // footer watermark
  return Math.max(y, 900);
}

const STORY_W = 1080;
const LAND_W = 1600;
const LAND_H = 900;

// ==================== STORY CARD (1080 x dynamic) ====================

async function generateStoryCard(
  stats: ListeningStats,
  period: string,
  providerType?: ProviderType | null,
): Promise<HTMLCanvasElement> {
  const w = STORY_W;
  const h = calculateStoryHeight(stats);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const pad = 56;
  const innerW = w - pad * 2;
  const rightEdge = w - pad;

  // Determine accent color from #1 track art
  let accent: [number, number, number] = GREEN;
  let heroImg: HTMLImageElement | null = null;
  if (stats.topTracks[0]?.albumArt) {
    heroImg = await loadImage(stats.topTracks[0].albumArt);
    if (heroImg) accent = extractDominantColor(heroImg);
  }

  // ── Full blurred background ──
  if (heroImg) {
    drawBlurredBackground(ctx, heroImg, 0, 0, w, h, 60);
  }
  const baseOverlay = ctx.createLinearGradient(0, 0, 0, h);
  baseOverlay.addColorStop(0, "rgba(8,8,14,0.78)");
  baseOverlay.addColorStop(0.3, "rgba(8,8,14,0.88)");
  baseOverlay.addColorStop(1, "rgba(8,8,14,0.94)");
  ctx.fillStyle = baseOverlay;
  ctx.fillRect(0, 0, w, h);

  // ── Header ──
  const username = getUsername(providerType);
  let headerY = pad;

  if (username) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `500 ${16}px ${FONT}`;
    ctx.fillText(`@${username}`, pad, headerY + 14);
    headerY += 28;
  }

  const title = username ? `${username}'s Stats` : "My Listening Stats";
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${44}px ${FONT}`;
  ctx.fillText(truncateText(ctx, title, innerW), pad, headerY + 38);

  const periodText = getPeriodDisplayName(period);
  ctx.font = `600 ${16}px ${FONT}`;
  const periodTextW = ctx.measureText(periodText).width;
  const pillW = periodTextW + 22;
  ctx.fillStyle = rgb(accent, 0.25);
  fillRoundRect(ctx, pad, headerY + 50, pillW, 28, 14);
  ctx.fillStyle = rgb(accent);
  ctx.fillText(periodText, pad + 11, headerY + 69);

  const providerLabel = getProviderLabel(providerType);
  if (providerLabel) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `${14}px ${FONT}`;
    ctx.fillText(providerLabel, pad + pillW + 12, headerY + 69);
  }

  headerY += 80;

  // ── Hero: Large #1 album art ──
  const artSize = 260;
  const artX = (w - artSize) / 2;
  const artY = headerY;

  if (stats.topTracks[0]) {
    const drew = await drawArt(ctx, stats.topTracks[0].albumArt, artX, artY, artSize, 16);
    if (!drew) drawPlaceholderArt(ctx, artX, artY, artSize, 16);

    // Glow
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.shadowColor = rgb(accent, 0.4);
    ctx.shadowBlur = 50;
    ctx.fillStyle = "rgba(0,0,0,0)";
    fillRoundRect(ctx, artX, artY, artSize, artSize, 16);
    ctx.restore();

    // Track info
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${28}px ${FONT}`;
    ctx.fillText(truncateText(ctx, stats.topTracks[0].trackName, innerW - 40), w / 2, artY + artSize + 40);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `${18}px ${FONT}`;
    ctx.fillText(truncateText(ctx, stats.topTracks[0].artistName, innerW - 40), w / 2, artY + artSize + 68);
    ctx.fillStyle = rgb(accent, 0.7);
    ctx.font = `600 ${14}px ${FONT}`;
    ctx.fillText("#1 Most Played", w / 2, artY + artSize + 92);
    ctx.textAlign = "left";
  } else {
    drawPlaceholderArt(ctx, artX, artY, artSize, 16);
  }

  // ── Stats Grid (2x3) ──
  let y = artY + artSize + 110;
  const gridGap = 10;
  const cardW = (innerW - gridGap * 2) / 3;
  const cardH = 68;

  drawStatCard(ctx, pad, y, cardW, cardH, formatDurationLong(stats.totalTimeMs), "LISTENED", accent, true);
  drawStatCard(ctx, pad + cardW + gridGap, y, cardW, cardH, `${stats.trackCount}`, "PLAYS", accent);
  drawStatCard(ctx, pad + (cardW + gridGap) * 2, y, cardW, cardH, `${stats.uniqueTrackCount}`, "UNIQUE", accent);

  const row2Y = y + cardH + gridGap;
  drawStatCard(ctx, pad, row2Y, cardW, cardH, `${stats.uniqueArtistCount}`, "ARTISTS", accent);
  drawStatCard(ctx, pad + cardW + gridGap, row2Y, cardW, cardH, stats.streakDays > 0 ? `${stats.streakDays}d` : "-", "STREAK", accent, stats.streakDays > 0);
  drawStatCard(ctx, pad + (cardW + gridGap) * 2, row2Y, cardW, cardH, `${Math.round(stats.skipRate * 100)}%`, "SKIP RATE", accent);

  y = row2Y + cardH + 32;

  // ── Ranked list helper ──
  const listArtSize = 56;
  const listRowH = 68;

  async function drawStoryList(
    items: Array<{ name: string; sub: string; art?: string; plays?: number; circular?: boolean }>,
    startY: number,
    sectionTitle: string,
    maxItems: number,
  ): Promise<number> {
    drawAccentDivider(ctx, pad, startY, innerW, accent);
    startY += 16;
    startY = drawSectionHeader(ctx, sectionTitle, pad, startY, accent);

    const count = Math.min(maxItems, items.length);

    // Panel background
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    fillRoundRect(ctx, pad - 12, startY - 8, innerW + 24, listRowH * count + 16, 14);

    for (let i = 0; i < count; i++) {
      const item = items[i];
      const rowY = startY + i * listRowH;
      const artY2 = rowY + (listRowH - listArtSize) / 2;
      const radius = item.circular ? listArtSize / 2 : 8;

      const drew = await drawArt(ctx, item.art, pad, artY2, listArtSize, radius);
      if (!drew) drawPlaceholderArt(ctx, pad, artY2, listArtSize, radius);

      const textX = pad + listArtSize + 16;
      const centerY = rowY + listRowH / 2;

      ctx.fillStyle = rankColor(i);
      ctx.font = `bold ${15}px ${FONT}`;
      const rk = `${i + 1}`;
      ctx.fillText(rk, textX, centerY - 9);

      const rkW = ctx.measureText(rk).width + 8;
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${16}px ${FONT}`;
      ctx.fillText(truncateText(ctx, item.name, rightEdge - textX - rkW - (item.plays ? 90 : 10)), textX + rkW, centerY - 9);

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `${13}px ${FONT}`;
      ctx.fillText(truncateText(ctx, item.sub, rightEdge - textX - rkW - (item.plays ? 90 : 10)), textX + rkW, centerY + 11);

      if (item.plays) {
        ctx.fillStyle = rgb(accent);
        ctx.font = `600 ${14}px ${FONT}`;
        ctx.textAlign = "right";
        ctx.fillText(`${item.plays} plays`, rightEdge, centerY + 1);
        ctx.textAlign = "left";
      }
    }

    return startY + listRowH * count + 28;
  }

  // ── Top 5 Tracks ──
  if (stats.topTracks.length > 0) {
    y = await drawStoryList(
      stats.topTracks.map((t) => ({ name: t.trackName, sub: t.artistName, art: t.albumArt, plays: t.playCount })),
      y, "Top Tracks", 5,
    );
  }

  // ── Top 5 Artists ──
  if (stats.topArtists.length > 0) {
    y = await drawStoryList(
      stats.topArtists.map((a) => ({ name: a.artistName, sub: a.playCount ? `${a.playCount} plays` : "", art: a.artistImage, circular: true })),
      y, "Top Artists", 5,
    );
  }

  // ── Top 5 Albums ──
  if (stats.topAlbums.length > 0) {
    y = await drawStoryList(
      stats.topAlbums.map((a) => ({ name: a.albumName, sub: a.artistName, art: a.albumArt, plays: a.playCount })),
      y, "Top Albums", 5,
    );
  }

  // ── Hourly Activity Chart ──
  if (stats.hourlyDistribution.some((v) => v > 0)) {
    drawAccentDivider(ctx, pad, y, innerW, accent);
    y += 16;

    ctx.fillStyle = rgb(accent);
    ctx.beginPath();
    ctx.arc(pad + 5, y + 12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${20}px ${FONT}`;
    ctx.fillText("Activity by Hour", pad + 18, y + 18);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `${14}px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(`Peak: ${formatHourLabel(stats.peakHour)}`, rightEdge, y + 18);
    ctx.textAlign = "left";

    y += 40;
    drawHourlyChart(ctx, stats.hourlyDistribution, pad, y, innerW, 140, accent, stats.peakHour);
    y += 140 + 20;
  }

  // ── Genre Pills ──
  if (stats.topGenres.length > 0) {
    drawAccentDivider(ctx, pad, y, innerW, accent);
    y += 20;
    drawGenrePills(ctx, stats.topGenres, pad, y, innerW, accent);
    y += 44;
  }

  // ── Noise texture ──
  drawNoiseTexture(ctx, 0, 0, w, h, 0.02);

  // ── Accent bar at top ──
  const topBar = ctx.createLinearGradient(0, 0, w, 0);
  topBar.addColorStop(0, rgb(accent));
  topBar.addColorStop(1, rgb(accent, 0.3));
  ctx.fillStyle = topBar;
  ctx.fillRect(0, 0, w, 4);

  // ── Footer watermark ──
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.font = `${14}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("Listening Stats for Spicetify", w / 2, h - 20);
  ctx.textAlign = "left";

  return canvas;
}

// ==================== LANDSCAPE CARD (1600 x 900) ====================

async function generateLandscapeCard(
  stats: ListeningStats,
  period: string,
  providerType?: ProviderType | null,
): Promise<HTMLCanvasElement> {
  const w = LAND_W;
  const h = LAND_H;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  let accent: [number, number, number] = GREEN;
  let heroImg: HTMLImageElement | null = null;
  if (stats.topTracks[0]?.albumArt) {
    heroImg = await loadImage(stats.topTracks[0].albumArt);
    if (heroImg) accent = extractDominantColor(heroImg);
  }

  // ── Full blurred background ──
  if (heroImg) {
    drawBlurredBackground(ctx, heroImg, 0, 0, w, h, 60);
  }
  const baseOverlay = ctx.createLinearGradient(0, 0, 0, h);
  baseOverlay.addColorStop(0, "rgba(8,8,14,0.82)");
  baseOverlay.addColorStop(1, "rgba(8,8,14,0.92)");
  ctx.fillStyle = baseOverlay;
  ctx.fillRect(0, 0, w, h);

  const pad = 56;
  const innerW = w - pad * 2;
  const username = getUsername(providerType);

  // ── Left Panel (hero) ──
  const leftW = 440;

  // Username
  let heroY = pad;
  if (username) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `500 ${16}px ${FONT}`;
    ctx.fillText(`@${username}`, pad, heroY + 14);
    heroY += 32;
  }

  // Title + period
  const title = username ? `${username}'s Stats` : "My Listening Stats";
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${32}px ${FONT}`;
  ctx.fillText(truncateText(ctx, title, leftW - 20), pad, heroY + 28);

  const periodText = getPeriodDisplayName(period);
  ctx.font = `600 ${14}px ${FONT}`;
  const pTextW = ctx.measureText(periodText).width;
  const pPillW = pTextW + 20;
  ctx.fillStyle = rgb(accent, 0.25);
  fillRoundRect(ctx, pad, heroY + 40, pPillW, 26, 13);
  ctx.fillStyle = rgb(accent);
  ctx.fillText(periodText, pad + 10, heroY + 57);

  const providerLabel = getProviderLabel(providerType);
  if (providerLabel) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `${13}px ${FONT}`;
    ctx.fillText(providerLabel, pad + pPillW + 10, heroY + 57);
  }

  heroY += 80;

  // Large #1 album art
  const artSize = 220;
  const artX = pad;
  const artY = heroY;
  if (stats.topTracks[0]) {
    const drew = await drawArt(ctx, stats.topTracks[0].albumArt, artX, artY, artSize, 14);
    if (!drew) drawPlaceholderArt(ctx, artX, artY, artSize, 14);

    // Glow
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.shadowColor = rgb(accent, 0.35);
    ctx.shadowBlur = 50;
    ctx.fillStyle = "rgba(0,0,0,0)";
    fillRoundRect(ctx, artX, artY, artSize, artSize, 14);
    ctx.restore();

    // Track info beside art
    const infoX = artX + artSize + 24;
    const infoMaxW = leftW - artSize - 24;
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${22}px ${FONT}`;
    ctx.fillText(
      truncateText(ctx, stats.topTracks[0].trackName, infoMaxW),
      infoX,
      artY + 30,
    );
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `${16}px ${FONT}`;
    ctx.fillText(
      truncateText(ctx, stats.topTracks[0].artistName, infoMaxW),
      infoX,
      artY + 56,
    );
    ctx.fillStyle = rgb(accent, 0.7);
    ctx.font = `600 ${12}px ${FONT}`;
    ctx.fillText("#1 Most Played", infoX, artY + 78);

    // Play count if available
    if (stats.topTracks[0].playCount) {
      ctx.fillStyle = rgb(accent);
      ctx.font = `bold ${36}px ${FONT}`;
      ctx.fillText(`${stats.topTracks[0].playCount}`, infoX, artY + 130);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = `500 ${13}px ${FONT}`;
      ctx.fillText("plays", infoX, artY + 150);
    }
  } else {
    drawPlaceholderArt(ctx, artX, artY, artSize, 14);
  }

  // Stats row below hero
  const statY = artY + artSize + 28;
  const statCardW = (leftW - 12) / 3;
  const statCardH = 60;

  drawStatCard(ctx, pad, statY, statCardW, statCardH, formatDuration(stats.totalTimeMs), "LISTENED", accent, true);
  drawStatCard(ctx, pad + statCardW + 6, statY, statCardW, statCardH, `${stats.trackCount}`, "PLAYS", accent);
  drawStatCard(ctx, pad + (statCardW + 6) * 2, statY, statCardW, statCardH, `${stats.uniqueArtistCount}`, "ARTISTS", accent);

  const stat2Y = statY + statCardH + 8;
  drawStatCard(ctx, pad, stat2Y, statCardW, statCardH, `${stats.uniqueTrackCount}`, "UNIQUE", accent);
  drawStatCard(ctx, pad + statCardW + 6, stat2Y, statCardW, statCardH, stats.streakDays > 0 ? `${stats.streakDays}d` : "-", "STREAK", accent, stats.streakDays > 0);
  drawStatCard(ctx, pad + (statCardW + 6) * 2, stat2Y, statCardW, statCardH, `${Math.round(stats.skipRate * 100)}%`, "SKIP RATE", accent);

  // Genre pills below stats
  if (stats.topGenres.length > 0) {
    drawGenrePills(ctx, stats.topGenres, pad, stat2Y + statCardH + 16, leftW, accent);
  }

  // ── Right Panel: 3 columns ──
  const rX = pad + leftW + 40;
  const rInnerW = w - rX - pad;
  const colGap = 24;
  const colW = (rInnerW - colGap * 2) / 3;

  const listArtSize = 44;
  const listRowH = 56;
  const listHeaderH = 32;

  // Helper: draw a ranked list section
  async function drawRankedList(
    items: Array<{ name: string; sub: string; art?: string; plays?: number; circular?: boolean }>,
    colX: number,
    startY: number,
    title: string,
    maxItems: number,
  ) {
    // Section header
    ctx.fillStyle = rgb(accent);
    ctx.beginPath();
    ctx.arc(colX + 5, startY + 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${16}px ${FONT}`;
    ctx.fillText(title, colX + 18, startY + 14);

    let y = startY + listHeaderH;
    const count = Math.min(maxItems, items.length);

    // Panel background
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    fillRoundRect(ctx, colX - 10, y - 6, colW + 20, listRowH * count + 12, 12);

    for (let i = 0; i < count; i++) {
      const item = items[i];
      const rowY = y + i * listRowH;
      const artY2 = rowY + (listRowH - listArtSize) / 2;
      const radius = item.circular ? listArtSize / 2 : 6;

      const drew = await drawArt(ctx, item.art, colX, artY2, listArtSize, radius);
      if (!drew) drawPlaceholderArt(ctx, colX, artY2, listArtSize, radius);

      const textX = colX + listArtSize + 12;
      const centerY = rowY + listRowH / 2;
      const maxTextW = colX + colW - textX;

      // Rank
      ctx.fillStyle = rankColor(i);
      ctx.font = `bold ${13}px ${FONT}`;
      const rk = `${i + 1}`;
      ctx.fillText(rk, textX, centerY - 7);

      const rkW = ctx.measureText(rk).width + 6;

      // Name
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${13}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, item.name, maxTextW - rkW),
        textX + rkW,
        centerY - 7,
      );

      // Sub line (artist or play count)
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = `${11}px ${FONT}`;
      const subText = item.plays ? `${item.sub} \u2022 ${item.plays}` : item.sub;
      ctx.fillText(
        truncateText(ctx, subText, maxTextW - rkW),
        textX + rkW,
        centerY + 9,
      );
    }
  }

  const listStartY = pad;
  const maxListItems = 5;

  // Top Tracks
  await drawRankedList(
    stats.topTracks.map((t) => ({
      name: t.trackName,
      sub: t.artistName,
      art: t.albumArt,
      plays: t.playCount,
    })),
    rX,
    listStartY,
    "Top Tracks",
    maxListItems,
  );

  // Top Artists
  await drawRankedList(
    stats.topArtists.map((a) => ({
      name: a.artistName,
      sub: a.playCount ? `${a.playCount} plays` : "",
      art: a.artistImage,
      circular: true,
    })),
    rX + colW + colGap,
    listStartY,
    "Top Artists",
    maxListItems,
  );

  // Top Albums
  await drawRankedList(
    stats.topAlbums.map((a) => ({
      name: a.albumName,
      sub: a.artistName,
      art: a.albumArt,
      plays: a.playCount,
    })),
    rX + (colW + colGap) * 2,
    listStartY,
    "Top Albums",
    maxListItems,
  );

  // ── Activity Chart (full width below lists) ──
  const chartY = listStartY + listHeaderH + listRowH * maxListItems + 36;
  if (stats.hourlyDistribution.some((v) => v > 0)) {
    // Section header
    ctx.fillStyle = rgb(accent);
    ctx.beginPath();
    ctx.arc(rX + 5, chartY + 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${16}px ${FONT}`;
    ctx.fillText("Activity by Hour", rX + 18, chartY + 14);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `${13}px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(`Peak: ${formatHourLabel(stats.peakHour)}`, rX + rInnerW, chartY + 14);
    ctx.textAlign = "left";

    const chartTopY = chartY + 28;
    const chartH = h - chartTopY - 40;
    if (chartH > 40) {
      drawHourlyChart(ctx, stats.hourlyDistribution, rX, chartTopY, rInnerW, chartH, accent, stats.peakHour);
    }
  }

  // ── Noise texture ──
  drawNoiseTexture(ctx, 0, 0, w, h, 0.018);

  // ── Accent bar at top ──
  const topBar = ctx.createLinearGradient(0, 0, w, 0);
  topBar.addColorStop(0, rgb(accent));
  topBar.addColorStop(1, rgb(accent, 0.3));
  ctx.fillStyle = topBar;
  ctx.fillRect(0, 0, w, 4);

  // ── Watermark ──
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.font = `${13}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("Listening Stats for Spicetify", w / 2, h - 14);
  ctx.textAlign = "left";

  return canvas;
}

export async function generateShareCard(
  options: ShareCardOptions,
): Promise<Blob> {
  const { stats, period, format, providerType } = options;

  const canvas =
    format === "story"
      ? await generateStoryCard(stats, period, providerType)
      : await generateLandscapeCard(stats, period, providerType);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  });
}

export async function shareOrDownload(
  blob: Blob,
): Promise<"shared" | "copied" | "downloaded"> {
  if (navigator.share) {
    try {
      const file = new File([blob], "listening-stats.png", {
        type: "image/png",
      });
      await navigator.share({ files: [file] });
      return "shared";
    } catch {
      /* user cancelled or not supported */
    }
  }

  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return "copied";
  } catch {
    /* clipboard not supported */
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
