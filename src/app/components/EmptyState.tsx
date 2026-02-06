import { formatDurationLong, getPeriodDisplayName } from "../../services/stats";
import { ListeningStats } from "../../types";
import { PeriodTabs } from "./PeriodTabs";

interface EmptyStateProps {
  stats: ListeningStats | null;
  period: string;
  periods: string[];
  periodLabels: Record<string, string>;
  onPeriodChange: (period: string) => void;
}

export function EmptyState({
  stats,
  period,
  periods,
  periodLabels,
  onPeriodChange,
}: EmptyStateProps) {
  return (
    <>
      <div className="overview-row">
        <div className="overview-card hero">
          <div className="overview-value">
            {formatDurationLong(stats?.totalTimeMs ?? 0)}
          </div>
          <div className="overview-label">
            No data for {getPeriodDisplayName(period)}
          </div>
          <PeriodTabs
            period={period}
            periods={periods}
            periodLabels={periodLabels}
            onPeriodChange={onPeriodChange}
          />
          <div className="overview-secondary">
            Play some music to see your statistics here!
          </div>
        </div>
      </div>
    </>
  );
}
