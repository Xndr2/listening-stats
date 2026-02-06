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
  let y = 480; // hero section
  y += 16; // divider gap
  y += 58 + 12 + 58 + 28; // stats grid (2 rows + gaps + margin)
  y += 16; // divider

  // Top tracks
  const trackCount = Math.min(5, stats.topTracks.length);
  if (trackCount > 0) {
    y += 36 + 64 * trackCount + 16 + 24; // header + rows + panel pad + margin
  }

  // Top artists
  const artistCount = Math.min(3, stats.topArtists.length);
  if (artistCount > 0) {
    y += 16 + 40 + 80 + 56; // divider + header + images + name/gap
  }

  // Top albums
  const albumCount = Math.min(5, stats.topAlbums.length);
  if (albumCount > 0) {
    y += 16 + 36 + 64 * albumCount + 16 + 24; // divider + header + rows + pad + margin
  }

  // Hourly chart
  if (stats.hourlyDistribution.some((v) => v > 0)) {
    y += 16 + 36 + 120 + 16; // divider + header + chart + margin
  }

  // Genre pills
  if (stats.topGenres.length > 0) {
    y += 16 + 28 + 20; // divider + pills + margin
  }

  y += 48; // footer watermark
  return Math.max(y, 800); // minimum height
}

const STORY_W = 1080;
const LAND_W = 1200;
const LAND_H = 675;

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

  const pad = 52;
  const innerW = w - pad * 2;
  const rightEdge = w - pad;

  // Determine accent color from #1 track art
  let accent: [number, number, number] = GREEN;
  let heroImg: HTMLImageElement | null = null;
  if (stats.topTracks[0]?.albumArt) {
    heroImg = await loadImage(stats.topTracks[0].albumArt);
    if (heroImg) accent = extractDominantColor(heroImg);
  }

  // ── Dark base ──
  const baseBg = ctx.createLinearGradient(0, 0, 0, h);
  baseBg.addColorStop(0, "#0c0c12");
  baseBg.addColorStop(1, "#0a0a0f");
  ctx.fillStyle = baseBg;
  ctx.fillRect(0, 0, w, h);

  // ── Hero Section (0–480) ──
  const heroH = 480;
  if (heroImg) {
    drawBlurredBackground(ctx, heroImg, 0, 0, w, heroH, 50);
  }

  // Dark gradient overlay
  const heroOverlay = ctx.createLinearGradient(0, 0, 0, heroH);
  heroOverlay.addColorStop(0, "rgba(0,0,0,0.5)");
  heroOverlay.addColorStop(0.7, "rgba(12,12,18,0.85)");
  heroOverlay.addColorStop(1, "rgba(10,10,15,1)");
  ctx.fillStyle = heroOverlay;
  ctx.fillRect(0, 0, w, heroH);

  // Username or default title
  const username = getUsername(providerType);
  const title = username ? `${username}'s Stats` : "My Listening Stats";
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${42}px ${FONT}`;
  ctx.fillText(truncateText(ctx, title, innerW), pad, 64);

  // Period pill
  const periodText = getPeriodDisplayName(period);
  ctx.font = `600 ${15}px ${FONT}`;
  const periodTextW = ctx.measureText(periodText).width;
  const pillW = periodTextW + 20;
  ctx.fillStyle = rgb(accent, 0.2);
  fillRoundRect(ctx, pad, 78, pillW, 26, 13);
  ctx.fillStyle = rgb(accent);
  ctx.fillText(periodText, pad + 10, 96);

  const providerLabel = getProviderLabel(providerType);
  if (providerLabel) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `${13}px ${FONT}`;
    ctx.fillText(providerLabel, pad + pillW + 10, 96);
  }

  // Large #1 album art centered
  const artSize = 190;
  const artX = (w - artSize) / 2;
  const artY = 128;
  if (stats.topTracks[0]) {
    const drew = await drawArt(
      ctx,
      stats.topTracks[0].albumArt,
      artX,
      artY,
      artSize,
      16,
    );
    if (!drew) drawPlaceholderArt(ctx, artX, artY, artSize, 16);

    // Glow behind art
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.shadowColor = rgb(accent, 0.4);
    ctx.shadowBlur = 40;
    ctx.fillStyle = "rgba(0,0,0,0)";
    fillRoundRect(ctx, artX, artY, artSize, artSize, 16);
    ctx.restore();

    // Track info
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${26}px ${FONT}`;
    ctx.fillText(
      truncateText(ctx, stats.topTracks[0].trackName, innerW - 40),
      w / 2,
      artY + artSize + 36,
    );
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `${18}px ${FONT}`;
    ctx.fillText(
      truncateText(ctx, stats.topTracks[0].artistName, innerW - 40),
      w / 2,
      artY + artSize + 62,
    );
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${14}px ${FONT}`;
    ctx.fillText("#1 Most Played", w / 2, artY + artSize + 84);
    ctx.textAlign = "left";
  } else {
    drawPlaceholderArt(ctx, artX, artY, artSize, 16);
  }

  // Accent divider below hero
  drawAccentDivider(ctx, pad, heroH, innerW, accent);

  // ── Stats Grid ──
  let y = heroH + 16;
  const gridGap = 12;
  const cardW = (innerW - gridGap * 2) / 3;
  const cardH = 58;

  drawStatCard(
    ctx,
    pad,
    y,
    cardW,
    cardH,
    formatDurationLong(stats.totalTimeMs),
    "LISTENED",
    accent,
    true,
  );
  drawStatCard(
    ctx,
    pad + cardW + gridGap,
    y,
    cardW,
    cardH,
    `${stats.trackCount}`,
    "PLAYS",
    accent,
  );
  drawStatCard(
    ctx,
    pad + (cardW + gridGap) * 2,
    y,
    cardW,
    cardH,
    `${stats.uniqueTrackCount}`,
    "UNIQUE TRACKS",
    accent,
  );

  const row2Y = y + cardH + gridGap;
  drawStatCard(
    ctx,
    pad,
    row2Y,
    cardW,
    cardH,
    `${stats.uniqueArtistCount}`,
    "ARTISTS",
    accent,
  );
  drawStatCard(
    ctx,
    pad + cardW + gridGap,
    row2Y,
    cardW,
    cardH,
    stats.streakDays > 0 ? `${stats.streakDays}d` : "-",
    "STREAK",
    accent,
    stats.streakDays > 0,
  );
  drawStatCard(
    ctx,
    pad + (cardW + gridGap) * 2,
    row2Y,
    cardW,
    cardH,
    `${Math.round(stats.skipRate * 100)}%`,
    "SKIP RATE",
    accent,
  );

  y = row2Y + cardH + 28;

  // ── Top 5 Tracks ──
  const trackCount = Math.min(5, stats.topTracks.length);
  if (trackCount > 0) {
    drawAccentDivider(ctx, pad, y, innerW, accent);
    y += 16;
    y = drawSectionHeader(ctx, "Top Tracks", pad, y, accent);

    const trackArtSize = 52;
    const trackRowH = 64;

    ctx.fillStyle = "rgba(255,255,255,0.02)";
    fillRoundRect(
      ctx,
      pad - 12,
      y - 8,
      innerW + 24,
      trackRowH * trackCount + 16,
      14,
    );

    for (let i = 0; i < trackCount; i++) {
      const t = stats.topTracks[i];
      const rowY = y + i * trackRowH;
      const artY2 = rowY + (trackRowH - trackArtSize) / 2;

      const drew = await drawArt(ctx, t.albumArt, pad, artY2, trackArtSize, 8);
      if (!drew) drawPlaceholderArt(ctx, pad, artY2, trackArtSize, 8);

      const textX = pad + trackArtSize + 14;
      const centerY = rowY + trackRowH / 2;

      ctx.fillStyle = rankColor(i);
      ctx.font = `bold ${14}px ${FONT}`;
      const rk = `${i + 1}`;
      ctx.fillText(rk, textX, centerY - 8);

      const rkW = ctx.measureText(rk).width + 8;
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${15}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, t.trackName, rightEdge - textX - rkW - 90),
        textX + rkW,
        centerY - 8,
      );

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `${12}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, t.artistName, rightEdge - textX - rkW - 90),
        textX + rkW,
        centerY + 10,
      );

      if (t.playCount) {
        ctx.fillStyle = rgb(accent);
        ctx.font = `600 ${13}px ${FONT}`;
        ctx.textAlign = "right";
        ctx.fillText(`${t.playCount} plays`, rightEdge, centerY + 1);
        ctx.textAlign = "left";
      }
    }

    y += trackRowH * trackCount + 24;
  }

  // ── Top 3 Artists ──
  const artistCount = Math.min(3, stats.topArtists.length);
  if (artistCount > 0) {
    drawAccentDivider(ctx, pad, y, innerW, accent);
    y += 16;
    y = drawSectionHeader(ctx, "Top Artists", pad, y, accent);
    y += 4;

    const artistImgSize = 80;
    const colW = innerW / artistCount;

    for (let i = 0; i < artistCount; i++) {
      const a = stats.topArtists[i];
      const cx = pad + colW * i + colW / 2;
      const imgX = cx - artistImgSize / 2;

      const drew = await drawArt(
        ctx,
        a.artistImage,
        imgX,
        y,
        artistImgSize,
        artistImgSize / 2,
      );
      if (!drew)
        drawPlaceholderArt(ctx, imgX, y, artistImgSize, artistImgSize / 2);

      // Rank medal
      const medalR = 12;
      const medalX = imgX + artistImgSize - medalR + 2;
      const medalY = y + medalR - 2;
      ctx.fillStyle = rankColor(i);
      ctx.beginPath();
      ctx.arc(medalX, medalY, medalR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.font = `bold ${12}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(`${i + 1}`, medalX, medalY + 4);

      // Name
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${14}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, a.artistName, colW - 16),
        cx,
        y + artistImgSize + 20,
      );

      if (a.playCount) {
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = `${12}px ${FONT}`;
        ctx.fillText(`${a.playCount} plays`, cx, y + artistImgSize + 38);
      }
      ctx.textAlign = "left";
    }

    y += artistImgSize + 56;
  }

  // ── Top 5 Albums ──
  const albumCount = Math.min(5, stats.topAlbums.length);
  if (albumCount > 0) {
    drawAccentDivider(ctx, pad, y, innerW, accent);
    y += 16;
    y = drawSectionHeader(ctx, "Top Albums", pad, y, accent);

    const albumArtSize = 52;
    const albumRowH = 64;

    ctx.fillStyle = "rgba(255,255,255,0.02)";
    fillRoundRect(
      ctx,
      pad - 12,
      y - 8,
      innerW + 24,
      albumRowH * albumCount + 16,
      14,
    );

    for (let i = 0; i < albumCount; i++) {
      const a = stats.topAlbums[i];
      const rowY = y + i * albumRowH;
      const artY2 = rowY + (albumRowH - albumArtSize) / 2;

      const drew = await drawArt(ctx, a.albumArt, pad, artY2, albumArtSize, 8);
      if (!drew) drawPlaceholderArt(ctx, pad, artY2, albumArtSize, 8);

      const textX = pad + albumArtSize + 14;
      const centerY = rowY + albumRowH / 2;

      ctx.fillStyle = rankColor(i);
      ctx.font = `bold ${14}px ${FONT}`;
      const rk = `${i + 1}`;
      ctx.fillText(rk, textX, centerY - 8);

      const rkW = ctx.measureText(rk).width + 8;
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${15}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, a.albumName, rightEdge - textX - rkW - 20),
        textX + rkW,
        centerY - 8,
      );

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `${12}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, a.artistName, rightEdge - textX - rkW - 20),
        textX + rkW,
        centerY + 10,
      );

      if (a.playCount) {
        ctx.fillStyle = rgb(accent);
        ctx.font = `600 ${13}px ${FONT}`;
        ctx.textAlign = "right";
        ctx.fillText(`${a.playCount} plays`, rightEdge, centerY + 1);
        ctx.textAlign = "left";
      }
    }

    y += albumRowH * albumCount + 24;
  }

  // ── Hourly Activity Chart ──
  if (stats.hourlyDistribution.some((v) => v > 0)) {
    drawAccentDivider(ctx, pad, y, innerW, accent);
    y += 16;

    // Section header with peak label
    ctx.fillStyle = rgb(accent);
    ctx.beginPath();
    ctx.arc(pad + 5, y + 12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${20}px ${FONT}`;
    ctx.fillText("When I Listen", pad + 18, y + 18);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `${13}px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(
      `Peak: ${formatHourLabel(stats.peakHour)}`,
      rightEdge - 8,
      y + 18,
    );
    ctx.textAlign = "left";

    y += 36;
    drawHourlyChart(
      ctx,
      stats.hourlyDistribution,
      pad,
      y,
      innerW,
      120,
      accent,
      stats.peakHour,
    );
    y += 120 + 16;
  }

  // ── Genre Pills ──
  if (stats.topGenres.length > 0) {
    drawAccentDivider(ctx, pad, y, innerW, accent);
    y += 20;
    drawGenrePills(ctx, stats.topGenres, pad, y, innerW, accent);
    y += 44;
  }

  // ── Noise texture ──
  drawNoiseTexture(ctx, 0, 0, w, h, 0.025);

  // ── Accent bar at top ──
  const topBar = ctx.createLinearGradient(0, 0, w, 0);
  topBar.addColorStop(0, rgb(accent));
  topBar.addColorStop(1, rgb(accent, 0.3));
  ctx.fillStyle = topBar;
  ctx.fillRect(0, 0, w, 4);

  // ── Footer watermark ──
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.font = `${13}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("Listening Stats for Spicetify", w / 2, h - 20);
  ctx.textAlign = "left";

  return canvas;
}

// ==================== LANDSCAPE CARD (1200 x 675) ====================

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

  // ── Dark base ──
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, w, h);

  // ── Left Panel (0–420) ──
  const leftW = 420;
  if (heroImg) {
    drawBlurredBackground(ctx, heroImg, 0, 0, leftW, h, 40);
  }

  const leftOverlay = ctx.createLinearGradient(0, 0, leftW, 0);
  leftOverlay.addColorStop(0, "rgba(0,0,0,0.45)");
  leftOverlay.addColorStop(0.8, "rgba(10,10,15,0.75)");
  leftOverlay.addColorStop(1, "rgba(10,10,15,0.95)");
  ctx.fillStyle = leftOverlay;
  ctx.fillRect(0, 0, leftW, h);

  // Vertical accent separator
  ctx.fillStyle = rgb(accent, 0.3);
  ctx.fillRect(leftW - 1, 0, 2, h);

  // Username or title on left panel
  const username = getUsername(providerType);
  const leftTitle = username ? `@${username}` : "";
  if (leftTitle) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `500 ${14}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(leftTitle, leftW / 2, 30);
    ctx.textAlign = "left";
  }

  // Album art
  const lArtSize = 170;
  const lArtX = (leftW - lArtSize) / 2;
  const lArtY = leftTitle ? 48 : 40;

  if (stats.topTracks[0]) {
    const drew = await drawArt(
      ctx,
      stats.topTracks[0].albumArt,
      lArtX,
      lArtY,
      lArtSize,
      12,
    );
    if (!drew) drawPlaceholderArt(ctx, lArtX, lArtY, lArtSize, 12);

    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${20}px ${FONT}`;
    ctx.fillText(
      truncateText(ctx, stats.topTracks[0].trackName, leftW - 48),
      leftW / 2,
      lArtY + lArtSize + 30,
    );
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `${14}px ${FONT}`;
    ctx.fillText(
      truncateText(ctx, stats.topTracks[0].artistName, leftW - 48),
      leftW / 2,
      lArtY + lArtSize + 52,
    );
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${11}px ${FONT}`;
    ctx.fillText("#1 Most Played", leftW / 2, lArtY + lArtSize + 70);
    ctx.textAlign = "left";
  } else {
    drawPlaceholderArt(ctx, lArtX, lArtY, lArtSize, 12);
  }

  // 2x2 stat grid
  const lStatY = 370;
  const lStatW = 160;
  const lStatH = 48;
  const lStatGap = 10;
  const lStatX = (leftW - lStatW * 2 - lStatGap) / 2;

  drawStatCard(
    ctx,
    lStatX,
    lStatY,
    lStatW,
    lStatH,
    formatDuration(stats.totalTimeMs),
    "LISTENED",
    accent,
    true,
  );
  drawStatCard(
    ctx,
    lStatX + lStatW + lStatGap,
    lStatY,
    lStatW,
    lStatH,
    `${stats.trackCount}`,
    "PLAYS",
    accent,
  );
  drawStatCard(
    ctx,
    lStatX,
    lStatY + lStatH + lStatGap,
    lStatW,
    lStatH,
    `${stats.uniqueArtistCount}`,
    "ARTISTS",
    accent,
  );
  drawStatCard(
    ctx,
    lStatX + lStatW + lStatGap,
    lStatY + lStatH + lStatGap,
    lStatW,
    lStatH,
    stats.streakDays > 0
      ? `${stats.streakDays}d`
      : `${Math.round(stats.skipRate * 100)}%`,
    stats.streakDays > 0 ? "STREAK" : "SKIP RATE",
    accent,
    stats.streakDays > 0,
  );

  // Genre pills at bottom of left panel
  if (stats.topGenres.length > 0) {
    drawGenrePills(
      ctx,
      stats.topGenres,
      lStatX,
      lStatY + (lStatH + lStatGap) * 2 + 8,
      leftW - lStatX * 2,
      accent,
    );
  }

  // ── Right Panel (420–1200) ──
  const rPad = 32;
  const rX = leftW + rPad;
  const rInnerW = w - rX - rPad;

  // Title + period
  const rTitle = username ? `${username}'s Stats` : "My Listening Stats";
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${22}px ${FONT}`;
  ctx.fillText(truncateText(ctx, rTitle, rInnerW - 120), rX, 32);

  const periodText = getPeriodDisplayName(period);
  ctx.font = `600 ${12}px ${FONT}`;
  const pTextW = ctx.measureText(periodText).width;
  const pPillW = pTextW + 16;
  ctx.fillStyle = rgb(accent, 0.2);
  fillRoundRect(ctx, rX, 42, pPillW, 22, 11);
  ctx.fillStyle = rgb(accent);
  ctx.fillText(periodText, rX + 8, 56);

  const providerLabel = getProviderLabel(providerType);
  if (providerLabel) {
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${11}px ${FONT}`;
    ctx.fillText(providerLabel, rX + pPillW + 8, 56);
  }

  // Layout: top tracks on left half, artists+chart on right half
  const rColW = (rInnerW - 20) / 2;
  const rCol1X = rX;
  const rCol2X = rX + rColW + 20;

  // ── Right Column 1: Top 5 Tracks ──
  let ry = 78;
  ctx.fillStyle = rgb(accent);
  ctx.beginPath();
  ctx.arc(rCol1X + 4, ry + 6, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${14}px ${FONT}`;
  ctx.fillText("Top Tracks", rCol1X + 14, ry + 11);
  ry += 22;

  const rArtSize = 34;
  const rRowH = 44;
  const rTrackCount = Math.min(5, stats.topTracks.length);

  for (let i = 0; i < rTrackCount; i++) {
    const t = stats.topTracks[i];
    const rowY = ry + i * rRowH;
    const artY2 = rowY + (rRowH - rArtSize) / 2;

    const drew = await drawArt(ctx, t.albumArt, rCol1X, artY2, rArtSize, 4);
    if (!drew) drawPlaceholderArt(ctx, rCol1X, artY2, rArtSize, 4);

    const textX = rCol1X + rArtSize + 8;
    const centerY = rowY + rRowH / 2;
    const maxTextW = rCol1X + rColW - textX - 4;

    ctx.fillStyle = rankColor(i);
    ctx.font = `bold ${11}px ${FONT}`;
    const rk = `${i + 1}`;
    ctx.fillText(rk, textX, centerY - 5);

    const rkW = ctx.measureText(rk).width + 5;
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${11}px ${FONT}`;
    ctx.fillText(
      truncateText(ctx, t.trackName, maxTextW - rkW),
      textX + rkW,
      centerY - 5,
    );

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `${9}px ${FONT}`;
    const meta = t.playCount
      ? `${t.artistName} \u2022 ${t.playCount}`
      : t.artistName;
    ctx.fillText(
      truncateText(ctx, meta, maxTextW - rkW),
      textX + rkW,
      centerY + 8,
    );
  }

  // Top 5 Albums below tracks
  const rAlbumStart = ry + rRowH * rTrackCount + 12;
  const rAlbumCount = Math.min(5, stats.topAlbums.length);
  if (rAlbumCount > 0) {
    let ay = rAlbumStart;
    ctx.fillStyle = rgb(accent);
    ctx.beginPath();
    ctx.arc(rCol1X + 4, ay + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${14}px ${FONT}`;
    ctx.fillText("Top Albums", rCol1X + 14, ay + 11);
    ay += 22;

    for (let i = 0; i < rAlbumCount; i++) {
      const a = stats.topAlbums[i];
      const rowY = ay + i * rRowH;
      const artY2 = rowY + (rRowH - rArtSize) / 2;

      const drew = await drawArt(ctx, a.albumArt, rCol1X, artY2, rArtSize, 4);
      if (!drew) drawPlaceholderArt(ctx, rCol1X, artY2, rArtSize, 4);

      const textX = rCol1X + rArtSize + 8;
      const centerY = rowY + rRowH / 2;
      const maxTextW = rCol1X + rColW - textX - 4;

      ctx.fillStyle = rankColor(i);
      ctx.font = `bold ${11}px ${FONT}`;
      const rk = `${i + 1}`;
      ctx.fillText(rk, textX, centerY - 5);

      const rkW = ctx.measureText(rk).width + 5;
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${11}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, a.albumName, maxTextW - rkW),
        textX + rkW,
        centerY - 5,
      );

      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = `${9}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, a.artistName, maxTextW - rkW),
        textX + rkW,
        centerY + 8,
      );
    }
  }

  // ── Right Column 2: Artists + Chart ──
  let ry2 = 78;
  ctx.fillStyle = rgb(accent);
  ctx.beginPath();
  ctx.arc(rCol2X + 4, ry2 + 6, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${14}px ${FONT}`;
  ctx.fillText("Top Artists", rCol2X + 14, ry2 + 11);
  ry2 += 22;

  const rArtistImgSize = 34;
  const rArtistCount = Math.min(5, stats.topArtists.length);

  for (let i = 0; i < rArtistCount; i++) {
    const a = stats.topArtists[i];
    const rowY = ry2 + i * rRowH;
    const imgY = rowY + (rRowH - rArtistImgSize) / 2;

    const drew = await drawArt(
      ctx,
      a.artistImage,
      rCol2X,
      imgY,
      rArtistImgSize,
      rArtistImgSize / 2,
    );
    if (!drew)
      drawPlaceholderArt(ctx, rCol2X, imgY, rArtistImgSize, rArtistImgSize / 2);

    const textX = rCol2X + rArtistImgSize + 8;
    const centerY = rowY + rRowH / 2;
    const maxTextW = rCol2X + rColW - textX - 4;

    ctx.fillStyle = rankColor(i);
    ctx.font = `bold ${11}px ${FONT}`;
    const rk = `${i + 1}`;
    ctx.fillText(rk, textX, centerY - 1);

    const rkW = ctx.measureText(rk).width + 5;
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${12}px ${FONT}`;
    ctx.fillText(
      truncateText(ctx, a.artistName, maxTextW - rkW),
      textX + rkW,
      centerY - 1,
    );

    if (a.playCount) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = `${9}px ${FONT}`;
      ctx.fillText(`${a.playCount} plays`, textX + rkW, centerY + 12);
    }
  }

  ry2 += rRowH * rArtistCount + 16;

  // Hourly chart in right column 2
  if (stats.hourlyDistribution.some((v) => v > 0)) {
    ctx.fillStyle = rgb(accent);
    ctx.beginPath();
    ctx.arc(rCol2X + 4, ry2 + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${14}px ${FONT}`;
    ctx.fillText("Activity", rCol2X + 14, ry2 + 11);

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `${11}px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(
      `Peak: ${formatHourLabel(stats.peakHour)}`,
      rCol2X + rColW,
      ry2 + 11,
    );
    ctx.textAlign = "left";

    ry2 += 22;
    const chartH = Math.min(h - ry2 - 30, 100);
    if (chartH > 30) {
      drawHourlyChart(
        ctx,
        stats.hourlyDistribution,
        rCol2X,
        ry2,
        rColW,
        chartH,
        accent,
        stats.peakHour,
      );
    }
  }

  // ── Noise texture ──
  drawNoiseTexture(ctx, 0, 0, w, h, 0.02);

  // Accent bar at top
  const topBar = ctx.createLinearGradient(0, 0, w, 0);
  topBar.addColorStop(0, rgb(accent));
  topBar.addColorStop(1, rgb(accent, 0.3));
  ctx.fillStyle = topBar;
  ctx.fillRect(0, 0, w, 3);

  // Watermark
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.font = `${11}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("Listening Stats for Spicetify", w / 2, h - 10);
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
