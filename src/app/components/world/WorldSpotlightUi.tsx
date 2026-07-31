import type { WorldChartKind, WorldIndicator, WorldTrack, WorldWindow } from "../../../shared/types/world-charts";
import { navigateWorldItem, playOrOpenWorldTrack, trackPlayTooltip } from "../../world-spotify-actions";
import { Tooltip } from "../spicetify-ui";
import { getRankClass } from "../TopLists";

const { useMemo } = Spicetify.React;

export const WORLD_WINDOWS: { value: WorldWindow; label: string }[] = [
	{ value: "today", label: "Today" },
	{ value: "week", label: "This Week" },
];

export const WORLD_KINDS: { value: WorldChartKind; label: string }[] = [
	{ value: "track", label: "Tracks" },
	{ value: "artist", label: "Artists" },
	{ value: "album", label: "Albums" },
];

function tileFallback(seed: string, label: string): { a: string; b: string; init: string } {
	let h = 0;
	for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
	return {
		a: `oklch(0.70 0.14 ${h % 360})`,
		b: `oklch(0.40 0.10 ${(h + 60) % 360})`,
		init: label
			.replace(/[^A-Za-z0-9]/g, "")
			.slice(0, 2)
			.toUpperCase(),
	};
}

function Indicator({ value }: { value: WorldIndicator | null | undefined }) {
	if (!value) return null;
	const dir = value === "UP" ? "up" : value === "DOWN" ? "down" : "new";
	return (
		<span
			className="world-chart-indicator"
			data-dir={dir}
			aria-label={value === "NEW" ? "New entry" : value === "UP" ? "Up" : "Down"}
		>
			<span className="world-chart-indicator-glyph">{value === "NEW" ? "●" : value === "UP" ? "▲" : "▼"}</span>
			{value === "NEW" ? <span>NEW</span> : null}
		</span>
	);
}

function WorldArt({
	src,
	alt,
	size = 44,
	round,
	fallbackSeed,
	fallbackLabel,
}: {
	src?: string;
	alt: string;
	size?: number;
	round?: boolean;
	fallbackSeed: string;
	fallbackLabel: string;
}) {
	const fallback = useMemo(
		() => (src ? null : tileFallback(fallbackSeed, fallbackLabel)),
		[src, fallbackSeed, fallbackLabel],
	);
	if (src) {
		return (
			<img
				src={src}
				alt={alt}
				className="track-art"
				loading="lazy"
				style={{
					width: size,
					height: size,
					borderRadius: round ? "50%" : Math.max(4, Math.round(size / 18)),
					flexShrink: 0,
				}}
			/>
		);
	}
	return (
		<div
			className="track-art track-art--fallback"
			style={{
				width: size,
				height: size,
				borderRadius: round ? "50%" : Math.max(4, Math.round(size / 18)),
				flexShrink: 0,
				background: fallback ? `linear-gradient(135deg, ${fallback.a}, ${fallback.b})` : undefined,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontWeight: 800,
				fontSize: Math.max(11, size * 0.28),
				color: "rgba(255,255,255,0.92)",
			}}
			aria-hidden
		>
			{fallback?.init}
		</div>
	);
}

export function WorldWindowTabs({ value, onChange }: { value: WorldWindow; onChange: (v: WorldWindow) => void }) {
	return (
		<div className="period-tabs" role="tablist" aria-label="Time range" data-testid="world-window-tabs">
			{WORLD_WINDOWS.map((w) => (
				<button
					type="button"
					key={w.value}
					className={`period-tab ${value === w.value ? "active" : ""}`}
					role="tab"
					aria-selected={value === w.value}
					onClick={() => onChange(w.value)}
				>
					{w.label}
				</button>
			))}
		</div>
	);
}

export function WorldKindTabs({ value, onChange }: { value: WorldChartKind; onChange: (v: WorldChartKind) => void }) {
	return (
		<div className="period-tabs" role="tablist" aria-label="Chart type" data-testid="world-kind-tabs">
			{WORLD_KINDS.map((k) => (
				<button
					type="button"
					key={k.value}
					className={`period-tab ${value === k.value ? "active" : ""}`}
					role="tab"
					aria-selected={value === k.value}
					onClick={() => onChange(k.value)}
				>
					{k.label}
				</button>
			))}
		</div>
	);
}

function TrackPlayButton({ item, size = 28 }: { item: WorldTrack; size?: number }) {
	const tooltip = trackPlayTooltip(item);

	const onClick = (e: { stopPropagation: () => void }) => {
		e.stopPropagation();
		playOrOpenWorldTrack(item);
	};

	return (
		<Tooltip label={tooltip} placement="top">
			<button
				type="button"
				className="world-chart-playbtn"
				style={{ width: size, height: size }}
				aria-label={tooltip}
				onClick={onClick}
			>
				<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true" role="presentation">
					<path d="M2.5 1.5L8 5L2.5 8.5Z" />
				</svg>
			</button>
		</Tooltip>
	);
}

function describeItem(item: WorldTrack, kind: WorldChartKind) {
	if (kind === "track") {
		return { title: item.title, sub: item.artist, art: item.artUrl };
	}
	if (kind === "artist") {
		return {
			title: item.title,
			sub: item.genres?.length ? item.genres.slice(0, 2).join(" · ") : "Artist",
			art: item.artUrl,
		};
	}
	const year = item.albumYear ? ` · ${item.albumYear}` : "";
	return { title: item.title, sub: `${item.artist}${year}`, art: item.artUrl };
}

