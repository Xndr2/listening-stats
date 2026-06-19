import { EVENTS } from "../../../shared/constants/events";
import { GITHUB_REPO_WEB_URL } from "../../../shared/constants/github-repo";
import { getPreferences, setPreference } from "../../preferences";
import { Toggle } from "../spicetify-ui";

const { useCallback } = Spicetify.React;

interface AboutTabProps {
	version: string;
	onOpenUpdates: () => void;
	onPrefsChanged: () => void;
	onReceiveBetaUpdatesChanged?: () => void;
}

export function AboutTab({ version, onOpenUpdates, onPrefsChanged, onReceiveBetaUpdatesChanged }: AboutTabProps) {
	const prefs = getPreferences();

	const handleBetaChannel = useCallback(
		(val: boolean) => {
			setPreference("receiveBetaUpdates", val);
			window.dispatchEvent(new CustomEvent(EVENTS.PREFS_CHANGED));
			onPrefsChanged();
			onReceiveBetaUpdatesChanged?.();
		},
		[onPrefsChanged, onReceiveBetaUpdatesChanged],
	);

	return (
		<div className="settings-about">
			<div className="settings-row">
				<div>
					<div className="settings-label">Listening Stats</div>
					<div className="settings-sublabel">Version {version}</div>
				</div>
			</div>

			<div className="settings-row settings-about-beta-row">
				<div>
					<div className="settings-label">Prereleases</div>
					<div className="settings-sublabel">
						Same setting as in the updates window - affects version checks and which install command is copied there.
					</div>
				</div>
				{Toggle ? (
					<Toggle value={prefs.receiveBetaUpdates} onSelected={handleBetaChannel} />
				) : (
					<input
						type="checkbox"
						checked={prefs.receiveBetaUpdates}
						onChange={(e) => handleBetaChannel(e.currentTarget.checked)}
					/>
				)}
			</div>

			<p className="settings-about-short-lead">
				Changelog, install commands, and release checks are in <strong>Check for updates</strong> (footer or below).
			</p>

			<button type="button" className="btn-secondary settings-about-check-updates" onClick={onOpenUpdates}>
				Check for updates…
			</button>

			<p className="settings-about-hint">
				Source:{" "}
				<a className="settings-inline-link" href={GITHUB_REPO_WEB_URL} target="_blank" rel="noopener noreferrer">
					{GITHUB_REPO_WEB_URL.replace("https://", "")}
				</a>
			</p>
		</div>
	);
}
