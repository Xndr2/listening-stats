import { formatHour } from "../format";
import type { ActivityTabId } from "../preferences";
import { getPreferences, setPreference } from "../preferences";
import { CalendarHeatmap } from "./CalendarHeatmap";
import { SkeletonBlock } from "./SkeletonPrimitives";

const { useState } = Spicetify.React;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = Array.from({ length: 7 }, (_, i) => i);
const WEEKDAYS_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_FULL = [
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
	"Sunday",
];

const TAB_OPTIONS: { value: ActivityTabId; label: string }[] = [
	{ value: "hour", label: "By hour" },
	{ value: "weekday", label: "By weekday" },
	{ value: "day", label: "By day" },
];

interface ActivitySectionProps {
	loading?: boolean;
	hourlyDistribution: number[];
	peakHour: number;
	weekdayDistribution: number[];
	peakWeekday: number;
	dailyPlayCounts?: Array<{ date: string; count: number }>;
	streak?: number;
	showStreak: boolean;
}

export function ActivitySection({
	loading = false,
	hourlyDistribution,
	peakHour,
	weekdayDistribution,
	peakWeekday,
	dailyPlayCounts,
	streak,
	showStreak,
}: ActivitySectionProps) {
	const prefs = getPreferences();
	const [activeTab, setActiveTab] = useState<ActivityTabId>(() => prefs.activityTab);

	if (loading) {
		return (
			<div className="section-card" aria-hidden="true">
				<header className="section-heading">
					<span className="section-kicker">Patterns</span>
					<h2 className="section-title">Activity</h2>
				</header>
				<div className="activity-chart">
					{HOURS.map((hr) => (
						<SkeletonBlock key={hr} className="activity-bar" height={`${20 + (hr % 6) * 10}%`} />
					))}
				</div>
			</div>
		);
	}

	const handleTabChange = (tab: ActivityTabId) => {
		setActiveTab(tab);
		setPreference("activityTab", tab);
	};

	let peakLabel: string | null = null;
	if (activeTab === "hour" && hourlyDistribution[peakHour] > 0) {
		peakLabel = formatHour(peakHour, prefs.use24HourTime);
	} else if (activeTab === "weekday" && weekdayDistribution[peakWeekday] > 0) {
		peakLabel = WEEKDAYS_FULL[peakWeekday];
	}

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
			<div className="activity-tabs">
				{TAB_OPTIONS.map((opt) => (
					<button
						type="button"
						key={opt.value}
						className={`activity-tab${activeTab === opt.value ? " active" : ""}`}
						onClick={() => handleTabChange(opt.value)}
					>
						{opt.label}
					</button>
				))}
			</div>
			{activeTab === "hour" && renderHourlyChart(hourlyDistribution, peakHour, prefs.use24HourTime)}
			{activeTab === "weekday" && renderWeekdayChart(weekdayDistribution, peakWeekday)}
			{activeTab === "day" && (
				<>
					<CalendarHeatmap dailyPlayCounts={dailyPlayCounts ?? []} />
					{showStreak && streak != null && streak > 0 && (
						<div className="streak-callout">
							You've listened on <strong>{streak} days</strong> in a row &middot; longest stretch
							this year.
						</div>
					)}
				</>
			)}
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
		<div className="weekday-chart">
			{DAYS.map((day) => {
				const val = weekdayDistribution[day];
				const heightPct = val > 0 ? Math.max((val / max) * 100, 5) : 0;
				const isPeak = day === peakWeekday && val > 0;
				return (
					<div key={day} className="weekday-column">
						<div className="weekday-bar-area">
							<Spicetify.ReactComponent.TooltipWrapper
								label={`${WEEKDAYS_FULL[day]}: ${val} plays`}
								placement="top"
							>
								<div
									className={`activity-bar${isPeak ? " peak" : ""}`}
									style={{ height: `${heightPct}%` }}
								/>
							</Spicetify.ReactComponent.TooltipWrapper>
						</div>
						<span className="weekday-label">{WEEKDAYS_ABBR[day]}</span>
					</div>
				);
			})}
		</div>
	);
}
