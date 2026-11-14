/**
 * First run: pick where stats come from. Shown instead of the dashboard
 * until the user chooses; people coming from v2 already chose and skip it.
 */
import { useState } from "react";
import { V2_KEYS } from "../../shared/constants/storage-keys";
import { setLocal } from "../../shared/storage/local";
import { SourcesTab } from "../settings/SourcesTab";
import { useApp } from "../state";
import "./Onboarding.css";

export function needsSetup(): boolean {
	try {
		return !localStorage.getItem(V2_KEYS.PROVIDER_WIZARD_SEEN);
	} catch {
		return false;
	}
}

export function SetupWizard({ onDone }: { onDone: () => void }) {
	const { provider } = useApp();
	const [more, setMore] = useState(false);
	const finish = () => {
		setLocal(V2_KEYS.PROVIDER_WIZARD_SEEN, "1");
		onDone();
	};
	return (
		<div className="ls-setup">
			<h2 className="ls-setup-title">Welcome to Listening Stats</h2>
			<p className="ls-setup-lead">
				It shows what you've been listening to, right here in Spotify. It starts tracking on this device straight away,
				with no account. If you already use stats.fm or Last.fm, you can connect them for your full history.
			</p>
			{more ? (
				<div className="ls-setup-sources">
					<SourcesTab />
				</div>
			) : (
				<div className="ls-setup-choice">
					<button type="button" className="ls-setup-card" onClick={finish}>
						<span className="ls-setup-card-title">Just this device</span>
						<span className="ls-muted">Starts empty and fills up as you listen. Nothing leaves your computer.</span>
					</button>
					<button type="button" className="ls-setup-card" onClick={() => setMore(true)}>
						<span className="ls-setup-card-title">Connect stats.fm or Last.fm</span>
						<span className="ls-muted">See your history from before today. You can switch any time in Settings.</span>
					</button>
				</div>
			)}
			{more && (
				<button type="button" className="ls-btn-primary ls-setup-done" onClick={finish}>
					Continue with {provider.name}
				</button>
			)}
		</div>
	);
}
