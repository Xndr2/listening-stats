import { LS_KEYS } from "../../shared/constants/storage-keys";
import type { AppError } from "../../shared/errors";
import { classifyStatsFmError } from "../../shared/errors";
import type { WorldChartDataSource, WorldTrack, WorldWindow } from "../world-charts-service";
import {
	getAlbumChartsAsync,
	getArtistChartsAsync,
	getChartsAsync,
	isStatsFmWindowSupported,
} from "../world-charts-service";
import { InlineErrorCard } from "./InlineErrorCard";
import { WorldChartsSkeleton } from "./LoadingSkeleton";
import { ChartCard, HeroSkeleton, WorldHeroSection, WorldWindowTabs, WORLD_WINDOWS } from "./world/WorldSpotlightUi";

const { useState, useEffect, useCallback } = Spicetify.React;

const VALID_WINDOWS = new Set<string>(WORLD_WINDOWS.map((w) => w.value));

const PODIUM_SIZE = 3;
const LIST_ROWS = 7;
const ROW_TOTAL = PODIUM_SIZE + LIST_ROWS;

function restoreWindow(): WorldWindow {
	const stored = localStorage.getItem(LS_KEYS.WORLD_CHARTS_WINDOW);
	if (stored && VALID_WINDOWS.has(stored) && isStatsFmWindowSupported(stored as WorldWindow)) {
		return stored as WorldWindow;
	}
	return "today";
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
		if (src === "statsfm") return `${kind} · stats.fm`;
		if (src === "mytopspotify") return `${kind} · mytopspotify.io (daily)`;
		return `${kind} · demo`;
	};
	return [label(trackSource, "Tracks"), label(artistSource, "Artists"), label(albumSource, "Albums")].join(" · ");
}

export function WorldChartsPage() {
	const [timeWindow, setTimeWindow] = useState<WorldWindow>(restoreWindow);
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

		let trackSource: WorldChartDataSource = "mock";
		let artistSource: WorldChartDataSource = "mock";
		let albumSource: WorldChartDataSource = "mock";

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

	const hero = tracks[0];
	const trackSlice = tracks.slice(0, ROW_TOTAL);
	const artistSlice = artists.slice(0, ROW_TOTAL);
	const albumSlice = albums.slice(0, ROW_TOTAL);

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

			{loading && (
				<div className="world-page-grid">
					<HeroSkeleton />
					<WorldChartsSkeleton />
				</div>
			)}

			{!loading && error && <InlineErrorCard error={error} onRetry={handleRetry} onOpenSettings={() => {}} />}

			{!loading && !error && (
				<>
					<div className="world-page-grid">
						{hero ? (
							<WorldHeroSection
								item={hero}
								winLabel={winLabel}
								runnersUp={tracks.slice(1, 3)}
								topArtist={artists[0]}
								topAlbum={albums[0]}
							/>
						) : null}
						<ChartCard
							kicker="Top"
							title="Tracks"
							podium={trackSlice.slice(0, PODIUM_SIZE)}
							rows={trackSlice.slice(PODIUM_SIZE)}
							kind="track"
						/>
						<ChartCard
							kicker="Top"
							title="Artists"
							podium={artistSlice.slice(0, PODIUM_SIZE)}
							rows={artistSlice.slice(PODIUM_SIZE)}
							kind="artist"
						/>
						<ChartCard
							kicker="Top"
							title="Albums"
							podium={albumSlice.slice(0, PODIUM_SIZE)}
							rows={albumSlice.slice(PODIUM_SIZE)}
							kind="album"
						/>
					</div>

					<div className="world-charts-source">{sourceLine}</div>
				</>
			)}
		</div>
	);
}
