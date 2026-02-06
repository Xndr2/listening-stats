import { RecentTrack } from "../../types";
import { lazyNavigate, navigateToUri, timeAgo } from "../utils";

interface RecentlyPlayedProps {
  recentTracks: RecentTrack[];
}

export function RecentlyPlayed({ recentTracks }: RecentlyPlayedProps) {
  if (recentTracks.length === 0) {
    return null;
  }

  const limit = 12;

  return (
    <div className="recent-section">
      <div className="recent-header">
        <h3 className="recent-title">Recently Played</h3>
      </div>
      <div className="recent-scroll">
        {recentTracks.slice(0, limit).map((t) => (
          <div
            key={`${t.trackUri || t.trackName}-${t.playedAt}`}
            className="recent-card"
            onClick={() => t.trackUri ? navigateToUri(t.trackUri) : lazyNavigate("track", t.trackName, t.artistName)}
          >
            {t.albumArt ? (
              <img src={t.albumArt} className="recent-art" alt="" />
            ) : (
              <div className="recent-art placeholder" />
            )}
            <div className="recent-name">{t.trackName}</div>
            <div className="recent-meta">{t.artistName}</div>
            <div className="recent-time">{timeAgo(t.playedAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
