/**
 * The top of the dashboard, laid out like the v3 concept: a wide card with
 * the period's listening time (or plays, for sources without time) and the
 * change against the previous period, then a row of stat cards. Which cards
 * appear depends on what the source knows; nothing is shown as a fake zero.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { PERIOD_LABELS } from "../../../shared/providers/periods";
import type { Buckets, Summary } from "../../../shared/providers/types";
import { Icon } from "../../components/Icon";
import { describeError } from "../../components/Widget/Widget";
import { formatDelta, formatHour, formatNumber, formatPercent, splitHours } from "../../format";
import { useSetting } from "../../hooks/useSetting";
import { usePeriodQuery } from "../../query/useProviderQuery";
import { useApp } from "../../state";
import "./Overview.css";

interface Tile {
	id: string;
	label: string;
	value: string;
	detail: string;
}

/** Rough industry average per stream; shown as an estimate. */
const PAYOUT_PER_STREAM = 0.004;

function tiles(s: Summary, hours: Buckets | undefined, use24h: boolean): Tile[] {
	const out: Tile[] = [];
	if (s.durationMs !== undefined)
		out.push({ id: "plays", label: "Plays", value: formatNumber(s.plays), detail: "tracks played" });
	if (s.uniqueArtists !== undefined)
		out.push({
			id: "artists",
			label: "Artists",
			value: formatNumber(s.uniqueArtists),
			detail: s.newArtists ? `${formatNumber(s.newArtists)} new to you` : "different artists",
		});
	if (s.uniqueTracks !== undefined)
		out.push({ id: "tracks", label: "Tracks", value: formatNumber(s.uniqueTracks), detail: "different songs" });
	if (s.streak)
		out.push({
			id: "streak",
			label: "Streak",
			value: formatNumber(s.streak),
			detail: s.streak === 1 ? "day" : "days in a row",
		});
	if (hours?.counts.some((c) => c > 0)) {
		const peak = hours.counts.indexOf(Math.max(...hours.counts));
		out.push({ id: "peak", label: "Peak hour", value: formatHour(peak, use24h), detail: "most active" });
	}
	if (s.topGenre)
		out.push({
			id: "genre",
			label: "Top genre",
			value: s.topGenre.name,
			detail: `${formatPercent(s.topGenre.share)} of plays`,
		});
	if (s.skipRate !== undefined && s.plays > 0)
		out.push({ id: "skips", label: "Skipped", value: formatPercent(s.skipRate), detail: "of everything started" });
	if (s.plays > 0)
		out.push({
			id: "payout",
			label: "Paid to artists",
			value: `≈ $${(s.plays * PAYOUT_PER_STREAM).toFixed(2)}`,
			detail: "rough estimate",
		});
	return out;
}

const MIN_TILE = 150;

/**
 * Grid columns for `cells` grid cells (the hero counts as two) when `maxCols`
 * fit, and how many columns the hero spans. In fit mode it's one row and the
 * rest is cut off. Otherwise the rows are kept even: 8 cells in a 5-column
 * space become 4 + 4 instead of 5 + 3. When even rows would still leave a
 * hole, the hero gets a row to itself if the cards then divide evenly.
 */
export function tileLayout(cells: number, maxCols: number, fit: boolean): { cols: number; hero: number } {
	const max = Math.max(2, maxCols);
	if (fit || cells <= max) return { cols: Math.min(cells, max), hero: 2 };
	const rows = Math.ceil(cells / max);
	const cols = Math.max(2, Math.ceil(cells / rows));
	if (rows * cols === cells) return { cols, hero: 2 };
	const cards = cells - 2;
	for (let c = max; c >= 2; c--) {
		if (cards % c === 0 && 1 + cards / c <= Math.ceil(cells / cols)) return { cols: c, hero: c };
	}
	return { cols, hero: 2 };
}

