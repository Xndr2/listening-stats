import { formatHour, formatMinutes } from "../utils";

interface ActivityChartProps {
  hourlyDistribution: number[];
  peakHour: number;
  hourlyUnit?: "ms" | "plays";
}

export function ActivityChart({ hourlyDistribution, peakHour, hourlyUnit = "ms" }: ActivityChartProps) {
  if (!hourlyDistribution.some((h) => h > 0)) {
    return null;
  }

  const max = Math.max(...hourlyDistribution, 1);

  const formatValue = (val: number) => {
    if (hourlyUnit === "plays") {
      return `${val} ${val === 1 ? "play" : "plays"}`;
    }
    return formatMinutes(val);
  };

  return (
    <div className="activity-section">
      <div className="activity-header">
        <h3 className="activity-title">Activity by Hour</h3>
        <div className="activity-peak">
          Peak: <strong>{formatHour(peakHour)}</strong>
        </div>
      </div>
      <div className="activity-chart">
        {hourlyDistribution.map((val, hr) => {
          const h = val > 0 ? Math.max((val / max) * 100, 5) : 0;
          return (
            <div
              key={hr}
              className={`activity-bar ${hr === peakHour && val > 0 ? "peak" : ""}`}
              style={{ height: `${h}%` }}
            >
              <div className="activity-bar-tooltip">
                {formatHour(hr)}: {formatValue(val)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="chart-labels">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>12am</span>
      </div>
    </div>
  );
}
