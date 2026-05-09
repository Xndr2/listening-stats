import { useState } from "react";
import { formatHour } from "../format";
import { getPreferences } from "../preferences";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = Array.from({ length: 7 }, (_, i) => i);
const WEEKDAYS_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface ListeningPatternsProps {
	hourlyDistribution: number[];
	peakHour: number;
	weekdayDistribution: number[];
	peakWeekday: number;
}

export function ListeningPatterns({ hourlyDistribution, peakHour, weekdayDistribution, peakWeekday }: ListeningPatternsProps) {
	const [activeTab, setActiveTab] = useState<"hours" | "days">("hours");
	const prefs = getPreferences();

	const peakLabel = activeTab === "hours"
		? (hourlyDistribution[peakHour] > 0 ? formatHour(peakHour, prefs.use24HourTime) : null)
		: (weekdayDistribution[peakWeekday] > 0 ? WEEKDAYS_FULL[peakWeekday] : null);

	return (
		<div className="section-card">
			<div className="activity-chart-header">
				<header className="section-heading" style={{ marginBottom: 0 }}>
					<span className="section-kicker">Patterns</span>
					<h2 className="section-title">Activity</h2>
				</header>
				{peakLabel && (
					<div className="activity-chart-peak">
						Peak: <span>{peakLabel}</span>
					</div>
				)}
			</div>
			<div className="listening-patterns-tabs">
				<button
					className={`listening-patterns-tab${activeTab === "hours" ? " active" : ""}`}
					onClick={() => setActiveTab("hours")}
				>
					Hours
				</button>
				<button
					className={`listening-patterns-tab${activeTab === "days" ? " active" : ""}`}
					onClick={() => setActiveTab("days")}
				>
					Days
				</button>
			</div>
			{activeTab === "hours"
				? renderHourlyChart(hourlyDistribution, peakHour, prefs.use24HourTime)
				: renderWeekdayChart(weekdayDistribution, peakWeekday)}
		</div>
	);
}

function renderHourlyChart(hourlyDistribution: number[], peakHour: number, use24h: boolean) {
	const max = Math.max(...hourlyDistribution, 1);
	return (
		<>
			<div className="activity-chart">
				{HOURS.map((hr) => {
					const val = hourlyDistribution[hr];
					const heightPct = val > 0 ? Math.max((val / max) * 100, 5) : 0;
					const isPeak = hr === peakHour && val > 0;
					return (
						<Spicetify.ReactComponent.TooltipWrapper
							key={hr}
							label={`${formatHour(hr, use24h)}: ${val} plays`}
							placement="top"
						>
							<div
								className={`activity-bar${isPeak ? " peak" : ""}`}
								style={{ height: `${heightPct}%` }}
							/>
						</Spicetify.ReactComponent.TooltipWrapper>
					);
				})}
			</div>
			<div className="activity-chart-labels">
				<span>{formatHour(0, use24h)}</span>
				<span>{formatHour(6, use24h)}</span>
				<span>{formatHour(12, use24h)}</span>
				<span>{formatHour(18, use24h)}</span>
				<span>{formatHour(0, use24h)}</span>
			</div>
		</>
	);
}

function renderWeekdayChart(weekdayDistribution: number[], peakWeekday: number) {
	const max = Math.max(...weekdayDistribution, 1);
	return (
		<>
			<div className="weekday-chart">
				{DAYS.map((day) => {
					const val = weekdayDistribution[day];
					const heightPct = val > 0 ? Math.max((val / max) * 100, 5) : 0;
					const isPeak = day === peakWeekday && val > 0;
					return (
						<Spicetify.ReactComponent.TooltipWrapper
							key={day}
							label={`${WEEKDAYS_FULL[day]}: ${val} plays`}
							placement="top"
						>
							<div
								className={`activity-bar${isPeak ? " peak" : ""}`}
								style={{ height: `${heightPct}%` }}
							/>
						</Spicetify.ReactComponent.TooltipWrapper>
					);
				})}
			</div>
			<div className="weekday-chart-labels">
				{WEEKDAYS_ABBR.map((label) => (
					<span key={label}>{label}</span>
				))}
			</div>
		</>
	);
}
