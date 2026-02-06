import { formatDurationLong } from "../../services/stats";
import { ListeningStats } from "../../types";
import { estimateArtistPayout } from "../utils";
import { AnimatedNumber } from "./AnimatedNumber";
import { PeriodTabs } from "./PeriodTabs";

interface OverviewCardsProps {
  stats: ListeningStats;
  period: string;
  periods: string[];
  periodLabels: Record<string, string>;
  onPeriodChange: (period: string) => void;
}

export function OverviewCards({ stats, period, periods, periodLabels, onPeriodChange }: OverviewCardsProps) {
  const payout = estimateArtistPayout(stats.trackCount);

  return (
    <div className="overview-row">
      <div className="overview-card hero">
        <div className="overview-value">{formatDurationLong(stats.totalTimeMs)}</div>
        <div className="overview-label">Time Listened</div>
        <PeriodTabs period={period} periods={periods} periodLabels={periodLabels} onPeriodChange={onPeriodChange} />
        <div className="overview-secondary">
          <div className="overview-stat">
            <div className="overview-stat-value"><AnimatedNumber value={stats.trackCount} /></div>
            <div className="overview-stat-label">Tracks</div>
          </div>
          <div className="overview-stat">
            <div className="overview-stat-value"><AnimatedNumber value={stats.uniqueArtistCount} /></div>
            <div className="overview-stat-label">Artists</div>
          </div>
          <div className="overview-stat">
            <div className="overview-stat-value"><AnimatedNumber value={stats.uniqueTrackCount} /></div>
            <div className="overview-stat-label">Unique</div>
          </div>
          {stats.lastfmConnected && stats.totalScrobbles ? (
            <div className="overview-stat">
              <div className="overview-stat-value">{stats.totalScrobbles.toLocaleString()}</div>
              <div className="overview-stat-label">Scrobbles</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="overview-card-list">
        <div className="overview-card">
          <div className="stat-colored">
            <div className="stat-text">
              <div className="overview-value green">${payout}</div>
              <div className="overview-label">Spotify paid artists</div>
              <div className="overview-label-tooltip">
                From you listening to their music!
              </div>
            </div>
          </div>
        </div>

        <div className="overview-card">
          <div className="stat-colored">
            <div className="stat-text">
              <div className="overview-value orange">{stats.streakDays}</div>
              <div className="overview-label">Day Streak</div>
              <div className="overview-label-tooltip">
                Resets at midnight local time.
              </div>
            </div>
          </div>
        </div>

        <div className="overview-card">
          <div className="stat-colored">
            <div className="stat-text">
              {stats.newArtistsCount > 0 ? (
                <>
                  <div className="overview-value purple">{stats.newArtistsCount}</div>
                  <div className="overview-label">New Artists</div>
                  <div className="overview-label-tooltip">
                    You're cool if this is high!
                  </div>
                </>
              ) : (
                <>
                  <div className="overview-value purple">{stats.listenedDays}</div>
                  <div className="overview-label">Days Listened</div>
                  <div className="overview-label-tooltip">
                    Days with at least one play.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="overview-card">
          <div className="stat-colored">
            <div className="stat-text">
              <div className="overview-value red">
                {Math.floor(stats.skipRate * 100)}%
              </div>
              <div className="overview-label">Skip Rate</div>
              <div className="overview-label-tooltip">
                Get this as low as possible!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