function useTileColumns(cells: number) {
	const ref = useRef<HTMLDivElement>(null);
	const [layout, setLayout] = useState<{ cols: number; hero: number }>();
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const measure = () => {
			const css = getComputedStyle(el);
			const gap = Number.parseFloat(css.columnGap) || 0;
			const max = Math.floor((el.clientWidth + gap) / (MIN_TILE + gap));
			const next = tileLayout(cells, max, css.getPropertyValue("--ls-fit").trim() === "1");
			setLayout((old) => (old?.cols === next.cols && old.hero === next.hero ? old : next));
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, [cells]);
	return {
		ref,
		style: layout
			? ({
					gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
					"--ls-hero-span": layout.hero,
				} as React.CSSProperties)
			: undefined,
	};
}

function Hero({ s }: { s: Summary }) {
	const { periodId } = useApp();
	const period = PERIOD_LABELS[periodId];
	const days = s.activeDays !== undefined && s.windowDays > 1 ? `${s.activeDays} of ${s.windowDays} days` : null;
	if (s.durationMs === undefined) {
		return (
			<div className="ls-tile ls-hero-tile">
				<span className="ls-tile-label">Plays · {period}</span>
				<span className="ls-hero-value ls-num">{formatNumber(s.plays)}</span>
				{days && <span className="ls-tile-detail">{days}</span>}
			</div>
		);
	}
	const { h, m } = splitHours(s.durationMs);
	const delta = formatDelta(s.durationMs, s.previousDurationMs, periodId);
	return (
		<div className="ls-tile ls-hero-tile">
			<span className="ls-tile-label">Listening time · {period}</span>
			<span className="ls-hero-value ls-num">
				{h > 0 && (
					<>
						{formatNumber(h)}
						<span className="ls-hero-unit">h</span>
					</>
				)}
				{m}
				<span className="ls-hero-unit">m</span>
			</span>
			<span className="ls-hero-meta">
				{delta && (
					<span className={`ls-delta ${delta.up ? "is-up" : "is-down"}`}>
						<Icon name={delta.up ? "chartUp" : "chartDown"} size={14} />
						{delta.text}
					</span>
				)}
				{days && <span className="ls-tile-detail">{days}</span>}
			</span>
		</div>
	);
}

export function Overview() {
	const summary = usePeriodQuery("summary");
	const hourly = usePeriodQuery("hourly");
	const [use24h] = useSetting("use24HourTime");
	const s = summary.data;
	const list = s && s.plays > 0 ? tiles(s, hourly.data, use24h) : [];
	const grid = useTileColumns(2 + (s && s.plays === 0 ? 3 : list.length));
	const failed = summary.error !== undefined && !s;
	if (failed) {
		return (
			<section className="ls-overview" aria-label="Overview">
				<div className="ls-widget-msg" role="status">
					<Icon name="warning" />
					<span>{describeError(summary.error)}</span>
					<button type="button" className="ls-link" onClick={summary.retry}>
						Retry
					</button>
				</div>
			</section>
		);
	}
	if (!s) {
		return (
			<section className="ls-overview" aria-label="Overview" aria-busy="true">
				<div className="ls-tiles">
					<div className="ls-tile ls-hero-tile ls-skel" />
					{Array.from({ length: 4 }, (_, i) => (
						<div key={i} className="ls-tile ls-skel" />
					))}
				</div>
			</section>
		);
	}
	return (
		<section className="ls-overview" aria-label="Overview">
			<div className="ls-tiles" ref={grid.ref} style={grid.style}>
				<Hero s={s} />
				{s.plays === 0 ? (
					<div className="ls-tile ls-tile-empty">
						<span className="ls-tile-detail">
							Nothing here yet for this period. Play something, or pick a longer period above.
						</span>
					</div>
				) : (
					list.map((t) => (
						<div key={t.id} className="ls-tile">
							<span className="ls-tile-label">{t.label}</span>
							<span className="ls-tile-value ls-num" data-tip={t.value} data-tip-overflow>
								{t.value}
							</span>
							<span className="ls-tile-detail">{t.detail}</span>
						</div>
					))
				)}
			</div>
		</section>
	);
}
