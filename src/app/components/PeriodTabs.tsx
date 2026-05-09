import type { Period } from "../../shared/types/stats";

interface PeriodTabsProps {
	periods: Period[];
	activePeriod: Period;
	onPeriodChange: (period: Period) => void;
}

export default function PeriodTabs({ periods, activePeriod, onPeriodChange }: PeriodTabsProps) {
	return (
		<div className="period-tabs" role="tablist">
			{periods.map((p) => (
				<button
					key={p.id}
					className={`period-tab ${p.id === activePeriod.id ? "active" : ""}`}
					role="tab"
					aria-selected={p.id === activePeriod.id}
					onClick={() => onPeriodChange(p)}
				>
					{p.label}
				</button>
			))}
		</div>
	);
}
