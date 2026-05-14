import type { StatsResult } from "../../shared/types/stats";
import { normalizeSpotifyImageUrl } from "../../shared/util/spotify-image-url";
import { formatDuration, formatNumber } from "../format";
import { getPreferences } from "../preferences";
import { navigateToUri } from "../utils";
import { SkeletonBlock, SkeletonCircle } from "./SkeletonPrimitives";

const { React } = Spicetify;

export function getRankClass(rank: number): string {
	if (rank === 1) return "rank-gold";
	if (rank === 2) return "rank-silver";
	if (rank === 3) return "rank-bronze";
	return "";
}

function TopListColumnSkeleton() {
	return (
		<div>
			{Array.from({ length: 5 }).map((_, i) => (
				<div key={i} className="top-list-row" style={{ marginBottom: 6 }}>
					<SkeletonCircle size={20} />
					<SkeletonBlock width={44} height={44} />
					<div style={{ flex: 1 }}>
						<SkeletonBlock width="80%" height={11} style={{ marginBottom: 6 }} />
						<SkeletonBlock width="55%" height={9} />
					</div>
				</div>
			))}
		</div>
	);
}

interface TopListsProps {
	stats: StatsResult | null;
	loading: boolean;
	loadingByColumn?: { tracks: boolean; artists: boolean; albums: boolean };
	hiddenSections: string[];
	onGenreClick?: (genre: string) => void;
	activeGenre?: string | null;
}

