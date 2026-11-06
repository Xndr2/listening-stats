/**
 * Listening rhythm: when in the day, which weekday, which days over the last
 * half year, and the genre mix. Each is its own widget with its own query,
 * so a slow heatmap doesn't hold up the hour chart.
 */

import { useState } from "react";
import { enrichArtists, statsFmGenresAllowed } from "../../../shared/enrichment/artists";
import { supports } from "../../../shared/providers/types";
import { setSetting } from "../../../shared/settings/registry";
import { SkeletonLines, Widget } from "../../components/Widget/Widget";
import { formatHour, formatNumber, formatPercent, formatShortTime, WEEKDAYS_LONG, WEEKDAYS_SHORT } from "../../format";
import { useSetting } from "../../hooks/useSetting";
import { invalidate } from "../../query/cache";
import { usePeriodQuery } from "../../query/useProviderQuery";
import { useQuery } from "../../query/useQuery";
import { useApp } from "../../state";
import "./Rhythm.css";

function Bars({
	values,
	labels,
	describe,
	tickLabels,
}: {
	values: number[];
	labels: string[];
	describe: (i: number) => string;
	tickLabels?: Array<[number, string]>;
}) {
	const max = Math.max(1, ...values);
	const peak = values.indexOf(Math.max(...values));
	return (
		<div className="ls-bars-wrap">
			<ul className="ls-bars">
				{values.map((v, i) => (
					<li key={labels[i]} className="ls-bar-col" data-tip={describe(i)} aria-label={describe(i)}>
						<span
							className={`ls-bar ${i === peak && v > 0 ? "is-peak" : ""}`}
							style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
						/>
					</li>
				))}
			</ul>
			<div className="ls-bar-ticks" aria-hidden="true">
				{tickLabels
					? tickLabels.map(([i, l]) => (
							<span key={i} style={{ left: `${((i + 0.5) / values.length) * 100}%` }}>
								{l}
							</span>
						))
					: labels.map((l, i) => (
							<span key={l} style={{ left: `${((i + 0.5) / values.length) * 100}%` }}>
								{l}
							</span>
						))}
			</div>
		</div>
	);
}

export function ByHour() {
	const q = usePeriodQuery("hourly");
	const [use24h] = useSetting("use24HourTime");
	if (!q.supported) return null;
	const peak = q.data?.counts.some((c) => c > 0) ? q.data.counts.indexOf(Math.max(...q.data.counts)) : -1;
	return (
		<Widget
			id="by-hour"
			title="By hour"
			query={q}
			aside={peak >= 0 && <span>busiest at {formatHour(peak, use24h)}</span>}
			skeleton={<div className="ls-skel" style={{ height: 96 }} />}
		>
			{(d) => (
				<>
					<Bars
						values={d.counts}
						labels={d.counts.map((_, i) => formatHour(i, use24h))}
						describe={(i) => `${formatHour(i, use24h)}: ${formatNumber(d.counts[i])} plays`}
						tickLabels={[
							[0, formatHour(0, use24h)],
							[12, formatHour(12, use24h)],
							[23, formatHour(23, use24h)],
						]}
					/>
					{d.partial && <p className="ls-note">Based on your most recent scrobbles only.</p>}
				</>
			)}
		</Widget>
	);
}

export function ByWeekday() {
	const q = usePeriodQuery("weekday");
	if (!q.supported) return null;
	return (
		<Widget id="by-weekday" title="By weekday" query={q} skeleton={<div className="ls-skel" style={{ height: 96 }} />}>
			{(d) => (
				<Bars
					values={d.counts}
					labels={WEEKDAYS_SHORT}
					describe={(i) =>
						`${WEEKDAYS_LONG[i]}: ${formatNumber(d.counts[i])} plays${d.durationMs[i] ? `, ${formatShortTime(d.durationMs[i])}` : ""}`
					}
				/>
			)}
		</Widget>
	);
}

const HEATMAP_WEEKS = 26;

