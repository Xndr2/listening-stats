import { LS_KEYS } from "../../shared/constants/storage-keys";
import type { AppError } from "../../shared/errors";
import { classifyStatsFmError } from "../../shared/errors";
import type { WorldChartDataSource, WorldTrack, WorldWindow } from "../world-charts-service";
import { getArtistChartsAsync, getChartsAsync } from "../world-charts-service";
import { InlineErrorCard } from "./InlineErrorCard";
import { WorldChartsSkeleton } from "./LoadingSkeleton";

const { useState, useEffect, useCallback } = Spicetify.React;

const WINDOWS: { value: WorldWindow; label: string }[] = [
	{ value: "today", label: "Today" },
	{ value: "week", label: "This week" },
	{ value: "month", label: "This month" },
	{ value: "lifetime", label: "All-time" },
];

const VALID_WINDOWS = new Set<string>(WINDOWS.map((w) => w.value));

const TILE_COLORS: [string, string][] = [
	["#3a1f10", "#c44e1d"],
	["#1f2d3a", "#5b8fb9"],
	["#2a1a3a", "#8b5cf6"],
	["#3a2a1a", "#e0a458"],
	["#1a3a2e", "#5dbf99"],
	["#3a1a2a", "#d36ba6"],
	["#102a3a", "#3d8fd1"],
	["#2a3a1a", "#a3c46d"],
];

function tileGradient(seed: string): string {
	const i = seed.charCodeAt(seed.length - 1) % TILE_COLORS.length;
	const [a, b] = TILE_COLORS[i];
	return `linear-gradient(135deg, ${a}, ${b})`;
}

function restoreWindow(): WorldWindow {
	const stored = localStorage.getItem(LS_KEYS.WORLD_CHARTS_WINDOW);
	if (stored && VALID_WINDOWS.has(stored)) return stored as WorldWindow;
	return "today";
}

function getRankClass(rank: number): string {
	if (rank === 1) return "rank-gold";
	if (rank === 2) return "rank-silver";
	if (rank === 3) return "rank-bronze";
	return "";
}

function getDeltaDisplay(delta: number): { direction: string; indicator: string } {
	if (delta > 0) return { direction: "up", indicator: `▲ ${delta}` };
	if (delta < 0) return { direction: "down", indicator: `▼ ${Math.abs(delta)}` };
	return { direction: "neutral", indicator: "-" };
}

function buildSourceLine(
	trackSource: WorldChartDataSource,
	artistSource: WorldChartDataSource,
): string {
	if (trackSource === "statsfm" && artistSource === "statsfm") return "Global charts · stats.fm";
	const bits: string[] = [];
	bits.push(
		trackSource === "statsfm"
			? "Tracks · stats.fm"
			: trackSource === "mytopspotify"
				? "Tracks · mytopspotify.io (daily)"
				: "Tracks · demo",
	);
	bits.push(
		artistSource === "statsfm"
			? "Artists · stats.fm"
			: artistSource === "mytopspotify"
				? "Artists · mytopspotify.io (daily)"
				: "Artists · demo",
	);
	return bits.join(" · ");
}

function searchInSpotify(query: string): void {
	Spicetify.Platform.History.push(`/search/${encodeURIComponent(query)}`);
}

