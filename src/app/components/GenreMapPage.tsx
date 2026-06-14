import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAllMappedGenres, type MappedGenre, mapUserGenres } from "../../shared/genre-map/genre-map-service";
import type { StatsResult } from "../../shared/types/stats";

const PAD = 70;
const RADIUS_BG = 2;
const RADIUS_USER = 5;
const FONT_SIZE = 11;

const ALL_DATA = getAllMappedGenres();
const ALL_POINTS = Object.entries(ALL_DATA);

let minX = Infinity,
	maxX = -Infinity,
	minY = Infinity,
	maxY = -Infinity;
for (const [, pt] of ALL_POINTS) {
	if (pt.x < minX) minX = pt.x;
	if (pt.x > maxX) maxX = pt.x;
	if (pt.y < minY) minY = pt.y;
	if (pt.y > maxY) maxY = pt.y;
}
const RANGE_X = maxX - minX || 1;
const RANGE_Y = maxY - minY || 1;

function toCanvasX(v: number, w: number): number {
	return PAD + ((v - minX) / RANGE_X) * (w - PAD * 2);
}
function toCanvasY(v: number, h: number): number {
	return PAD + ((v - minY) / RANGE_Y) * (h - PAD * 2);
}

interface GenreMapPageProps {
	stats: StatsResult | null;
	loading?: boolean;
}

export function GenreMapPage({ stats, loading }: GenreMapPageProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const userGenres = useMemo<MappedGenre[]>(() => (stats ? mapUserGenres(stats.topGenres) : []), [stats]);

	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const parent = containerRef.current;
		if (!parent) return;

		const rect = parent.getBoundingClientRect();
		const w = Math.round(rect.width);
		const h = 1400;

		if (canvas.width !== w * devicePixelRatio || canvas.height !== h * devicePixelRatio) {
			canvas.width = w * devicePixelRatio;
			canvas.height = h * devicePixelRatio;
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
		}

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

		const cardBg = getComputedStyle(document.documentElement).getPropertyValue("--spice-card").trim() || "#1a1a1a";
		ctx.fillStyle = cardBg;
		ctx.fillRect(0, 0, w, h);

		for (const [, pt] of ALL_POINTS) {
			const sx = toCanvasX(pt.x, w);
			const sy = toCanvasY(pt.y, h);
			if (sx < PAD || sx > w - PAD || sy < PAD || sy > h - PAD) continue;

			ctx.beginPath();
			ctx.arc(sx, sy, RADIUS_BG, 0, Math.PI * 2);
			ctx.fillStyle = pt.c;
			ctx.globalAlpha = 0.35;
			ctx.fill();
		}
		ctx.globalAlpha = 1;

		for (const ug of userGenres) {
			const sx = toCanvasX(ug.x, w);
			const sy = toCanvasY(ug.y, h);

			ctx.beginPath();
			ctx.arc(sx, sy, RADIUS_USER + 3, 0, Math.PI * 2);
			ctx.fillStyle = ug.c;
			ctx.globalAlpha = 0.25;
			ctx.fill();
			ctx.globalAlpha = 1;

			ctx.beginPath();
			ctx.arc(sx, sy, RADIUS_USER, 0, Math.PI * 2);
			ctx.fillStyle = ug.c;
			ctx.fill();

			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 1.5;
			ctx.stroke();

			ctx.fillStyle = "#fff";
			ctx.font = `600 ${FONT_SIZE}px sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "bottom";
			ctx.fillText(ug.genre, sx, sy - RADIUS_USER - 4);
		}

		ctx.fillStyle = "rgba(255,255,255,0.4)";
		ctx.font = "11px sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "top";
		ctx.fillText("denser/heavier ← → lighter/bouncier", w / 2, h - PAD + 16);

		ctx.save();
		ctx.translate(14, h / 2);
		ctx.rotate(-Math.PI / 2);
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("more organic ← → more mechanical", 0, 0);
		ctx.restore();
	}, [userGenres]);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const rect = canvas.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const my = e.clientY - rect.top;
			const w = rect.width;
			const h = 1400;

			for (const ug of userGenres) {
				const sx = toCanvasX(ug.x, w);
				const sy = toCanvasY(ug.y, h);
				const dx = mx - sx;
				const dy = my - sy;
				if (dx * dx + dy * dy < (RADIUS_USER + 8) ** 2) {
					setTooltip({ text: `${ug.genre} · ${ug.count} plays`, x: mx + 12, y: my });
					return;
				}
			}

			for (const [genre, pt] of ALL_POINTS) {
				const sx = toCanvasX(pt.x, w);
				const sy = toCanvasY(pt.y, h);
				const dx = mx - sx;
				const dy = my - sy;
				if (dx * dx + dy * dy < (RADIUS_BG + 4) ** 2) {
					setTooltip({ text: genre, x: mx + 12, y: my });
					return;
				}
			}

			setTooltip(null);
		},
		[userGenres],
	);

	const handleMouseLeave = useCallback(() => setTooltip(null), []);

	useEffect(() => {
		draw();
	}, [draw]);

	if (loading) {
		return (
			<div className="genre-map-page stats-page-content">
				<header className="section-heading">
					<div>
						<span className="section-kicker">Every Noise at Once</span>
						<h2 className="section-title">Genre Map</h2>
					</div>
				</header>
				<div className="genre-map-canvas-wrap" ref={containerRef} style={{ minHeight: 600 }}>
					<div className="loading-skeleton genre-map-skeleton" />
				</div>
			</div>
		);
	}

	return (
		<div className="genre-map-page stats-page-content">
			<header className="section-heading">
				<div>
					<span className="section-kicker">Every Noise at Once</span>
					<h2 className="section-title">Genre Map</h2>
				</div>
				{userGenres.length > 0 && <span className="genre-map-count">{userGenres.length} genres mapped</span>}
			</header>
			<div className="genre-map-canvas-wrap" ref={containerRef}>
				<canvas
					ref={canvasRef}
					onMouseMove={handleMouseMove}
					onMouseLeave={handleMouseLeave}
					style={{ cursor: "crosshair" }}
				/>
				{tooltip && (
					<div className="genre-map-tooltip" style={{ left: tooltip.x, top: tooltip.y - 10 }}>
						{tooltip.text}
					</div>
				)}
			</div>
		</div>
	);
}
