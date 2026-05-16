import type { Period } from "../../shared/types/stats";
import { SkeletonBlock, SkeletonTextLine } from "./SkeletonPrimitives";

interface DailyPoint {
	date: string;
	count: number;
}

interface ConsistencySectionProps {
	loading?: boolean;
	totalPlays: number;
	totalDuration: number;
	listeningDays?: number;
	dailyPlayCounts?: DailyPoint[];
	streak?: number;
	activePeriod: Period;
	activeProviderId?: string;
}

interface MetricCardProps {
	label: string;
	value: string | number;
	sub: string;
	tooltip: string;
	accent?: boolean;
}

function ymd(ts: number): string {
	return new Date(ts).toISOString().slice(0, 10);
}

function buildWindow(points: DailyPoint[], period: Period): DailyPoint[] {
	const { start, end } = period.getBoundaries();
	if (end === Number.MAX_SAFE_INTEGER) {
		return points.slice(-30);
	}
	const endDayTs = end - 1;
	const startDay = ymd(start);
	const endDay = ymd(endDayTs);
	return points.filter((p) => p.date >= startDay && p.date <= endDay);
}

function computeLongestGap(points: DailyPoint[]): number {
	let longest = 0;
	let current = 0;
	for (const p of points) {
		if (p.count > 0) {
			current = 0;
			continue;
		}
		current += 1;
		longest = Math.max(longest, current);
	}
	return longest;
}

function formatDayLabel(date: string): string {
	let ts = new Date(date);
	if (!Number.isFinite(ts.getTime())) {
		const dayOnly = date.slice(0, 10);
		ts = new Date(`${dayOnly}T00:00:00`);
	}
	if (!Number.isFinite(ts.getTime())) return date.slice(0, 10);
	return ts.toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

export function ConsistencySection({
	loading = false,
	totalPlays,
	totalDuration,
	listeningDays,
	dailyPlayCounts,
	streak,
	activePeriod,
	activeProviderId = "statsfm",
}: ConsistencySectionProps) {
	if (loading) {
		return (
			<div className="section-card consistency-section" aria-hidden="true">
				<header className="section-heading">
					<span className="section-kicker">Patterns</span>
					<h2 className="section-title">Consistency</h2>
				</header>
				<div className="consistency-grid">
					{Array.from({ length: 4 }).map((_, i) => (
						<div key={i} className="consistency-metric">
							<SkeletonTextLine width="55%" />
							<SkeletonBlock width="45%" height={24} style={{ marginTop: 8 }} />
							<SkeletonTextLine width="70%" />
						</div>
					))}
				</div>
			</div>
		);
	}
	const points = buildWindow(dailyPlayCounts ?? [], activePeriod);
	const totalDays = points.length;
	const activeDays = points.length > 0 ? points.filter((p) => p.count > 0).length : (listeningDays ?? 0);
	const avgPlaysPerActiveDay = activeDays > 0 ? totalPlays / activeDays : 0;
	const avgMinutesPerActiveDay = activeDays > 0 ? totalDuration / 60000 / activeDays : 0;
	const longestGap = computeLongestGap(points);
	const coveragePct = totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0;
	const trend = points.slice(-14);
	const trendMax = Math.max(...trend.map((p) => p.count), 1);
	const isTodayPeriod = activePeriod.id === "today" || activePeriod.id === "sfm-today";
	const isLocalProvider = activeProviderId === "local";
	const Tooltip = Spicetify.ReactComponent.TooltipWrapper;

	const MetricCard = ({ label, value, sub, tooltip, accent }: MetricCardProps) => (
		<Tooltip label={tooltip}>
			<div className={`consistency-metric${accent ? " consistency-metric--accent" : ""}`}>
				<div className="consistency-metric-label">{label}</div>
				<div className="consistency-metric-value">{value}</div>
				<div className="consistency-metric-sub">{sub}</div>
			</div>
		</Tooltip>
	);

	return (
		<div className="section-card consistency-section">
			<header className="section-heading">
				<span className="section-kicker">Patterns</span>
				<h2 className="section-title">Consistency</h2>
			</header>
			<div className="consistency-grid">
				<MetricCard
					label="Listening days"
					value={activeDays}
					sub={`out of ${totalDays || activeDays} days`}
					tooltip="Number of days in this period with at least one stream."
				/>
				<MetricCard
					label="Avg plays / active day"
					value={Math.round(avgPlaysPerActiveDay)}
					sub="streams when active"
					tooltip="Average stream count only across days where you listened."
				/>
				<MetricCard
					label="Avg minutes / active day"
					value={Math.round(avgMinutesPerActiveDay)}
					sub="listening time"
					tooltip="Average listening duration in minutes across active days."
				/>
				<MetricCard
					label="Current streak"
					value={streak != null && streak > 0 ? `${streak}d` : "-"}
					sub="consecutive days"
					tooltip="Consecutive calendar days with at least one play (local timezone)."
				/>
			</div>
			{!isTodayPeriod && (
				<div className="consistency-footer">
					<Tooltip label={`You listened on ${activeDays} of ${totalDays || activeDays} days in this period.`}>
						<div className="consistency-coverage">
							<div className="consistency-coverage-label">Active-day coverage</div>
							<div className="consistency-coverage-row">
								<div className="consistency-coverage-track">
									<div className="consistency-coverage-fill" style={{ width: `${coveragePct}%` }} />
								</div>
								<span>{coveragePct}%</span>
							</div>
						</div>
					</Tooltip>

					{isLocalProvider ? (
						<div className="consistency-week-split">
							<div className="consistency-coverage-label">Weekday vs weekend</div>
							{(() => {
								const activePoints = points.filter((p) => p.count > 0);
								const weekdayActive = activePoints.filter((p) => {
									const day = new Date(`${p.date}T00:00:00`).getDay();
									return day >= 1 && day <= 5;
								}).length;
								const weekendActive = activePoints.length - weekdayActive;
								const totalActive = Math.max(weekdayActive + weekendActive, 1);
								const weekdayPct = Math.round((weekdayActive / totalActive) * 100);
								const weekendPct = 100 - weekdayPct;
								return (
									<div className="consistency-week-split-row">
										<Tooltip label={`${weekdayActive} active weekdays (${weekdayPct}%)`}>
											<div className="consistency-week-chip">
												<span>Weekdays</span>
												<strong>{weekdayPct}%</strong>
											</div>
										</Tooltip>
										<Tooltip label={`${weekendActive} active weekend days (${weekendPct}%)`}>
											<div className="consistency-week-chip">
												<span>Weekend</span>
												<strong>{weekendPct}%</strong>
											</div>
										</Tooltip>
									</div>
								);
							})()}
						</div>
					) : (
						trend.length > 0 && (
							<div className="consistency-sparkline">
								<div className="consistency-coverage-label">Last 14 days</div>
								<div className="consistency-sparkline-bars">
									{trend.map((p) => {
										const isPeak = p.count > 0 && p.count === trendMax;
										return (
											<Tooltip key={p.date} label={`${formatDayLabel(p.date)}: ${p.count} plays`} placement="top">
												<div className="consistency-sparkline-bar-wrap">
													<div
														className={`consistency-sparkline-bar${isPeak ? " peak" : ""}`}
														style={{
															height: `${Math.max((p.count / trendMax) * 100, p.count > 0 ? 8 : 2)}%`,
														}}
													/>
												</div>
											</Tooltip>
										);
									})}
								</div>
							</div>
						)
					)}
				</div>
			)}
		</div>
	);
}