export function TopLists({
	stats,
	loading,
	loadingByColumn,
	hiddenSections,
	onGenreClick,
	activeGenre,
}: TopListsProps) {
	const prefs = getPreferences();

	const visibleColumns = prefs.columnOrder.filter((id) => !hiddenSections.includes(id));
	if (visibleColumns.length === 0) return null;

	const columnRenderers: Record<string, () => React.ReactNode> = {
		"top-tracks": () => (
			<div className="section-card" data-column-id="top-tracks" key="top-tracks">
				<header className="section-heading">
					<span className="section-kicker">Most played</span>
					<h2 className="section-title">Tracks</h2>
				</header>
				{loading || loadingByColumn?.tracks ? (
					<TopListColumnSkeleton />
				) : (
					stats?.topTracks.slice(0, prefs.itemsPerSection).map((track) => {
						const trackArt = normalizeSpotifyImageUrl(track.albumArt);
						return (
							<div
								key={track.trackUri || `unknown-track-${track.rank}`}
								className="top-list-row"
								role="button"
								tabIndex={0}
								onClick={() => navigateToUri(track.trackUri)}
								onKeyDown={(e: { key: string }) => {
									if (e.key === "Enter" || e.key === " ") navigateToUri(track.trackUri);
								}}
							>
								<span className={`rank-number ${getRankClass(track.rank)}`}>{track.rank}</span>
								{trackArt ? <img src={trackArt} alt="" className="track-art" /> : null}
								<div
									style={{
										flex: 1,
										minWidth: 0,
										display: "flex",
										flexDirection: "column",
										gap: 2,
									}}
								>
									<div
										style={{
											fontSize: 13,
											fontWeight: 600,
											color: "var(--spice-text)",
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
									>
										{track.trackName}
									</div>
									<div
										style={{
											fontSize: 11,
											fontWeight: 400,
											color: "rgba(var(--spice-rgb-text), 0.55)",
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
									>
										{track.artistName}
									</div>
								</div>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										color: "rgba(var(--spice-rgb-text), 0.55)",
										flexShrink: 0,
									}}
								>
									<span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
										{formatDuration(track.durationMs)}
									</span>
								</div>
							</div>
						);
					})
				)}
			</div>
		),
		"top-artists": () => (
			<div className="section-card" data-column-id="top-artists" key="top-artists">
				<header className="section-heading">
					<span className="section-kicker">Top</span>
					<h2 className="section-title">Artists</h2>
				</header>
				{loading || loadingByColumn?.artists ? (
					<TopListColumnSkeleton />
				) : (
					stats?.topArtists.slice(0, prefs.itemsPerSection).map((artist) => {
						const primaryGenre = artist.genres?.[0];
						const artistAvatar = normalizeSpotifyImageUrl(artist.imageUrl ?? undefined);
						return (
							<div
								key={artist.artistUri || `unknown-artist-${artist.rank}`}
								className="top-list-row"
								role="button"
								tabIndex={0}
								onClick={() => navigateToUri(artist.artistUri)}
								onKeyDown={(e: { key: string }) => {
									if (e.key === "Enter" || e.key === " ") navigateToUri(artist.artistUri);
								}}
							>
								<span className={`rank-number ${getRankClass(artist.rank)}`}>{artist.rank}</span>
								{artistAvatar ? (
									<img src={artistAvatar} alt="" className="track-art track-art--round" />
								) : null}
								<div
									style={{
										flex: 1,
										minWidth: 0,
										display: "flex",
										flexDirection: "column",
										gap: 2,
									}}
								>
									<div
										style={{
											fontSize: 13,
											fontWeight: 600,
											color: "var(--spice-text)",
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
									>
										{artist.artistName}
									</div>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: 6,
											fontSize: 11,
											fontWeight: 400,
											color: "rgba(var(--spice-rgb-text), 0.55)",
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
									>
										<span style={{ fontVariantNumeric: "tabular-nums" }}>
											{formatNumber(artist.count)} plays
										</span>
										{primaryGenre && (
											<>
												<span style={{ opacity: 0.4 }}>·</span>
												<span
													role="button"
													tabIndex={0}
													onClick={(e: { stopPropagation: () => void }) => {
														e.stopPropagation();
														onGenreClick?.(primaryGenre);
													}}
													onKeyDown={(e: { key: string; stopPropagation: () => void }) => {
														if (e.key === "Enter" || e.key === " ") {
															e.stopPropagation();
															onGenreClick?.(primaryGenre);
														}
													}}
													style={{
														color:
															activeGenre === primaryGenre
																? "var(--spice-button)"
																: "rgba(var(--spice-rgb-text), 0.7)",
														cursor: "pointer",
													}}
												>
													{primaryGenre}
												</span>
											</>
										)}
									</div>
								</div>
							</div>
						);
					})
				)}
			</div>
		),
		"top-albums": () => (
			<div className="section-card" data-column-id="top-albums" key="top-albums">
				<header className="section-heading">
					<span className="section-kicker">Top</span>
					<h2 className="section-title">Albums</h2>
				</header>
				{loading || loadingByColumn?.albums ? (
					<TopListColumnSkeleton />
				) : (
					stats?.topAlbums.slice(0, prefs.itemsPerSection).map((album) => {
						const albumArt = normalizeSpotifyImageUrl(album.albumArt);
						return (
							<div
								key={album.albumUri || `unknown-album-${album.rank}`}
								className="top-list-row"
								role="button"
								tabIndex={0}
								onClick={() => navigateToUri(album.albumUri)}
								onKeyDown={(e: { key: string }) => {
									if (e.key === "Enter" || e.key === " ") navigateToUri(album.albumUri);
								}}
							>
								<span className={`rank-number ${getRankClass(album.rank)}`}>{album.rank}</span>
								{albumArt ? <img src={albumArt} alt="" className="track-art" /> : null}
								<div
									style={{
										flex: 1,
										minWidth: 0,
										display: "flex",
										flexDirection: "column",
										gap: 2,
									}}
								>
									<div
										style={{
											fontSize: 13,
											fontWeight: 600,
											color: "var(--spice-text)",
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
									>
										{album.albumName}
									</div>
									<div
										style={{
											fontSize: 11,
											fontWeight: 400,
											color: "rgba(var(--spice-rgb-text), 0.55)",
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
											fontVariantNumeric: "tabular-nums",
										}}
									>
										{album.artistName} · {formatNumber(album.count)} plays
									</div>
								</div>
							</div>
						);
					})
				)}
			</div>
		),
	};

	return (
		<div className="top-lists-grid">
			{visibleColumns.map((id) => columnRenderers[id]?.() ?? null)}
		</div>
	);
}