export function Heatmap() {
	const { provider, source } = useApp();
	const [fit] = useSetting("heatmapFit");
	const supported = supports(provider, "daily");
	// Today's weekday decides how many days the last column has; 26 full weeks back from Monday.
	const today = new Date();
	const todayIdx = (today.getDay() + 6) % 7;
	const days = (HEATMAP_WEEKS - 1) * 7 + todayIdx + 1;
	const key = supported ? `${source}:daily:${days}:${today.toDateString()}` : null;
	const q = useQuery(key, (signal) => (provider.daily ? provider.daily({ days, signal }) : Promise.resolve([])));
	if (!supported) return null;
	return (
		<Widget
			id="heatmap"
			title={`Last ${HEATMAP_WEEKS} weeks`}
			query={q}
			skeleton={<div className="ls-skel" style={{ height: 104 }} />}
		>
			{(d) => {
				const max = Math.max(1, ...d.map((x) => x.count));
				const active = d.filter((x) => x.count > 0).length;
				const unknown = d.filter((x) => x.unknown).length;
				return (
					<>
						<div
							className={`ls-heat ${fit ? "is-fit" : ""}`}
							role="img"
							aria-label={`${active} of the last ${d.length} days had music`}
						>
							{d.map((x) => {
								const level = x.unknown ? "unknown" : x.count === 0 ? 0 : Math.ceil((x.count / max) * 4);
								return (
									<span
										key={x.date}
										className="ls-heat-cell"
										data-level={level}
										data-tip={x.unknown ? `${x.date}: not loaded` : `${x.date}: ${formatNumber(x.count)} plays`}
									/>
								);
							})}
						</div>
						<p className="ls-note">
							{active} of {d.length - unknown} days had music
							{unknown > 0 && `. The oldest ${unknown} days aren't loaded from ${provider.name}.`}
						</p>
					</>
				);
			}}
		</Widget>
	);
}

/** Empty genre panel for local data: explains why, and offers to look them up now. */
function GenresMissing() {
	const { providerId } = useApp();
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState<string | null>(null);
	if (providerId !== "local") return <p className="ls-note">No genre data for this period.</p>;
	const allowed = statsFmGenresAllowed();
	const run = async () => {
		setBusy(true);
		if (!allowed) setSetting("genresViaStatsFm", true);
		try {
			const n = await enrichArtists();
			invalidate((k) => k.startsWith("local:"));
			setResult(n ? null : "Nothing new found. Spotify may be busy; it tries again on its own every half hour.");
		} catch {
			setResult("The lookup failed. It tries again on its own every half hour.");
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className="ls-note ls-genres-missing">
			<p>
				Genres come from looking up your artists. Spotify is slow to answer those lookups, so this can take a while.
				{!allowed && " stats.fm can do it faster; it only receives artist names."}
			</p>
			<button type="button" className="ls-btn-secondary" disabled={busy} onClick={() => void run()}>
				{busy ? "Looking up…" : allowed ? "Look up genres now" : "Look up with stats.fm"}
			</button>
			{result && <p>{result}</p>}
		</div>
	);
}

export function GenreMix() {
	const q = usePeriodQuery("topGenres", 6);
	if (!q.supported) return null;
	return (
		<Widget id="genre-mix" title="Genre mix" query={q} skeleton={<SkeletonLines rows={4} height={18} />}>
			{(genres) =>
				genres.length === 0 ? (
					<GenresMissing />
				) : (
					<>
						<div className="ls-mix" aria-hidden="true">
							{/* Shares are of all genres; scale to the shown ones so the bar is full (flex-grow sums under 1 leave a gap). */}
							{genres.map((g, i) => (
								<span
									key={g.name}
									style={{ flexGrow: g.share / (genres.reduce((t, x) => t + x.share, 0) || 1), opacity: 1 - i * 0.14 }}
								/>
							))}
						</div>
						<ul className="ls-mix-list">
							{genres.map((g) => (
								<li key={g.name}>
									<span>{g.name}</span>
									<span className="ls-num ls-muted">{formatPercent(g.share)}</span>
								</li>
							))}
						</ul>
					</>
				)
			}
		</Widget>
	);
}
