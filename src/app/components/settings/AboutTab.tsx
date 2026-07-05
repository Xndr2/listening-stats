import { EVENTS } from "../../../shared/constants/events";
import { GITHUB_REPO_WEB_URL } from "../../../shared/constants/github-repo";
import { getPreferences, setPreference } from "../../preferences";
import { SettingRow, SettingsGroup, SettingToggle } from "./controls";

const { useCallback } = Spicetify.React;

interface AboutTabProps {
	version: string;
	onOpenUpdates: () => void;
	onPrefsChanged: () => void;
	onReceiveBetaUpdatesChanged?: () => void;
	onRestartTour?: () => void;
}

export function AboutTab({
	version,
	onOpenUpdates,
	onPrefsChanged,
	onReceiveBetaUpdatesChanged,
	onRestartTour,
}: AboutTabProps) {
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
			<SettingsGroup title="Updates">
				<SettingRow label="Listening Stats" sublabel={`Version ${version}`}>
					<button type="button" className="btn-secondary" onClick={onOpenUpdates}>
						Check for updates…
					</button>
				</SettingRow>
				<SettingRow label="Prereleases" sublabel="Include beta versions in update checks">
					<SettingToggle value={prefs.receiveBetaUpdates} onChange={handleBetaChannel} />
				</SettingRow>
			</SettingsGroup>

			<SettingsGroup title="Help">
				{onRestartTour && (
					<SettingRow label="Guided tour">
						<button type="button" className="btn-secondary" data-testid="restart-tour" onClick={onRestartTour}>
							Restart
						</button>
					</SettingRow>
				)}
				<SettingRow label="Source">
					<a className="settings-inline-link" href={GITHUB_REPO_WEB_URL} target="_blank" rel="noopener noreferrer">
						{GITHUB_REPO_WEB_URL.replace("https://", "")}
					</a>
				</SettingRow>
			</SettingsGroup>
		</div>
	);
}
