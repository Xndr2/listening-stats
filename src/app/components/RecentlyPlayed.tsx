import type { RecentPlay } from "../../shared/types/stats";
import { normalizeSpotifyImageUrl } from "../../shared/util/spotify-image-url";
import { formatRelativeTime } from "../format";
import { ShareIcon } from "../icons";
import { navigateToUri } from "../utils";
import { SkeletonBlock } from "./SkeletonPrimitives";

interface RecentlyPlayedProps {
	recentPlays?: RecentPlay[];
	loading?: boolean;
	onShare?: () => void;
}

export function RecentlyPlayed({ recentPlays = [], loading = false, onShare }: RecentlyPlayedProps) {
	return (
		<div className="section-card">
			<header className="section-heading">
				<span className="section-kicker">Last 24h</span>
				<h2 className="section-title">Recently Played</h2>
				{onShare && (
					<button
						type="button"
						className="btn-icon share-section-btn"
						style={{ marginLeft: "auto" }}
						onClick={(e) => {
							e.stopPropagation();
							onShare();
						}}
						aria-label="Share recently played"
						dangerouslySetInnerHTML={{ __html: ShareIcon }}
					/>
				)}
			</header>
			<div className="recently-played">
				{loading
					? Array.from({ length: 6 }).map((_, i) => (
							<div key={i} className="recently-played-item" aria-hidden="true">
								<SkeletonBlock className="recently-played-skeleton-art" width={132} height={132} radius={6} />
								<SkeletonBlock
									className="recently-played-skeleton-text"
									width={100}
									height={10}
									radius={2}
									style={{ marginTop: 8 }}
								/>
								<SkeletonBlock
									className="recently-played-skeleton-subtext"
									width={70}
									height={10}
									radius={2}
									style={{ marginTop: 6 }}
								/>
							</div>
						))
					: recentPlays.map((play) => {
							const art = normalizeSpotifyImageUrl(play.albumArt);
							return (
								<div
									key={`${play.trackUri}-${play.playedAt}`}
									className="recently-played-item"
									onClick={() => navigateToUri(play.trackUri)}
								>
									{art ? (
										<img src={art} alt="" className="recently-played-art" />
									) : (
										<div className="recently-played-art" />
									)}
									<div className="recently-played-name">{play.trackName}</div>
									<div className="recently-played-artist">{play.artistName}</div>
									<div className="recently-played-time">{formatRelativeTime(play.playedAt)}</div>
								</div>
							);
						})}
			</div>
		</div>
	);
}
