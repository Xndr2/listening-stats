import { formatHour } from "../format";
import { getPreferences } from "../preferences";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface ActivityChartProps {
	hourlyDistribution: number[];
	peakHour: number;
}

export function ActivityChart({ hourlyDistribution, peakHour }: ActivityChartProps) {
	const prefs = getPreferences();
	const max = Math.max(...hourlyDistribution, 1);

	return (
		<div className="section-card">
			<div className="activity-chart-header">
				<header className="section-heading" style={{ marginBottom: 0 }}>
					<span className="section-kicker">Patterns</span>
					<h2 className="section-title">Activity</h2>
				</header>
				{hourlyDistribution[peakHour] > 0 && (
					<div className="activity-chart-peak">
						Peak: <span>{formatHour(peakHour, prefs.use24HourTime)}</span>
					</div>
				)}
			</div>
			<div className="activity-chart">
				{HOURS.map((hr) => {
					const val = hourlyDistribution[hr];
					const heightPct = val > 0 ? Math.max((val / max) * 100, 5) : 0;
					const isPeak = hr === peakHour && val > 0;
					return (
						<Spicetify.ReactComponent.TooltipWrapper
							key={hr}
							label={`${formatHour(hr, prefs.use24HourTime)}: ${val} plays`}
							placement="top"
						>
							<div className={`activity-bar${isPeak ? " peak" : ""}`} style={{ height: `${heightPct}%` }} />
						</Spicetify.ReactComponent.TooltipWrapper>
					);
				})}
			</div>
			<div className="activity-chart-labels">
				<span>{formatHour(0, prefs.use24HourTime)}</span>
				<span>{formatHour(6, prefs.use24HourTime)}</span>
				<span>{formatHour(12, prefs.use24HourTime)}</span>
				<span>{formatHour(18, prefs.use24HourTime)}</span>
				<span>{formatHour(0, prefs.use24HourTime)}</span>
			</div>
		</div>
	);
}