export function WorldChartsPage() {
	const [timeWindow, setTimeWindow] = useState<WorldWindow>(restoreWindow);
	const [tracks, setTracks] = useState<WorldTrack[]>([]);
	const [artists, setArtists] = useState<WorldTrack[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<AppError | null>(null);
	const [sourceLine, setSourceLine] = useState("Global charts · stats.fm");

	const fetchCharts = useCallback(async (w: WorldWindow) => {
		setLoading(true);
		setError(null);

		const [trackResult, artistResult] = await Promise.all([
			getChartsAsync("world", w),
			getArtistChartsAsync("world", w),
		]);

		let trackSource: WorldChartDataSource = "mock";
		let artistSource: WorldChartDataSource = "mock";

		if (trackResult.ok) {
			setTracks(trackResult.data);
			trackSource = trackResult.source ?? "statsfm";
		} else {
			setError(classifyStatsFmError(trackResult.status, trackResult.message));
			setTracks([]);
		}

		if (artistResult.ok) {
			setArtists(artistResult.data);
			artistSource = artistResult.source ?? "statsfm";
		} else {
			setArtists([]);
		}

		setSourceLine(buildSourceLine(trackSource, artistSource));

		setLoading(false);
	}, []);

	useEffect(() => {
		fetchCharts(timeWindow);
	}, [timeWindow, fetchCharts]);

	const handleWindowChange = (value: WorldWindow) => {
		setTimeWindow(value);
		localStorage.setItem(LS_KEYS.WORLD_CHARTS_WINDOW, value);
	};

	const handleRetry = () => {
		fetchCharts(timeWindow);
	};

	const renderChartItem = (item: WorldTrack, index: number, isArtist: boolean) => {
		const rank = index + 1;
		const rankCls = getRankClass(rank);
		const deltaNum = item.delta;
		const delta =
			deltaNum != null ? getDeltaDisplay(deltaNum) : { direction: "neutral", indicator: "" };
		const query = isArtist ? item.title : `${item.title} ${item.artist}`;

		const bgStyle = item.artUrl
			? {
					backgroundImage: `url(${item.artUrl})`,
					backgroundSize: "cover",
					backgroundPosition: "center",
				}
			: { background: tileGradient(item.id) };

		return (
			<div
				key={item.id}
				className="world-chart-item"
				role="button"
				tabIndex={0}
				onClick={() => searchInSpotify(query)}
				onKeyDown={(e: { key: string }) => {
					if (e.key === "Enter" || e.key === " ") searchInSpotify(query);
				}}
			>
				<span className={`rank-number ${rankCls}`}>{rank}</span>
				<div
					className={`world-chart-tile${isArtist ? " world-chart-tile--round" : ""}`}
					style={bgStyle}
				/>
				<div className="world-chart-info">
					<div className="world-chart-title">{item.title}</div>
					<div className="world-chart-artist">{isArtist ? item.plays : item.artist}</div>
				</div>
				<div className="world-chart-stats">
					{!isArtist && item.plays?.trim() ? (
						<div className="world-chart-plays">{item.plays}</div>
					) : null}
					{deltaNum != null && delta.indicator ? (
						<div className="world-chart-delta" data-direction={delta.direction}>
							{delta.indicator}
						</div>
					) : null}
				</div>
			</div>
		);
	};

	return (
		<div className="world-charts-page">
			<div className="world-charts-hero">
				<div className="world-charts-header">
					<div>
						<div className="section-kicker">World Charts</div>
						<h2 className="section-title">What the world is playing</h2>
					</div>
					<div className="world-charts-tabs">
						<div
							className="world-charts-tab-group"
							data-tabs="window"
							role="tablist"
							aria-label="Time range"
						>
							{WINDOWS.map((w) => (
								<button
									type="button"
									key={w.value}
									className={`world-charts-tab${timeWindow === w.value ? " active" : ""}`}
									role="tab"
									aria-selected={timeWindow === w.value}
									onClick={() => handleWindowChange(w.value)}
								>
									{w.label}
								</button>
							))}
						</div>
					</div>
				</div>
			</div>

			<div className="world-page-notice" role="status">
				World charts are new and updated often; what you see here may change as sources and layout
				improve.
			</div>

			{loading && <WorldChartsSkeleton />}

			{!loading && error && (
				<InlineErrorCard error={error} onRetry={handleRetry} onOpenSettings={() => {}} />
			)}

			{!loading && !error && (
				<>
					<div className="world-charts-layout">
						<section className="section-card world-charts-section" data-section="tracks">
							<header className="section-heading">
								<span className="section-kicker">Trending</span>
								<h3 className="section-title">Top Tracks</h3>
							</header>
							<div className="world-charts-grid">
								{tracks.slice(0, 8).map((t, i) => renderChartItem(t, i, false))}
							</div>
						</section>

						<section className="section-card world-charts-section" data-section="artists">
							<header className="section-heading">
								<span className="section-kicker">Popular</span>
								<h3 className="section-title">Top Artists</h3>
							</header>
							<div className="world-charts-grid">
								{artists.slice(0, 8).map((a, i) => renderChartItem(a, i, true))}
							</div>
						</section>
					</div>

					<div className="world-charts-source">{sourceLine}</div>
				</>
			)}
		</div>
	);
}
