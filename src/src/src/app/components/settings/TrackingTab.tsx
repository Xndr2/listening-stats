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
import { ThresholdSlider } from "../ThresholdSlider";
import { SettingRow, SettingsGroup, SettingToggle } from "./controls";

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

			<SettingsGroup title="Diagnostics">
				<SettingRow label="Console logging">
					<SettingToggle value={logging} onChange={handleLogging} />
				</SettingRow>
			</SettingsGroup>
		</div>
	);
}
