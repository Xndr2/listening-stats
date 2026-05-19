import type { WorldChartKind, WorldIndicator, WorldTrack, WorldWindow } from "../../../shared/types/world-charts";
import { formatDuration } from "../../world-charts-service";
import { navigateWorldItem, playOrOpenWorldTrack, trackPlayTooltip } from "../../world-spotify-actions";
import { getRankClass } from "../TopLists";

const { useMemo } = Spicetify.React;

export const WORLD_WINDOWS: { value: WorldWindow; label: string }[] = [
	{ value: "today", label: "Today" },
	{ value: "week", label: "This Week" },
];

const HERO_CELL_STYLE: Record<string, string | number> = {
	background:
		"radial-gradient(120% 140% at 0% 0%, rgba(var(--spice-rgb-button),.16), transparent 52%), var(--spice-card)",
	border: "1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.12)",
	borderRadius: 8,
	padding: 20,
	minHeight: 184,
	position: "relative",
	overflow: "hidden",
	boxSizing: "border-box",
};

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

export function Indicator({ value }: { value: WorldIndicator | null | undefined }) {
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

export function WorldArt({
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
					borderRadius: round ? "50%" : 4,
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
				borderRadius: round ? "50%" : 4,
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

export function TrackPlayButton({ item, size = 28 }: { item: WorldTrack; size?: number }) {
	const tooltip = trackPlayTooltip(item);

	const onClick = (e: { stopPropagation: () => void }) => {
		e.stopPropagation();
		playOrOpenWorldTrack(item);
	};

	return (
		<Spicetify.ReactComponent.TooltipWrapper label={tooltip} placement="top">
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
		</Spicetify.ReactComponent.TooltipWrapper>
	);
}

export type ChartKind = WorldChartKind;

export function describeItem(item: WorldTrack, kind: WorldChartKind) {
	if (kind === "track") {
		return { title: item.title, sub: item.artist, art: item.artUrl };
	}
	if (kind === "artist") {
		return {
			title: item.title,
			sub: `${item.plays} streams`,
			art: item.artUrl,
			genres: item.genres,
		};
	}
	const year = item.albumYear ? ` · ${item.albumYear}` : "";
	return { title: item.title, sub: `${item.artist}${year}`, art: item.artUrl };
}

function asideCardMeta(item: WorldTrack, kind: WorldChartKind) {
	const art = describeItem(item, kind).art;
	if (kind === "track") {
		return { title: item.title, sub: item.artist, stat: item.plays, art };
	}
	if (kind === "artist") {
		const genres = item.genres?.slice(0, 2).join(" · ");
		return { title: item.title, sub: genres || "Artist", stat: item.plays, art };
	}
	const year = item.albumYear ? ` · ${item.albumYear}` : "";
	return { title: item.title, sub: item.artist ? `${item.artist}${year}` : "", stat: item.plays, art };
}

function HeroAsideCard({ label, item, kind }: { label: string; item: WorldTrack; kind: WorldChartKind }) {
	const meta = asideCardMeta(item, kind);
	return (
		<button type="button" className="world-aside-card" onClick={() => navigateWorldItem(item, kind)}>
			<span className="world-aside-card-label">{label}</span>
			<div className="world-aside-card-row">
				<WorldArt
					src={meta.art}
					alt={meta.title}
					size={44}
					round={kind === "artist"}
					fallbackSeed={meta.title + meta.sub}
					fallbackLabel={meta.title}
				/>
				<div className="world-aside-card-text">
					<div className="world-aside-card-title">{meta.title}</div>
					{meta.sub ? <div className="world-aside-card-sub">{meta.sub}</div> : null}
					<div className="world-aside-card-stat">{meta.stat}</div>
				</div>
			</div>
			{item.indicator ? (
				<div className="world-aside-card-foot">
					<Indicator value={item.indicator} />
				</div>
			) : null}
		</button>
	);
}

export function WorldHeroSection({
	item,
	winLabel,
	runnersUp,
	topArtist,
	topAlbum,
}: {
	item: WorldTrack;
	winLabel: string;
	runnersUp: WorldTrack[];
	topArtist?: WorldTrack;
	topAlbum?: WorldTrack;
}) {
	const windowLabel = winLabel.replace(/^This /, "this ");
	const showAside = runnersUp.length > 0 || topArtist != null || topAlbum != null;

	return (
		<>
			<div
				className={`overview-hero-cell world-hero-main world-hero-section${showAside ? "" : " world-hero-section--solo"}`}
				style={HERO_CELL_STYLE}
			>
				<div className="world-hero-main-inner">
					<button
						type="button"
						className="world-hero-art-btn"
						onClick={() => navigateWorldItem(item, "track")}
						aria-label={`Open ${item.title}`}
					>
						<WorldArt
							src={item.artUrl}
							alt={item.title}
							size={148}
							fallbackSeed={item.title + item.artist}
							fallbackLabel={item.title}
						/>
					</button>
					<div className="world-hero-copy">
						<div className="section-kicker">#1 · {windowLabel}</div>
						<h2 className="section-title world-hero-title" data-testid="world-hero-title">
							{item.title}
						</h2>
						<p className="world-hero-artist">{item.artist}</p>
						<div className="world-hero-stats">
							<div className="overview-card">
								<div className="overview-card-label">Streams</div>
								<div className="overview-card-value" style={{ color: "var(--spice-button)" }}>
									{item.plays}
								</div>
							</div>
							{item.indicator ? (
								<div className="overview-card">
									<div className="overview-card-label">Movement</div>
									<div className="overview-card-value">
										<Indicator value={item.indicator} />
									</div>
								</div>
							) : null}
							{item.durationMs ? (
								<div className="overview-card">
									<div className="overview-card-label">Duration</div>
									<div className="overview-card-value">{formatDuration(item.durationMs)}</div>
								</div>
							) : null}
						</div>
						<Spicetify.ReactComponent.TooltipWrapper label={trackPlayTooltip(item)} placement="top">
							<button
								type="button"
								className="btn-primary world-hero-play"
								data-testid="world-hero-play"
								aria-label={trackPlayTooltip(item)}
								onClick={() => playOrOpenWorldTrack(item)}
							>
								Play
							</button>
						</Spicetify.ReactComponent.TooltipWrapper>
					</div>
				</div>
			</div>

			{showAside ? (
				<div className="world-hero-aside">
					{runnersUp[0] ? <HeroAsideCard label="#2 Track" item={runnersUp[0]} kind="track" /> : null}
					{runnersUp[1] ? <HeroAsideCard label="#3 Track" item={runnersUp[1]} kind="track" /> : null}
					{topArtist ? <HeroAsideCard label="Top artist" item={topArtist} kind="artist" /> : null}
					{topAlbum ? <HeroAsideCard label="Top album" item={topAlbum} kind="album" /> : null}
				</div>
			) : null}
		</>
	);
}

export function ChartListRow({ rank, item, kind }: { rank: number; item: WorldTrack; kind: ChartKind }) {
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
			<div style={{ flex: 1, minWidth: 0 }}>
				<div className="world-chart-row-title">{meta.title}</div>
				<div className="world-chart-row-sub">
					{kind === "artist" && meta.genres?.length ? (
						<span className="world-genrechips">
							{meta.genres.map((g) => (
								<span key={g} className="world-genrechip">
									{g}
								</span>
							))}
						</span>
					) : (
						meta.sub
					)}
				</div>
			</div>
			{kind === "track" ? <TrackPlayButton item={item} size={28} /> : null}
			<div className="world-chart-row-stats">
				<span>{item.plays}</span>
				<Indicator value={item.indicator} />
			</div>
		</div>
	);
}

export function ChartCard({
	kicker,
	title,
	podium,
	rows,
	kind,
}: {
	kicker: string;
	title: string;
	podium: WorldTrack[];
	rows: WorldTrack[];
	kind: ChartKind;
}) {
	const all = [...podium, ...rows];
	return (
		<section
			className="section-card"
			data-section={kind === "track" ? "tracks" : kind === "artist" ? "artists" : "albums"}
		>
			<header className="section-heading">
				<span className="section-kicker">{kicker}</span>
				<h2 className="section-title">{title}</h2>
			</header>
			{all.map((it, i) => (
				<ChartListRow key={it.id} rank={i + 1} item={it} kind={kind} />
			))}
		</section>
	);
}

export function HeroSkeleton() {
	return (
		<>
			<div className="overview-hero-cell world-hero-main" style={{ ...HERO_CELL_STYLE, minHeight: 184 }} aria-hidden />
			<div className="world-hero-aside" aria-hidden>
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={i} className="world-aside-card" style={{ minHeight: 88 }} />
				))}
			</div>
		</>
	);
}
