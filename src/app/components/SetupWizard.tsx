import { validateUsername, type StatsFmConfig } from "../../shared/api/statsfm-client";
import { EVENTS } from "../../shared/constants/events";
import { LS_KEYS } from "../../shared/constants/storage-keys";
import { statsfmProvider } from "../../shared/stats/statsfm-provider";
import { providerRegistry } from "../../shared/stats/provider";
import { statsCache } from "../../shared/stats/stats-cache";

const { useState } = Spicetify.React;

interface SetupWizardProps {
	onComplete: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
	not_found: "Username not found. Check your stats.fm customId.",
	private: "Your profile is private. Make it public in stats.fm settings.",
	network: "Could not reach stats.fm. Check your connection and try again.",
	circuit_open: "stats.fm is temporarily unavailable. Try again shortly.",
};

type WizardStep = "provider" | "statsfm";

export function SetupWizard({ onComplete }: SetupWizardProps) {
	const [step, setStep] = useState<WizardStep>("provider");
	const [username, setUsername] = useState("");
	const [connecting, setConnecting] = useState(false);
	const [connectError, setConnectError] = useState<string | null>(null);

	const completeLocal = () => {
		providerRegistry.setActive("local");
		window.dispatchEvent(new CustomEvent(EVENTS.PROVIDER_CHANGED));
		onComplete();
	};

	const connectStatsFm = async () => {
		if (!username.trim()) return;
		setConnecting(true);
		setConnectError(null);
		const result = await validateUsername(username.trim());
		if (!result.valid) {
			setConnectError(ERROR_MESSAGES[result.reason] ?? "Connection failed. Try again.");
			setConnecting(false);
			return;
		}

		const config: StatsFmConfig = {
			username: username.trim(),
			isPlus: result.isPlus,
			connectedAt: Date.now(),
			lastValidated: Date.now(),
		};
		localStorage.setItem(LS_KEYS.STATSFM_CONFIG, JSON.stringify(config));
		await statsfmProvider.init();
		statsCache.invalidate();
		providerRegistry.setActive("statsfm");
		window.dispatchEvent(new CustomEvent(EVENTS.STATSFM_CONNECTED));
		window.dispatchEvent(new CustomEvent(EVENTS.PROVIDER_CHANGED));
		setConnecting(false);
		onComplete();
	};

	return (
		<div className="wizard-page">
			<div className="wizard-modal wizard-modal--page" aria-label="Choose your provider">
				{step === "provider" ? (
					<>
						<h2 className="wizard-title">Welcome to Listening Stats</h2>
						<p className="wizard-subtitle">Choose how you want to track your listening history.</p>
						<div className="wizard-provider-cards">
							<button
								type="button"
								className="wizard-provider-card"
								onClick={completeLocal}
							>
								<div className="wizard-provider-name">Local Tracking</div>
								<div className="wizard-provider-desc">Stats tracked on this device. No account required.</div>
								<div className="wizard-provider-cta">Start with Local</div>
							</button>
							<button
								type="button"
								className="wizard-provider-card"
								onClick={() => setStep("statsfm")}
							>
								<div className="wizard-provider-name">stats.fm</div>
								<div className="wizard-provider-desc">Import your listening history from your stats.fm profile.</div>
								<div className="wizard-provider-cta">Use stats.fm</div>
							</button>
						</div>
					</>
				) : (
					<>
						<h2 className="wizard-title">Connect stats.fm</h2>
						<p className="wizard-subtitle">
							Use your stats.fm customId. Your profile must be public for this to work.
						</p>
						<div className="provider-status-card wizard-statsfm-help">
							<div className="settings-label">How to find your customId</div>
							<div className="settings-sublabel">
								Open stats.fm, visit your profile, and copy the customId from the profile URL.
							</div>
							<div className="settings-sublabel">
								Example: stats.fm/user/<strong>your-custom-id</strong>
							</div>
						</div>
						<div className="wizard-statsfm-form">
							<input
								type="text"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !connecting) void connectStatsFm();
								}}
								placeholder="Enter your stats.fm customId"
								disabled={connecting}
								aria-label="stats.fm customId"
								className="wizard-statsfm-input"
							/>
							<div className="wizard-statsfm-actions">
								<button type="button" className="btn-secondary" onClick={() => setStep("provider")} disabled={connecting}>
									Back
								</button>
								<button type="button" className="btn-primary" onClick={() => void connectStatsFm()} disabled={connecting || !username.trim()}>
									{connecting ? "Connecting..." : "Connect stats.fm"}
								</button>
							</div>
							{connectError && (
								<div className="provider-connect-error" role="alert">
									{connectError}
								</div>
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
