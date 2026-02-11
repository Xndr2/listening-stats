import { formatDurationLong } from "../../services/stats";
import { ListeningStats } from "../../types";
import { formatNumber } from "../format";
import { estimateArtistPayout } from "../utils";
import { AnimatedNumber } from "./AnimatedNumber";
import { PeriodTabs } from "./PeriodTabs";
import { PortalTooltip } from "./PortalTooltip";

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
          <PortalTooltip text="Total number of tracks played (including repeats)">
            <div className="overview-stat">
              <div className="overview-stat-value">
                <AnimatedNumber value={stats.trackCount} format={formatNumber} />
              </div>
              <div className="overview-stat-label">Tracks</div>
            </div>
          </PortalTooltip>
          <PortalTooltip text="Number of different artists you've listened to">
            <div className="overview-stat">
              <div className="overview-stat-value">
                <AnimatedNumber value={stats.uniqueArtistCount} format={formatNumber} />
              </div>
              <div className="overview-stat-label">Artists</div>
            </div>
          </PortalTooltip>
          <PortalTooltip text="Number of different tracks you've listened to">
            <div className="overview-stat">
              <div className="overview-stat-value">
                <AnimatedNumber value={stats.uniqueTrackCount} format={formatNumber} />
              </div>
              <div className="overview-stat-label">Unique</div>
            </div>
          </PortalTooltip>
          {stats.lastfmConnected && stats.totalScrobbles ? (
            <PortalTooltip text="Total plays recorded by Last.fm">
              <div className="overview-stat">
                <div className="overview-stat-value">
                  {formatNumber(stats.totalScrobbles)}
                </div>
                <div className="overview-stat-label">Scrobbles</div>
              </div>
            </PortalTooltip>
          ) : null}
        </div>
      </div>

      <div className="overview-card-list">
        <div className="overview-card">
          <div className="stat-colored">
            <PortalTooltip text="Estimated amount Spotify paid artists from your streams ($0.004/stream)">
              <div className="stat-text">
                <div className="overview-value green">${payout}</div>
                <div className="overview-label">Spotify paid artists</div>
              </div>
            </PortalTooltip>
          </div>
        </div>

        <div className="overview-card">
          <div className="stat-colored">
            <PortalTooltip text="Consecutive days with at least one play">
              <div className="stat-text">
                <div className="overview-value orange">{formatNumber(stats.streakDays)}</div>
                <div className="overview-label">Day Streak</div>
              </div>
            </PortalTooltip>
          </div>
        </div>

        <div className="overview-card">
          <div className="stat-colored">
            <PortalTooltip text={stats.newArtistsCount > 0
              ? "Artists you listened to for the first time in this period"
              : "Number of days with at least one play in this period"}>
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
            </PortalTooltip>
          </div>
        </div>

        <div className="overview-card">
          <div className="stat-colored">
            <PortalTooltip text="Percentage of tracks skipped before the play threshold">
              <div className="stat-text">
                <div className="overview-value red">
                  {Math.floor(stats.skipRate * 100)}%
                </div>
                <div className="overview-label">Skip Rate</div>
              </div>
            </PortalTooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
