import { navigateToUri } from "../utils";
import { formatRelativeTime } from "../format";
import type { RecentPlay } from "../../shared/types/stats";
import { SkeletonBlock } from "./SkeletonPrimitives";

interface RecentlyPlayedProps {
	recentPlays?: RecentPlay[];
	loading?: boolean;
}

export function RecentlyPlayed({ recentPlays = [], loading = false }: RecentlyPlayedProps) {
	return (
		<div className="section-card">
			<header className="section-heading">
				<span className="section-kicker">Last 24h</span>
				<h2 className="section-title">Recently Played</h2>
			</header>
			<div className="recently-played">
				{loading
					? Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="recently-played-item" aria-hidden="true">
							<SkeletonBlock className="recently-played-skeleton-art" width={132} height={132} radius={6} />
							<SkeletonBlock className="recently-played-skeleton-text" width={100} height={10} radius={2} style={{ marginTop: 8 }} />
							<SkeletonBlock className="recently-played-skeleton-subtext" width={70} height={10} radius={2} style={{ marginTop: 6 }} />
						</div>
					))
					: recentPlays.map((play) => (
					<div
						key={`${play.trackUri}-${play.playedAt}`}
						className="recently-played-item"
						onClick={() => navigateToUri(play.trackUri)}
					>
						{play.albumArt ? (
							<img
								src={play.albumArt}
								alt=""
								className="recently-played-art"
							/>
						) : (
							<div className="recently-played-art" />
						)}
						<div className="recently-played-name">{play.trackName}</div>
						<div className="recently-played-artist">{play.artistName}</div>
						<div className="recently-played-time">
							{formatRelativeTime(play.playedAt)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
