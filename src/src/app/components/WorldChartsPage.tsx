import { LS_KEYS } from "../../shared/constants/storage-keys";
import type { AppError } from "../../shared/errors";
import { classifyStatsFmError } from "../../shared/errors";
import type { WorldChartKind } from "../../shared/types/world-charts";
import type { WorldChartDataSource, WorldTrack, WorldWindow } from "../world-charts-service";
import {
	getAlbumChartsAsync,
	getArtistChartsAsync,
	getChartsAsync,
	isStatsFmWindowSupported,
} from "../world-charts-service";
import { InlineErrorCard } from "./InlineErrorCard";
import {
	WORLD_KINDS,
	WORLD_WINDOWS,
	WorldKindTabs,
	WorldLadder,
	WorldPodium,
	WorldStageSkeleton,
	WorldWindowTabs,
} from "./world/WorldSpotlightUi";

const { useState, useEffect, useCallback } = Spicetify.React;

const VALID_WINDOWS = new Set<string>(WORLD_WINDOWS.map((w) => w.value));
const VALID_KINDS = new Set<string>(WORLD_KINDS.map((k) => k.value));
const WORLD_KIND_KEY = "listening-stats:world-charts-kind";

const PODIUM_SIZE = 3;
const LADDER_ROWS = 12;
const ROW_TOTAL = PODIUM_SIZE + LADDER_ROWS;

function restoreWindow(): WorldWindow {
	const stored = localStorage.getItem(LS_KEYS.WORLD_CHARTS_WINDOW);
	if (stored && VALID_WINDOWS.has(stored) && isStatsFmWindowSupported(stored as WorldWindow)) {
		return stored as WorldWindow;
	}
	return "today";
}

function restoreKind(): WorldChartKind {
	const stored = localStorage.getItem(WORLD_KIND_KEY);
	return stored && VALID_KINDS.has(stored) ? (stored as WorldChartKind) : "track";
}

function buildSourceLine(
	trackSource: WorldChartDataSource,
	artistSource: WorldChartDataSource,
	albumSource: WorldChartDataSource,
): string {
	if (trackSource === "statsfm" && artistSource === "statsfm" && albumSource === "statsfm") {
		return "Global charts · stats.fm";
	}
	const label = (src: WorldChartDataSource, kind: string) => {
		if (src === "mytopspotify") return `${kind} · mytopspotify.io (daily)`;
		return `${kind} · stats.fm`;
	};
	return [label(trackSource, "Tracks"), label(artistSource, "Artists"), label(albumSource, "Albums")].join(" · ");
}

export function WorldChartsPage() {
	const [timeWindow, setTimeWindow] = useState<WorldWindow>(restoreWindow);
	const [kind, setKind] = useState<WorldChartKind>(restoreKind);
	const [tracks, setTracks] = useState<WorldTrack[]>([]);
	const [artists, setArtists] = useState<WorldTrack[]>([]);
	const [albums, setAlbums] = useState<WorldTrack[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<AppError | null>(null);
	const [sourceLine, setSourceLine] = useState("Global charts · stats.fm");

	const winLabel = WORLD_WINDOWS.find((w) => w.value === timeWindow)?.label ?? "Today";

	const fetchCharts = useCallback(async (w: WorldWindow) => {
		setLoading(true);
		setError(null);

		const [trackResult, artistResult, albumResult] = await Promise.all([
			getChartsAsync("world", w),
			getArtistChartsAsync("world", w),
			getAlbumChartsAsync("world", w),
		]);

		let trackSource: WorldChartDataSource = "statsfm";
		let artistSource: WorldChartDataSource = "statsfm";
		let albumSource: WorldChartDataSource = "statsfm";

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

		if (albumResult.ok) {
			setAlbums(albumResult.data);
			albumSource = albumResult.source ?? "statsfm";
		} else {
			setAlbums([]);
		}

		setSourceLine(buildSourceLine(trackSource, artistSource, albumSource));
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

	const handleKindChange = (value: WorldChartKind) => {
		setKind(value);
		localStorage.setItem(WORLD_KIND_KEY, value);
	};

	const stageItems = (kind === "track" ? tracks : kind === "artist" ? artists : albums).slice(0, ROW_TOTAL);
	const podium = stageItems.slice(0, PODIUM_SIZE);
	const ladder = stageItems.slice(PODIUM_SIZE);
	const kindLabel = WORLD_KINDS.find((k) => k.value === kind)?.label ?? "Tracks";

	return (
		<div className="world-charts-page stats-page-content">
			<header className="section-heading world-page-header">
				<div>
					<span className="section-kicker" data-testid="world-page-kicker">
						What the planet is playing
					</span>
					<h1 className="section-title">World</h1>
				</div>
				<WorldWindowTabs value={timeWindow} onChange={handleWindowChange} />
			</header>

			{loading && <WorldStageSkeleton />}

			{!loading && error && <InlineErrorCard error={error} onRetry={handleRetry} onOpenSettings={() => {}} />}

			{!loading && !error && (
				<>
					{stageItems.length === 0 ? (
						<div className="world-charts-empty">
							<div className="world-charts-empty-title">Nothing charted here yet</div>
							<div className="world-charts-empty-body">
								{winLabel} {kindLabel.toLowerCase()} charts came back empty. Try another chart type or time range.
							</div>
						</div>
					) : (
						<>
							<section className="section-card world-podium-card" data-testid="world-podium-card">
								<div className="world-stage-header">
									<header className="section-heading" style={{ marginBottom: 0 }}>
										<span className="section-kicker">Global podium · {winLabel}</span>
										<h2 className="section-title">{kindLabel}</h2>
									</header>
									<WorldKindTabs value={kind} onChange={handleKindChange} />
								</div>
								<WorldPodium items={podium} kind={kind} />
							</section>
							{ladder.length > 0 ? (
								<section className="section-card" data-testid="world-ladder-card">
									<header className="section-heading">
										<span className="section-kicker">Global top 15</span>
										<h2 className="section-title">Ranks 4–15</h2>
									</header>
									<WorldLadder items={ladder} kind={kind} startRank={PODIUM_SIZE + 1} />
								</section>
							) : null}
						</>
					)}
					<div className="world-charts-source">{sourceLine}</div>
				</>
			)}
		</div>
	);
}
