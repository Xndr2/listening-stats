interface PeriodTabsProps {
  period: string;
  periods: string[];
  periodLabels: Record<string, string>;
  onPeriodChange: (period: string) => void;
}

export function PeriodTabs({
  period,
  periods,
  periodLabels,
  onPeriodChange,
}: PeriodTabsProps) {
  return (
    <div className="period-tabs">
      {periods.map((p) => (
        <button
          key={p}
          className={`period-tab ${period === p ? "active" : ""}`}
          onClick={() => onPeriodChange(p)}
        >
          {periodLabels[p] || p}
        </button>
      ))}
    </div>
  );
}
