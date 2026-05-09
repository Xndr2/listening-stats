import { classifyLastfmError } from "../../shared/api/lastfm-client";
import { LS_KEYS } from "../../shared/constants/storage-keys";
import type { AppError } from "../../shared/errors";
import type { WorldScope, WorldTrack, WorldWindow } from "../world-charts-service";
import { getArtistChartsAsync, getChartsAsync } from "../world-charts-service";
import { InlineErrorCard } from "./InlineErrorCard";
import { WorldChartsSkeleton } from "./LoadingSkeleton";

const { useState, useEffect, useCallback } = Spicetify.React;

const SCOPES: { value: WorldScope; label: string }[] = [
	{ value: "world", label: "World" },
	{ value: "us", label: "US" },
	{ value: "gb", label: "UK" },
	{ value: "jp", label: "JP" },
];

const WINDOWS: { value: WorldWindow; label: string }[] = [
	{ value: "today", label: "Today" },
	{ value: "week", label: "Week" },
];

const VALID_SCOPES = new Set<string>(SCOPES.map((s) => s.value));
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

function restoreScope(): WorldScope {
	const stored = localStorage.getItem(LS_KEYS.WORLD_CHARTS_SCOPE);
	if (stored && VALID_SCOPES.has(stored)) return stored as WorldScope;
	return "world";
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

function searchInSpotify(query: string): void {
	Spicetify.Platform.History.push(`/search/${encodeURIComponent(query)}`);
}

interface WorldChartsPageProps {
	hasLastfmKey: boolean;
	onConnectLastfm?: () => void;
}

export function WorldChartsPage({ hasLastfmKey, onConnectLastfm }: WorldChartsPageProps) {
	const [scope, setScope] = useState<WorldScope>(restoreScope);
	const [timeWindow, setTimeWindow] = useState<WorldWindow>(restoreWindow);
	const [tracks, setTracks] = useState<WorldTrack[]>([]);
	const [artists, setArtists] = useState<WorldTrack[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<AppError | null>(null);

	const fetchCharts = useCallback(async (s: WorldScope, w: WorldWindow) => {
		setLoading(true);
		setError(null);

		const [trackResult, artistResult] = await Promise.all([
			getChartsAsync(s, w),
			getArtistChartsAsync(s, w),
		]);

		if (trackResult.ok) {
			setTracks(trackResult.data);
		} else {
			setError(classifyLastfmError(trackResult.status, trackResult.message));
			setTracks([]);
		}

		if (artistResult.ok) {
			setArtists(artistResult.data);
		} else {
			setArtists([]);
		}

		setLoading(false);
	}, []);

	useEffect(() => {
		fetchCharts(scope, timeWindow);
	}, [scope, timeWindow, fetchCharts]);

	const handleScopeChange = (value: WorldScope) => {
		setScope(value);
		localStorage.setItem(LS_KEYS.WORLD_CHARTS_SCOPE, value);
	};

	const handleWindowChange = (value: WorldWindow) => {
		setTimeWindow(value);
		localStorage.setItem(LS_KEYS.WORLD_CHARTS_WINDOW, value);
	};

	const handleRetry = () => {
		fetchCharts(scope, timeWindow);
	};

	if (!hasLastfmKey) {
		return (
			<div className="world-charts-page">
				<div className="world-charts-empty" role="status">
					<h2 className="world-charts-empty-title">Connect Last.fm</h2>
					<p className="world-charts-empty-body">
						Add a Last.fm API key to see what the world is playing.
					</p>
					{onConnectLastfm && (
						<button type="button" className="btn-primary" onClick={onConnectLastfm}>
							Connect Last.fm
						</button>
					)}
				</div>
			</div>
		);
	}

	const renderChartItem = (item: WorldTrack, index: number, isArtist: boolean) => {
		const rank = index + 1;
		const rankCls = getRankClass(rank);
		const delta = getDeltaDisplay(item.delta);
		const query = isArtist ? item.title : `${item.title} ${item.artist}`;

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
					style={{ background: tileGradient(item.id) }}
				/>
				<div className="world-chart-info">
					<div className="world-chart-title">{item.title}</div>
					<div className="world-chart-artist">
						{isArtist ? `${item.plays} listeners` : item.artist}
					</div>
				</div>
				<div className="world-chart-stats">
					{!isArtist && <div className="world-chart-plays">{item.plays}</div>}
					<div className="world-chart-delta" data-direction={delta.direction}>
						{delta.indicator}
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="world-charts-page">
			<div className="world-charts-header">
				<div>
					<div className="section-kicker">World Charts</div>
					<h2 className="section-title">What the world is playing</h2>
				</div>
				<div className="world-charts-tabs">
					<div
						className="world-charts-tab-group"
						data-tabs="scope"
						role="tablist"
						aria-label="Region"
					>
						{SCOPES.map((s) => (
							<button
								type="button"
								key={s.value}
								className={`world-charts-tab${scope === s.value ? " active" : ""}`}
								role="tab"
								aria-selected={scope === s.value}
								onClick={() => handleScopeChange(s.value)}
							>
								{s.label}
							</button>
						))}
					</div>
					<div
						className="world-charts-tab-group"
						data-tabs="window"
						role="tablist"
						aria-label="Time window"
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

			{loading && <WorldChartsSkeleton />}

			{!loading && error && (
				<InlineErrorCard
					error={error}
					onRetry={handleRetry}
					onOpenSettings={onConnectLastfm ?? (() => {})}
				/>
			)}

			{!loading && !error && (
				<>
					<div className="world-charts-section" data-section="tracks">
						<header className="section-heading">
							<span className="section-kicker">Trending</span>
							<h3 className="section-title">Top Tracks</h3>
						</header>
						<div className="world-charts-grid">
							{tracks.slice(0, 8).map((t, i) => renderChartItem(t, i, false))}
						</div>
					</div>

					<div className="world-charts-section" data-section="artists">
						<header className="section-heading">
							<span className="section-kicker">Popular</span>
							<h3 className="section-title">Top Artists</h3>
						</header>
						<div className="world-charts-grid">
							{artists.slice(0, 8).map((a, i) => renderChartItem(a, i, true))}
						</div>
					</div>

					<div className="world-charts-source">Source: Last.fm</div>
				</>
			)}
		</div>
	);
}
