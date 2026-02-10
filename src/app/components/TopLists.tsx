import { formatDuration } from "../../services/stats";
import { ListeningStats } from "../../types";
import { formatNumber } from "../format";
import { Icons } from "../icons";
import { getRankClass, lazyNavigate, navigateToUri } from "../utils";

interface TopListsProps {
  stats: ListeningStats;
  likedTracks: Map<string, boolean>;
  onLikeToggle: (uri: string, e: React.MouseEvent) => void;
  showLikeButtons?: boolean;
  period?: string;
}

export function TopLists({
  stats,
  likedTracks,
  onLikeToggle,
  showLikeButtons = true,
  period = "",
}: TopListsProps) {
  const itemCount = 6;

  return (
    <div className="top-lists-section">
      <div className="top-list">
        <div className="top-list-header">
          <h3 className="top-list-title">
            <span dangerouslySetInnerHTML={{ __html: Icons.music }} />
            Top Tracks
          </h3>
        </div>
        <div className="item-list">
          {stats.topTracks.slice(0, itemCount).map((t, i) => (
            <div
              key={t.trackUri || `track-${i}`}
              className="item-row"
              onClick={() =>
                t.trackUri
                  ? navigateToUri(t.trackUri)
                  : lazyNavigate("track", t.trackName, t.artistName)
              }
            >
              <span className={`item-rank ${getRankClass(i)}`}>{i + 1}</span>
              {t.albumArt ? (
                <img src={t.albumArt} className="item-art" alt="" />
              ) : (
                <div className="item-art placeholder" />
              )}
              <div className="item-info">
                <div className="item-name">{t.trackName}</div>
                <div className="item-meta">{t.artistName}</div>
              </div>
              <div className="item-stats">
                {t.playCount ? (
                  <span className="item-plays">{formatNumber(t.playCount)} plays</span>
                ) : null}
                {t.totalTimeMs > 0 && (
                  <span className="item-time">
                    {formatDuration(t.totalTimeMs)}
                  </span>
                )}
              </div>
              {showLikeButtons && t.trackUri && (
                <button
                  className={`heart-btn ${likedTracks.get(t.trackUri) ? "liked" : ""}`}
                  onClick={(e) => onLikeToggle(t.trackUri, e)}
                  dangerouslySetInnerHTML={{
                    __html: likedTracks.get(t.trackUri)
                      ? Icons.heartFilled
                      : Icons.heart,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="top-list">
        <div className="top-list-header">
          <h3 className="top-list-title">
            <span dangerouslySetInnerHTML={{ __html: Icons.users }} />
            Top Artists
          </h3>
        </div>
        <div className="item-list">
          {stats.topArtists.slice(0, itemCount).map((a, i) => {
            return (
              <div
                key={a.artistUri || a.artistName}
                className="item-row"
                onClick={() =>
                  a.artistUri
                    ? navigateToUri(a.artistUri)
                    : lazyNavigate("artist", a.artistName)
                }
              >
                <span className={`item-rank ${getRankClass(i)}`}>{i + 1}</span>
                {a.artistImage ? (
                  <img src={a.artistImage} className="item-art round" alt="" />
                ) : (
                  <div className="item-art round placeholder artist-placeholder" />
                )}
                <div className="item-info">
                  <div className="item-name">{a.artistName}</div>
                  <div className="item-meta">
                    {a.genres?.slice(0, 2).join(", ") || ""}
                  </div>
                </div>
                {a.playCount ? (
                  <div className="item-stats">
                    <span className="item-plays">{formatNumber(a.playCount)} plays</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="top-list">
        <div className="top-list-header">
          <h3 className="top-list-title">
            <span dangerouslySetInnerHTML={{ __html: Icons.album }} />
            Top Albums
          </h3>
        </div>
        <div className="item-list">
          {stats.topAlbums.slice(0, itemCount).map((a, i) => (
            <div
              key={a.albumUri || `album-${i}`}
              className="item-row"
              onClick={() =>
                a.albumUri
                  ? navigateToUri(a.albumUri)
                  : lazyNavigate("album", a.albumName, a.artistName)
              }
            >
              <span className={`item-rank ${getRankClass(i)}`}>{i + 1}</span>
              {a.albumArt ? (
                <img src={a.albumArt} className="item-art" alt="" />
              ) : (
                <div className="item-art placeholder" />
              )}
              <div className="item-info">
                <div className="item-name">{a.albumName}</div>
                <div className="item-meta">{a.artistName}</div>
              </div>
              <div className="item-stats">
                {a.playCount ? (
                  <span className="item-plays">{formatNumber(a.playCount)} plays</span>
                ) : null}
                <span className="item-time">{formatNumber(a.trackCount)} tracks</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
