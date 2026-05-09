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
import { SegmentedControl } from "../SegmentedControl";

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
		window.dispatchEvent(
			new CustomEvent(val ? EVENTS.TRACKING_PAUSED : EVENTS.TRACKING_RESUMED),
		);
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

	const Toggle = Spicetify.ReactComponent?.Toggle;

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
					<input
						type="checkbox"
						checked={paused}
						onChange={(e: Event) => handlePause((e.target as HTMLInputElement).checked)}
					/>
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
					<input
						type="checkbox"
						checked={skipRepeats}
						onChange={(e: Event) =>
							handleSkipRepeats((e.target as HTMLInputElement).checked)
						}
					/>
				)}
			</div>

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
					<input
						type="checkbox"
						checked={logging}
						onChange={(e: Event) =>
							handleLogging((e.target as HTMLInputElement).checked)
						}
					/>
				)}
			</div>
		</div>
	);
}
