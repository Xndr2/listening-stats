import {
	getPlayThreshold,
	getPlayThresholdPercent,
	getThresholdMode,
	isSkipRepeatsEnabled,
	isTrackingPaused,
	setPlayThreshold,
	setPlayThresholdPercent,
	setSkipRepeatsEnabled,
	setThresholdMode,
	setTrackingPaused,
} from "../../../extension/tracker/settings";
import { EVENTS } from "../../../shared/constants/events";
import { LS_KEYS } from "../../../shared/constants/storage-keys";
import { Toggle } from "../spicetify-ui";
import { ThresholdSlider } from "../ThresholdSlider";

const SECONDS_PRESETS = [0, 15, 30, 45, 60];
const PERCENT_PRESETS = [0, 25, 50, 75, 100];

const { useState } = Spicetify.React;

function isLoggingEnabled(): boolean {
	return localStorage.getItem(LS_KEYS.LOGGING) === "true";
}

function setLoggingEnabled(enabled: boolean): void {
	localStorage.setItem(LS_KEYS.LOGGING, String(enabled));
}

interface TrackingTabProps {
	onPrefsChanged: () => void;
}

export function TrackingTab({ onPrefsChanged }: TrackingTabProps) {
	const [paused, setPaused] = useState(() => isTrackingPaused());
	const [skipRepeats, setSkipRepeats] = useState(() => isSkipRepeatsEnabled());
	const [percentMode, setPercentMode] = useState(() => getThresholdMode() === "percent");
	const [thresholdSec, setThresholdSec] = useState(() => getPlayThreshold() / 1000);
	const [thresholdPct, setThresholdPct] = useState(() => getPlayThresholdPercent());
	const [logging, setLogging] = useState(() => isLoggingEnabled());

	const handlePause = (val: boolean) => {
		setPaused(val);
		setTrackingPaused(val);
		window.dispatchEvent(new CustomEvent(val ? EVENTS.TRACKING_PAUSED : EVENTS.TRACKING_RESUMED));
		onPrefsChanged();
	};

	const handleSkipRepeats = (val: boolean) => {
		setSkipRepeats(val);
		setSkipRepeatsEnabled(val);
		onPrefsChanged();
	};

	const handlePercentMode = (val: boolean) => {
		setPercentMode(val);
		setThresholdMode(val ? "percent" : "seconds");
		onPrefsChanged();
	};

	const handleThreshold = (val: number) => {
		if (percentMode) {
			setThresholdPct(val);
			setPlayThresholdPercent(val);
		} else {
			setThresholdSec(val);
			setPlayThreshold(val * 1000);
		}
		onPrefsChanged();
	};

	const handleLogging = (val: boolean) => {
		setLogging(val);
		setLoggingEnabled(val);
		onPrefsChanged();
	};

	return (
		<div>
			{/* Pause Tracking */}
			<div className="settings-row">
				<div>
					<div className="settings-label">Pause Tracking</div>
					<div className="settings-sublabel">Temporarily stop recording plays</div>
				</div>
				{Toggle ? (
					<Toggle value={paused} onSelected={handlePause} />
				) : (
					<input type="checkbox" checked={paused} onChange={(e) => handlePause(e.currentTarget.checked)} />
				)}
			</div>

			{/* Skip Repeats */}
			<div className="settings-row">
				<div>
					<div className="settings-label">Skip Repeats</div>
					<div className="settings-sublabel">Don't count consecutive plays of the same track</div>
				</div>
				{Toggle ? (
					<Toggle value={skipRepeats} onSelected={handleSkipRepeats} />
				) : (
					<input type="checkbox" checked={skipRepeats} onChange={(e) => handleSkipRepeats(e.currentTarget.checked)} />
				)}
			</div>

			{/* Threshold Mode */}
			<div className="settings-row">
				<div>
					<div className="settings-label">Percentage Threshold</div>
					<div className="settings-sublabel">Use a share of the track length instead of seconds</div>
				</div>
				{Toggle ? (
					<Toggle value={percentMode} onSelected={handlePercentMode} />
				) : (
					<input type="checkbox" checked={percentMode} onChange={(e) => handlePercentMode(e.currentTarget.checked)} />
				)}
			</div>

			{/* Play Threshold */}
			<div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
				<div style={{ marginBottom: "8px" }}>
					<div className="settings-label">Play Threshold</div>
					<div className="settings-sublabel">
						{percentMode
							? "Minimum share of the track to count it as played"
							: "Minimum time to count a track as played"}
						{" — local tracking only; stats.fm and Last.fm use their own rules"}
					</div>
				</div>
				<ThresholdSlider
					max={percentMode ? 100 : 60}
					value={percentMode ? thresholdPct : thresholdSec}
					presets={percentMode ? PERCENT_PRESETS : SECONDS_PRESETS}
					onChange={handleThreshold}
					formatValue={(v) => (percentMode ? `${v}%` : `${v}s`)}
				/>
			</div>

			{/* Console Logging */}
			<div className="settings-row">
				<div>
					<div className="settings-label">Console Logging</div>
					<div className="settings-sublabel">Log tracked events to browser console</div>
				</div>
				{Toggle ? (
					<Toggle value={logging} onSelected={handleLogging} />
				) : (
					<input type="checkbox" checked={logging} onChange={(e) => handleLogging(e.currentTarget.checked)} />
				)}
			</div>
		</div>
	);
}
