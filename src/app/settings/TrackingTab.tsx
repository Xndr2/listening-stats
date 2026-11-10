import { useEffect, useState } from "react";
import { type TrackerHealth, V3_KEYS } from "../../shared/constants/storage-keys";
import { isConnected } from "../../shared/providers/registry";
import { formatAgo } from "../format";
import { useSetting } from "../hooks/useSetting";
import { ChoiceRow, Row, Section, ToggleRow } from "./controls";

function readHealth(): TrackerHealth | null {
	try {
		const raw = localStorage.getItem(V3_KEYS.TRACKER_HEALTH);
		return raw ? (JSON.parse(raw) as TrackerHealth) : null;
	} catch {
		return null;
	}
}

function TrackerStatus() {
	const [paused] = useSetting("trackingPaused");
	const [h, setH] = useState(readHealth);
	useEffect(() => {
		const t = setInterval(() => setH(readHealth()), 5000);
		return () => clearInterval(t);
	}, []);
	let text: string;
	if (paused) text = "Paused. Nothing is being recorded.";
	else if (!h) text = "Starting up…";
	else if (h.lastError) text = `Last write failed: ${h.lastError}`;
	else if (h.privateSession) text = "Private session is on, so plays aren't recorded right now.";
	else
		text = h.lastWriteAt
			? `Working. Last play saved ${formatAgo(h.lastWriteAt)}.`
			: "Working. Waiting for the first play to count.";
	return <p className={`ls-set-status ${h?.lastError ? "is-err" : ""}`}>{text}</p>;
}

/** Where a track of `durationMs` starts to count; mirrors the tracker (90% always counts). */
export function countsAt(durationMs: number, mode: "seconds" | "percent", ms: number, pct: number): number {
	const threshold = mode === "percent" ? (durationMs * pct) / 100 : ms;
	return Math.min(threshold, durationMs * 0.9);
}

function Slider({
	value,
	min,
	max,
	step,
	ticks,
	format,
	label,
	onChange,
}: {
	value: number;
	min: number;
	max: number;
	step: number;
	ticks: number[];
	format: (v: number) => string;
	label: string;
	onChange: (v: number) => void;
}) {
	const pos = (v: number) => `${((v - min) / (max - min)) * 100}%`;
	return (
		<div className="ls-slider">
			<div className="ls-slider-top">
				<input
					className="ls-range"
					type="range"
					min={min}
					max={max}
					step={step}
					value={value}
					aria-label={label}
					aria-valuetext={format(value)}
					onChange={(e) => onChange(Number(e.target.value))}
				/>
				<output className="ls-slider-value ls-num">{format(value)}</output>
			</div>
			<div className="ls-slider-ticks" aria-hidden="true">
				{ticks.map((t) => (
					<button
						key={t}
						type="button"
						tabIndex={-1}
						className={t === value ? "is-on" : ""}
						style={{ left: pos(t) }}
						onClick={() => onChange(t)}
					>
						{format(t)}
					</button>
				))}
			</div>
		</div>
	);
}

const EXAMPLES = [
	{ label: "Short song", ms: 95_000 },
	{ label: "Average song", ms: 210_000 },
	{ label: "Long song", ms: 420_000 },
];

const clock = (ms: number) => {
	const s = Math.round(ms / 1000);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Three example tracks with a marker where each one starts to count. */
function ThresholdPreview({ at }: { at: (durationMs: number) => number }) {
	return (
		<div className="ls-thresh">
			{EXAMPLES.map((x) => {
				const t = at(x.ms);
				return (
					<div key={x.label} className="ls-thresh-row">
						<span className="ls-thresh-name">
							{x.label} <span className="ls-muted ls-num">{clock(x.ms)}</span>
						</span>
						<span className="ls-thresh-bar" aria-hidden="true">
							<span className="ls-thresh-fill" style={{ width: `${(t / x.ms) * 100}%` }} />
						</span>
						<span className="ls-thresh-at ls-num">{t === 0 ? "counts right away" : `counts at ${clock(t)}`}</span>
					</div>
				);
			})}
		</div>
	);
}

export function TrackingTab() {
	const [mode, setMode] = useSetting("thresholdMode");
	const [ms, setMs] = useSetting("thresholdMs");
	const [pct, setPct] = useSetting("thresholdPercent");
	return (
		<>
			<Section title="Recording" description="These apply to local tracking on this device.">
				<TrackerStatus />
				<ToggleRow
					name="trackingPaused"
					invert
					label="Record my plays"
					hint="Turn off to pause tracking without losing anything."
				/>
				<ToggleRow
					name="respectPrivateSession"
					label="Skip private sessions"
					hint="Plays during a Spotify private session aren't recorded."
				/>
				<ToggleRow name="excludePodcasts" label="Music only" hint="Leave out podcasts and audiobooks." />
				<ToggleRow
					name="skipRepeats"
					label="Count a repeated song once"
					hint="Playing the same track again right after doesn't add a play."
				/>
			</Section>
			<Section
				title="Genres"
				description="Genres for local stats come from looking up your artists. Spotify answers those lookups slowly, so stats.fm's public search can fill in. It only receives artist names, never your account."
			>
				<ToggleRow
					name="genresViaStatsFm"
					label="Look up genres through stats.fm"
					hint={isConnected("statsfm") ? "Already on because stats.fm is connected." : "Off: only Spotify is asked."}
				/>
			</Section>
			<Section
				title="When a play counts"
				description="A track also counts once you've heard 90% of it, so short songs aren't missed."
			>
				<ChoiceRow
					label="Measure by"
					value={mode}
					onChange={setMode}
					options={[
						{ value: "seconds", label: "Seconds" },
						{ value: "percent", label: "Percent of track" },
					]}
				/>
				{mode === "seconds" ? (
					<Row
						label="Minimum listening time"
						hint="How long you have to listen before a track counts."
						control={
							<Slider
								value={ms / 1000}
								min={0}
								max={60}
								step={5}
								ticks={[0, 15, 30, 45, 60]}
								format={(v) => (v === 0 ? "Any" : `${v} s`)}
								label="Seconds before a play counts"
								onChange={(v) => setMs(v * 1000)}
							/>
						}
					/>
				) : (
					<Row
						label="Minimum share of the track"
						hint="How much of a track you have to hear before it counts."
						control={
							<Slider
								value={pct}
								min={5}
								max={90}
								step={5}
								ticks={[5, 25, 50, 75, 90]}
								format={(v) => `${v}%`}
								label="Percent of the track before a play counts"
								onChange={setPct}
							/>
						}
					/>
				)}
				<ThresholdPreview at={(d) => countsAt(d, mode, ms, pct)} />
			</Section>
		</>
	);
}
