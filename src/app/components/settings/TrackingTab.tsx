import {
	getPlayThreshold,
	isSkipRepeatsEnabled,
	isTrackingPaused,
	setPlayThreshold,
	setSkipRepeatsEnabled,
	setTrackingPaused,
} from "../../../extension/tracker/settings";
import { EVENTS } from "../../../shared/constants/events";
import { LS_KEYS } from "../../../shared/constants/storage-keys";
<<<<<<< Updated upstream
import { SegmentedControl } from "../SegmentedControl";
import { Toggle } from "../spicetify-ui";
=======
import { ThresholdSlider } from "../ThresholdSlider";
import { SettingRow, SettingsGroup, SettingToggle } from "./controls";
>>>>>>> Stashed changes

const THRESHOLD_STOPS = [0, 5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 55000, 60000];

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
	const [threshold, setThreshold] = useState(() => getPlayThreshold());
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

	const handleThreshold = (val: number) => {
		setThreshold(val);
		setPlayThreshold(val);
		onPrefsChanged();
	};

	const handleLogging = (val: boolean) => {
		setLogging(val);
		setLoggingEnabled(val);
		onPrefsChanged();
	};

	return (
		<div>
			<SettingsGroup title="Recording">
				<SettingRow label="Pause tracking">
					<SettingToggle value={paused} onChange={handlePause} />
				</SettingRow>
				<SettingRow label="Skip repeats" sublabel="Don't count back-to-back plays of the same track">
					<SettingToggle value={skipRepeats} onChange={handleSkipRepeats} />
				</SettingRow>
			</SettingsGroup>

			<SettingsGroup title="Play threshold">
				<SettingRow label="Use percentage of track length">
					<SettingToggle value={percentMode} onChange={handlePercentMode} />
				</SettingRow>
				<SettingRow
					label="Count a play after"
					sublabel="Local tracking only; stats.fm and Last.fm use their own rules"
					stacked
				>
					<ThresholdSlider
						max={percentMode ? 100 : 60}
						value={percentMode ? thresholdPct : thresholdSec}
						presets={percentMode ? PERCENT_PRESETS : SECONDS_PRESETS}
						onChange={handleThreshold}
						formatValue={(v) => (percentMode ? `${v}%` : `${v}s`)}
					/>
				</SettingRow>
			</SettingsGroup>

<<<<<<< Updated upstream
			{/* Play Threshold */}
			<div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
				<div style={{ marginBottom: "8px" }}>
					<div className="settings-label">Play Threshold</div>
					<div className="settings-sublabel">Minimum time to count a track as played</div>
				</div>
				<SegmentedControl
					stops={THRESHOLD_STOPS}
					value={threshold}
					onSelect={handleThreshold}
					labelAt={[0, 15000, 30000, 45000, 60000]}
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
=======
			<SettingsGroup title="Diagnostics">
				<SettingRow label="Console logging">
					<SettingToggle value={logging} onChange={handleLogging} />
				</SettingRow>
			</SettingsGroup>
>>>>>>> Stashed changes
		</div>
	);
}
