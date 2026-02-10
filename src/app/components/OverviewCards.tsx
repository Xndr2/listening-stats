import { formatDurationLong } from "../../services/stats";
import { ListeningStats } from "../../types";
import { formatNumber } from "../format";
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

export function OverviewCards({
  stats,
  period,
  periods,
  periodLabels,
  onPeriodChange,
}: OverviewCardsProps) {
  const payout = estimateArtistPayout(stats.trackCount);

  return (
    <div className="overview-row">
      <div className="overview-card hero">
        <div className="overview-value">
          {formatDurationLong(stats.totalTimeMs)}
        </div>
        <div className="overview-label">Time Listened</div>
        <PeriodTabs
          period={period}
          periods={periods}
          periodLabels={periodLabels}
          onPeriodChange={onPeriodChange}
        />
        <div className="overview-secondary">
          <div className="stat-tooltip-wrapper">
            <div className="overview-stat">
              <div className="overview-stat-value">
                <AnimatedNumber value={stats.trackCount} format={formatNumber} />
              </div>
              <div className="overview-stat-label">Tracks</div>
            </div>
            <div className="stat-tooltip">Total number of tracks played (including repeats)</div>
          </div>
          <div className="stat-tooltip-wrapper">
            <div className="overview-stat">
              <div className="overview-stat-value">
                <AnimatedNumber value={stats.uniqueArtistCount} format={formatNumber} />
              </div>
              <div className="overview-stat-label">Artists</div>
            </div>
            <div className="stat-tooltip">Number of different artists you've listened to</div>
          </div>
          <div className="stat-tooltip-wrapper">
            <div className="overview-stat">
              <div className="overview-stat-value">
                <AnimatedNumber value={stats.uniqueTrackCount} format={formatNumber} />
              </div>
              <div className="overview-stat-label">Unique</div>
            </div>
            <div className="stat-tooltip">Number of different tracks you've listened to</div>
          </div>
          {stats.lastfmConnected && stats.totalScrobbles ? (
            <div className="stat-tooltip-wrapper">
              <div className="overview-stat">
                <div className="overview-stat-value">
                  {formatNumber(stats.totalScrobbles)}
                </div>
                <div className="overview-stat-label">Scrobbles</div>
              </div>
              <div className="stat-tooltip">Total plays recorded by Last.fm</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="overview-card-list">
        <div className="overview-card">
          <div className="stat-colored">
            <div className="stat-tooltip-wrapper">
              <div className="stat-text">
                <div className="overview-value green">${payout}</div>
                <div className="overview-label">Spotify paid artists</div>
              </div>
              <div className="stat-tooltip">Estimated amount Spotify paid artists from your streams ($0.004/stream)</div>
            </div>
          </div>
        </div>

        <div className="overview-card">
          <div className="stat-colored">
            <div className="stat-tooltip-wrapper">
              <div className="stat-text">
                <div className="overview-value orange">{formatNumber(stats.streakDays)}</div>
                <div className="overview-label">Day Streak</div>
              </div>
              <div className="stat-tooltip">Consecutive days with at least one play</div>
            </div>
          </div>
        </div>

        <div className="overview-card">
          <div className="stat-colored">
            <div className="stat-tooltip-wrapper">
              <div className="stat-text">
                {stats.newArtistsCount > 0 ? (
                  <>
                    <div className="overview-value purple">
                      {formatNumber(stats.newArtistsCount)}
                    </div>
                    <div className="overview-label">New Artists</div>
                  </>
                ) : (
                  <>
                    <div className="overview-value purple">
                      {formatNumber(stats.listenedDays)}
                    </div>
                    <div className="overview-label">Days Listened</div>
                  </>
                )}
              </div>
              <div className="stat-tooltip">
                {stats.newArtistsCount > 0
                  ? "Artists you listened to for the first time in this period"
                  : "Number of days with at least one play in this period"}
              </div>
            </div>
          </div>
        </div>

        <div className="overview-card">
          <div className="stat-colored">
            <div className="stat-tooltip-wrapper">
              <div className="stat-text">
                <div className="overview-value red">
                  {Math.floor(stats.skipRate * 100)}%
                </div>
                <div className="overview-label">Skip Rate</div>
              </div>
              <div className="stat-tooltip">Percentage of tracks skipped before the play threshold</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