// ── Podium: ranks 1–3 as an art-forward band (2 · 1 · 3) ────────────────────

function PodiumCell({ item, rank, kind }: { item: WorldTrack; rank: number; kind: WorldChartKind }) {
	const meta = describeItem(item, kind);
	const artSize = rank === 1 ? 152 : 112;
	return (
		<div className="world-podium-cell" data-rank={rank}>
			<div className="world-podium-artwrap">
				<button
					type="button"
					className="world-podium-art-btn"
					onClick={() => navigateWorldItem(item, kind)}
					aria-label={`Open ${meta.title}`}
				>
					<WorldArt
						src={meta.art}
						alt={meta.title}
						size={artSize}
						round={kind === "artist"}
						fallbackSeed={meta.title + meta.sub}
						fallbackLabel={meta.title}
					/>
				</button>
				{kind === "track" ? (
					<span className="world-podium-play">
						<TrackPlayButton item={item} size={30} />
					</span>
				) : null}
			</div>
			<div className={`world-podium-rank rank-number ${getRankClass(rank)}`}>{rank}</div>
			<div className="world-podium-title" data-testid={rank === 1 ? "world-podium-title" : undefined}>
				{meta.title}
			</div>
			<div className="world-podium-sub">{meta.sub}</div>
			<div className="world-podium-stat">
				<span>{item.plays}</span>
				<Indicator value={item.indicator} />
			</div>
		</div>
	);
}

export function WorldPodium({ items, kind }: { items: WorldTrack[]; kind: WorldChartKind }) {
	if (items.length === 0) return null;
	// Classic podium order: 2 · 1 · 3. With fewer items, #1 stays centered.
	const cells: Array<{ item: WorldTrack; rank: number } | null> = [
		items[1] ? { item: items[1], rank: 2 } : null,
		{ item: items[0], rank: 1 },
		items[2] ? { item: items[2], rank: 3 } : null,
	];
	return (
		<div className="world-podium" data-testid="world-podium">
			{cells.map((c, i) =>
				c ? <PodiumCell key={c.item.id} item={c.item} rank={c.rank} kind={kind} /> : <div key={`empty-${i}`} />,
			)}
		</div>
	);
}

// ── Ladder: ranks 4–15 in dashboard top-list rows, 6/6 columns ───────────────

function LadderRow({ item, rank, kind }: { item: WorldTrack; rank: number; kind: WorldChartKind }) {
	const meta = describeItem(item, kind);
	return (
		<div
			className="top-list-row"
			role="button"
			tabIndex={0}
			onClick={() => navigateWorldItem(item, kind)}
			onKeyDown={(e: { key: string }) => {
				if (e.key === "Enter" || e.key === " ") navigateWorldItem(item, kind);
			}}
		>
			<span className={`rank-number ${getRankClass(rank)}`}>{rank}</span>
			<WorldArt
				src={meta.art}
				alt={meta.title}
				size={44}
				round={kind === "artist"}
				fallbackSeed={meta.title + meta.sub}
				fallbackLabel={meta.title}
			/>
			<div className="world-chart-text">
				<div className="world-chart-title">{meta.title}</div>
				<div className="world-chart-sub">{meta.sub}</div>
			</div>
			{kind === "track" ? <TrackPlayButton item={item} size={24} /> : null}
			<div className="world-chart-stats">
				<span>{item.plays}</span>
				<Indicator value={item.indicator} />
			</div>
		</div>
	);
}

export function WorldLadder({
	items,
	kind,
	startRank,
}: {
	items: WorldTrack[];
	kind: WorldChartKind;
	startRank: number;
}) {
	if (items.length === 0) return null;
	return (
		<div className="world-ladder" data-testid="world-ladder">
			{items.map((it, i) => (
				<LadderRow key={it.id} item={it} rank={startRank + i} kind={kind} />
			))}
		</div>
	);
}

// ── Skeleton: two cards, mirroring the loaded layout ─────────────────────────

export function WorldStageSkeleton() {
	return (
		<div className="world-stage-skeleton stats-page-content" aria-hidden>
			<section className="section-card world-podium-card">
				<div className="world-podium">
					{[112, 152, 112].map((sz, i) => (
						<div key={i} className="world-podium-cell">
							<div className="skeleton-shimmer" style={{ width: sz, height: sz, borderRadius: 8 }} />
							<div
								className="skeleton-shimmer"
								style={{ width: sz * 0.8, height: 12, borderRadius: 4, marginTop: 10 }}
							/>
						</div>
					))}
				</div>
			</section>
			<section className="section-card">
				<div className="world-ladder">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="top-list-row" style={{ pointerEvents: "none" }}>
							<span className="rank-number" style={{ color: "transparent" }}>
								0
							</span>
							<div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: 4, flexShrink: 0 }} />
							<div className="world-chart-text">
								<div className="skeleton-shimmer" style={{ width: "60%", height: 11, borderRadius: 4 }} />
								<div className="skeleton-shimmer" style={{ width: "40%", height: 9, borderRadius: 4, marginTop: 6 }} />
							</div>
						</div>
					))}
				</div>
			</section>
		</div>
	);
}
