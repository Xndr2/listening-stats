import { providerRegistry } from "../../shared/stats/provider";
import type { Period, StatsResult } from "../../shared/types/stats";
import { formatEstimatedPayout, formatHour, formatNumber } from "../format";
import { ClockIcon } from "../icons";
import type { OverviewProviderKey } from "../preferences";
import { getPreferences, OVERVIEW_CARD_LABELS } from "../preferences";
import { SkeletonBlock } from "./SkeletonPrimitives";

const { useState, useEffect, useMemo } = Spicetify.React;

interface OverviewSectionProps {
	stats?: StatsResult | null;
	activePeriod: Period;
	loading?: boolean;
}

interface StatCardSpec {
	value: string;
	tooltip: string;
	sub?: string;
	accent?: string;
}

function OverviewHero({
	totalDuration,
	priorPeriodTotalDuration,
	totalPlays,
	uniqueArtistCount,
	periodLabel,
	periodKey,
}: {
	totalDuration: number;
	priorPeriodTotalDuration: number | undefined;
	totalPlays: number;
	uniqueArtistCount: number;
	periodLabel: string;
	periodKey: string;
}) {
	const reduce = useMemo(
		() =>
			typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches,
		[],
	);
	const [val, setVal] = useState<number>(reduce ? totalDuration : 0);

	useEffect(() => {
		if (reduce) {
			setVal(totalDuration);
			return;
		}
		let raf = 0;
		let t0 = 0;
		const step = (t: number) => {
			if (!t0) t0 = t;
			const k = Math.min(1, (t - t0) / 900);
			const e = 1 - (1 - k) ** 3;
			setVal(Math.round(totalDuration * e));
			if (k < 1) raf = requestAnimationFrame(step);
		};
		setVal(0);
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [periodKey, totalDuration, reduce]);

	const h = Math.floor(val / 3_600_000);
	const m = Math.floor((val % 3_600_000) / 60_000);

	const priorDur = priorPeriodTotalDuration;
	const showDelta = priorDur != null && priorDur > 0;
	const deltaPct = showDelta ? Math.round(((totalDuration - priorDur) / priorDur) * 100) : null;

	return (
		<div
			className="overview-hero-cell"
			style={{
				background:
					"radial-gradient(120% 140% at 0% 0%, rgba(var(--spice-rgb-button),.16), transparent 52%), var(--spice-card)",
				border: "1px solid rgba(var(--spice-rgb-misc, 255, 255, 255), 0.12)",
				borderRadius: 8,
				padding: 20,
				minHeight: 184,
				position: "relative",
				overflow: "hidden",
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					color: "var(--spice-text)",
					fontSize: 12,
					fontWeight: 600,
					letterSpacing: "0.06em",
					textTransform: "uppercase",
				}}
			>
				<span dangerouslySetInnerHTML={{ __html: ClockIcon }} />
				<span>Total time - {periodLabel}</span>
			</div>

			<div
				style={{
					display: "flex",
					alignItems: "baseline",
					gap: 14,
					marginTop: "auto",
				}}
			>
				<span
					data-testid="hero-hours"
					style={{
						fontSize: 64,
						fontWeight: 800,
						letterSpacing: "-0.04em",
						lineHeight: 1,
						fontVariantNumeric: "tabular-nums",
					}}
				>
					{h}
				</span>
				<span style={{ fontSize: 24, fontWeight: 600, color: "rgba(var(--spice-rgb-text), 0.6)" }}>
					h
				</span>
				<span
					data-testid="hero-minutes"
					style={{
						fontSize: 36,
						fontWeight: 700,
						letterSpacing: "-0.03em",
						fontVariantNumeric: "tabular-nums",
					}}
				>
					{m.toString().padStart(2, "0")}
				</span>
				<span style={{ fontSize: 18, fontWeight: 600, color: "rgba(var(--spice-rgb-text), 0.6)" }}>
					m
				</span>
				{showDelta && deltaPct != null && (
					<span
						data-testid="hero-delta"
						style={{
							marginLeft: "auto",
							fontSize: 12,
							color: "var(--spice-button)",
							fontWeight: 600,
							display: "inline-flex",
							alignItems: "center",
							gap: 4,
						}}
					>
						{deltaPct >= 0 ? "↑" : "↓"} {Math.abs(deltaPct)}% vs prev
					</span>
				)}
			</div>

			<div
				data-testid="hero-sublabel"
				style={{
					marginTop: 14,
					display: "flex",
					alignItems: "center",
					gap: 6,
					fontSize: 12,
					color: "rgba(var(--spice-rgb-text), 0.55)",
				}}
			>
				<span>{formatNumber(totalPlays)} plays · </span>
				<span>{formatNumber(uniqueArtistCount)} artists</span>
			</div>
		</div>
	);
}

function OverviewSectionSkeleton() {
	return (
		<div className="overview-section" aria-hidden="true">
			<SkeletonBlock className="overview-hero-cell" height={184} />
			<div className="overview-right-block">
				{Array.from({ length: 4 }).map((_, i) => (
					<SkeletonBlock key={i} className="overview-card" height={60} />
				))}
			</div>
			<div className="overview-bottom-row">
				{Array.from({ length: 3 }).map((_, i) => (
					<SkeletonBlock key={i} className="overview-card" height={60} />
				))}
			</div>
		</div>
	);
}

export default function OverviewSection({
	stats,
	activePeriod,
	loading = false,
}: OverviewSectionProps) {
	if (loading || !stats) return <OverviewSectionSkeleton />;
	const prefs = getPreferences();
	const activeId = providerRegistry.getActive()?.getProviderInfo().id ?? "local";
	const providerKey: OverviewProviderKey = activeId === "statsfm" ? "statsfm" : "local";

	const isStatsFm = providerKey === "statsfm";

	const statCardsById: Record<string, StatCardSpec | undefined> = {
		tracks: {
			value: formatNumber(stats.totalPlays),
			tooltip: "Total number of tracks played in the selected period",
			sub: "plays",
		},
		"unique-artists": {
			value: formatNumber(stats.uniqueArtistCount),
			tooltip: "Number of distinct artists played in the selected period",
		},
		streak: isStatsFm
			? undefined
			: {
					value: stats.streak != null && stats.streak > 0 ? `${stats.streak}d` : "-",
					tooltip: "Consecutive calendar days with at least one play (local timezone)",
					accent: stats.streak != null && stats.streak > 0 ? "var(--spice-button)" : undefined,
				},
		"new-artists": {
			value: formatNumber(stats.newArtistCount ?? 0),
			tooltip:
				"Artists you played in this period that you didn't play in the previous period (or no plays in the prior window)",
			sub: "discovered",
		},
		"peak-hour": {
			value: formatHour(stats.peakHour, prefs.use24HourTime),
			tooltip: "Your most active listening hour in this period",
			sub: "most active",
		},
		"skip-rate": isStatsFm
			? undefined
			: {
					value: `${Math.round(stats.skipRate * 100)}%`,
					tooltip: "Percentage of tracks skipped before the play threshold",
				},
		"est-payout": {
			value: formatEstimatedPayout(stats.totalPlays),
			tooltip: "Estimated streaming payout at $0.004 per play (approximate only)",
			sub: "indie scale",
		},
		"top-genre": {
			value: stats.topGenres[0]?.genre ?? "-",
			tooltip: "Your most-played genre in this period",
		},
		"listening-days": {
			value:
				stats.listeningDays != null && stats.listeningDays > 0
					? formatNumber(stats.listeningDays)
					: "-",
			tooltip: "Number of days with at least one play in the selected period",
		},
	};

	const order = prefs.overviewOrder[providerKey];
	const visible = order.filter(
		(id) => statCardsById[id] !== undefined && !prefs.hiddenSections.includes(id),
	);
	const top4 = visible.slice(0, 4);
	const bottom3 = visible.slice(4, 7);
	const topColumns = Math.max(1, Math.min(2, top4.length));
	const bottomColumns = Math.max(1, Math.min(3, bottom3.length));

	const renderTile = (id: string) => {
		const card = statCardsById[id];
		if (!card) return null;
		const label = OVERVIEW_CARD_LABELS[id] ?? id;
		return (
			<Spicetify.ReactComponent.TooltipWrapper key={id} label={card.tooltip}>
				<div className="overview-card" data-card-id={id}>
					<div className="overview-card-label">{label}</div>
					<div className="overview-card-row">
						<span
							className="overview-card-value"
							style={card.accent ? { color: card.accent } : undefined}
						>
							{card.value}
						</span>
						{card.sub && <span className="overview-card-sub">{card.sub}</span>}
					</div>
				</div>
			</Spicetify.ReactComponent.TooltipWrapper>
		);
	};

	const hasBottomRow = bottom3.length > 0;

	return (
		<div className={`overview-section${hasBottomRow ? "" : " overview-section--compact"}`}>
			<OverviewHero
				totalDuration={stats.totalDuration}
				priorPeriodTotalDuration={stats.priorPeriodTotalDuration}
				totalPlays={stats.totalPlays}
				uniqueArtistCount={stats.uniqueArtistCount}
				periodLabel={activePeriod.label}
				periodKey={activePeriod.id}
			/>
			{top4.length > 0 && (
				<div
					className="overview-right-block"
					style={{ gridTemplateColumns: `repeat(${topColumns}, minmax(0, 1fr))` }}
				>
					{top4.map(renderTile)}
				</div>
			)}
			{hasBottomRow && (
				<div
					className="overview-bottom-row"
					style={{ gridTemplateColumns: `repeat(${bottomColumns}, minmax(0, 1fr))` }}
				>
					{bottom3.map(renderTile)}
				</div>
			)}
		</div>
	);
}
