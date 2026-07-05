import { lastfmGetUserInfo } from "../../../shared/api/lastfm-client";
import { type StatsFmConfig, validateUsername } from "../../../shared/api/statsfm-client";
import { EVENTS } from "../../../shared/constants/events";
import { LS_KEYS } from "../../../shared/constants/storage-keys";
import type { LastfmProviderConfig } from "../../../shared/stats/lastfm-provider";
import { lastfmProvider } from "../../../shared/stats/lastfm-provider";
import type { ProviderRegistry } from "../../../shared/stats/provider";
import { providerRegistry } from "../../../shared/stats/provider";
import { statsCache } from "../../../shared/stats/stats-cache";
import { statsfmProvider } from "../../../shared/stats/statsfm-provider";

const { useState } = Spicetify.React;

type ConnectPhase = "idle" | "connecting" | "connected" | "error";

export const ERROR_MESSAGES: Record<string, string> = {
	not_found: "Username not found. Check your stats.fm customId.",
	private: "Profile is private. Visit stats.fm settings and set your profile to public.",
	network: "Could not reach stats.fm. Check your connection and try again.",
	circuit_open: "stats.fm is temporarily unavailable. Try again shortly.",
};

export function readStatsFmConfig(): StatsFmConfig | null {
	const raw = localStorage.getItem(LS_KEYS.STATSFM_CONFIG);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as StatsFmConfig;
	} catch {
		return null;
	}
}

export function readLastfmConfig(): LastfmProviderConfig | null {
	const raw = localStorage.getItem(LS_KEYS.LASTFM_CONFIG);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as LastfmProviderConfig;
	} catch {
		return null;
	}
}

export function deriveTierBadge(registry: ProviderRegistry): {
	tier: "plus" | "free";
	tierClass: string;
	tierLabel: string;
} {
	const sfmInfo = registry.getAll().find((p) => p.id === "statsfm");
	const tier = sfmInfo?.capabilities.tier === "plus" ? "plus" : "free";
	const tierClass = tier === "plus" ? "tier-badge--plus" : "tier-badge--free";
	const tierLabel = tier === "plus" ? "Plus" : "Free";
	return { tier, tierClass, tierLabel };
}

export function ProvidersTab() {
	const [username, setUsername] = useState("");
	const [phase, setPhase] = useState<ConnectPhase>(() => (readStatsFmConfig() ? "connected" : "idle"));
	const [config, setConfig] = useState<StatsFmConfig | null>(() => readStatsFmConfig());
	const [connectError, setConnectError] = useState<string | null>(null);
	const [revalidating, setRevalidating] = useState(false);
	const [revalidateError, setRevalidateError] = useState<string | null>(null);
	// Last.fm provider state
	const [lfmProvConfig, setLfmProvConfig] = useState<LastfmProviderConfig | null>(() => readLastfmConfig());
	const [lfmConnecting, setLfmConnecting] = useState(false);
	const [lfmUsername, setLfmUsername] = useState("");
	const [lfmApiKeyInput, setLfmApiKeyInput] = useState("");
	const [lfmConnectError, setLfmConnectError] = useState<string | null>(null);

	const handleConnect = async () => {
		if (!username.trim()) return;
		setPhase("connecting");
		setConnectError(null);

		const result = await validateUsername(username.trim());
		if (!result.valid) {
			setConnectError(ERROR_MESSAGES[result.reason] ?? "Connection failed. Check the console for details.");
			setPhase("error");
			return;
		}

		const newConfig: StatsFmConfig = {
			username: username.trim(),
			isPlus: result.isPlus,
			connectedAt: Date.now(),
			lastValidated: Date.now(),
		};
		localStorage.setItem(LS_KEYS.STATSFM_CONFIG, JSON.stringify(newConfig));
		await statsfmProvider.init();
		statsCache.invalidate();
		providerRegistry.setActive("statsfm");
		window.dispatchEvent(new CustomEvent(EVENTS.STATSFM_CONNECTED));
		window.dispatchEvent(new CustomEvent(EVENTS.PROVIDER_CHANGED));
		setConfig(newConfig);
		setPhase("connected");
	};

	const handleDisconnect = () => {
		localStorage.removeItem(LS_KEYS.STATSFM_CONFIG);
		statsCache.invalidate();
		providerRegistry.setActive("local");
		window.dispatchEvent(new CustomEvent(EVENTS.STATSFM_DISCONNECTED));
		window.dispatchEvent(new CustomEvent(EVENTS.PROVIDER_CHANGED));
		setPhase("idle");
		setUsername("");
		setConfig(null);
		setConnectError(null);
	};

	const handleRevalidate = async () => {
		if (!config) return;
		const prevIsPlus = config.isPlus;
		setRevalidating(true);
		setRevalidateError(null);

		const result = await validateUsername(config.username);
		if (!result.valid) {
			setRevalidateError(ERROR_MESSAGES[result.reason] ?? "Validation failed. Check the console for details.");
			setRevalidating(false);
			return;
		}

		const newConfig: StatsFmConfig = {
			...config,
			isPlus: result.isPlus,
			lastValidated: Date.now(),
		};
		localStorage.setItem(LS_KEYS.STATSFM_CONFIG, JSON.stringify(newConfig));
		await statsfmProvider.init();
		setConfig(newConfig);
		setRevalidating(false);
		window.dispatchEvent(new CustomEvent(EVENTS.STATSFM_PROFILE_REFRESHED));

		if (prevIsPlus !== result.isPlus) {
			statsCache.invalidate();
			window.dispatchEvent(new CustomEvent(EVENTS.PROVIDER_CHANGED));
		}
	};

	const handleLastfmProviderConnect = async () => {
		const apiKey = lfmApiKeyInput.trim() || localStorage.getItem(LS_KEYS.LASTFM_API_KEY) || "";
		if (!apiKey || !lfmUsername.trim()) return;
		setLfmConnecting(true);
		setLfmConnectError(null);

		try {
			const info = await lastfmGetUserInfo(apiKey, lfmUsername.trim());
			const newConfig: LastfmProviderConfig = {
				apiKey,
				username: info.username,
			};
			localStorage.setItem(LS_KEYS.LASTFM_CONFIG, JSON.stringify(newConfig));
			localStorage.setItem(LS_KEYS.LASTFM_API_KEY, apiKey);
			await lastfmProvider.init();
			statsCache.invalidate();
			providerRegistry.setActive("lastfm");
			window.dispatchEvent(new CustomEvent(EVENTS.PROVIDER_CHANGED));
			setLfmProvConfig(newConfig);
			setLfmConnecting(false);
		} catch (e) {
			setLfmConnectError(String(e));
			setLfmConnecting(false);
		}
	};

	const handleLastfmProviderDisconnect = () => {
		localStorage.removeItem(LS_KEYS.LASTFM_CONFIG);
		statsCache.invalidate();
		providerRegistry.setActive("local");
		window.dispatchEvent(new CustomEvent(EVENTS.PROVIDER_CHANGED));
		setLfmProvConfig(null);
		setLfmUsername("");
		setLfmApiKeyInput("");
		setLfmConnectError(null);
	};

	const handleProviderSwitch = (newId: string) => {
		statsCache.invalidate();
		providerRegistry.setActive(newId);
		window.dispatchEvent(new CustomEvent(EVENTS.PROVIDER_CHANGED));
	};

	const providers = providerRegistry.getAll();
	const activeProviderId = providerRegistry.getActiveId();
	const hasStatsFmConfig = config !== null;
	const hasLastfmConfig = lfmProvConfig !== null;
	const { tierClass, tierLabel } = deriveTierBadge(providerRegistry);

	return (
		<div>
			{/* Active Provider section */}
			<h3 className="section-header">Active provider</h3>
			<div role="radiogroup" aria-label="Active provider">
				{providers.map((p) => {
					const unconfigured = (p.id === "statsfm" && !hasStatsFmConfig) || (p.id === "lastfm" && !hasLastfmConfig);
					return (
						<div
							key={p.id}
							className={`provider-radio-row ${activeProviderId === p.id ? "active" : ""}`}
							role="radio"
							aria-checked={activeProviderId === p.id}
							aria-label={p.name}
							onClick={() => {
								if (unconfigured) return;
								if (activeProviderId !== p.id) handleProviderSwitch(p.id);
							}}
							style={unconfigured ? { opacity: 0.5, pointerEvents: "none" as const } : undefined}
						>
							<div>
								<div className="settings-label">{p.name}</div>
								<div className="settings-sublabel">{p.description}</div>
							</div>
						</div>
					);
				})}
			</div>

			{/* stats.fm Account section */}
			<h3 className="section-header" style={{ marginTop: "20px" }}>
				stats.fm account
			</h3>

			{(phase === "idle" || phase === "connecting" || phase === "error") && (
				<div>
					<div className="settings-sublabel" style={{ marginBottom: "8px" }}>
						Use your stats.fm customId, not your display name
					</div>
					<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
						<input
							type="text"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && phase !== "connecting") handleConnect();
							}}
							placeholder="Enter your stats.fm username"
							disabled={phase === "connecting"}
							aria-label="stats.fm username"
							className="settings-input"
						/>
						<button
							type="button"
							className="btn-primary"
							onClick={handleConnect}
							disabled={phase === "connecting"}
							aria-busy={phase === "connecting"}
							style={phase === "connecting" ? { opacity: 0.6 } : undefined}
						>
							{phase === "connecting" ? "Connecting..." : "Connect Account"}
						</button>
					</div>
					{phase === "error" && connectError && (
						<div className="provider-connect-error" role="alert">
							{connectError}
						</div>
					)}
				</div>
			)}

			{phase === "connected" && config && (
				<div className="provider-status-card">
					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						<span style={{ color: "var(--spice-text)", fontWeight: 700 }}>{config.username}</span>
						<span className={`tier-badge ${tierClass}`}>{tierLabel}</span>
					</div>
					<div className="settings-sublabel">Connected since {new Date(config.connectedAt).toLocaleDateString()}</div>
					<div
						style={{
							display: "flex",
							flexWrap: "wrap",
							gap: "8px",
							marginTop: "12px",
							alignItems: "center",
						}}
					>
						<button
							type="button"
							className="btn-secondary"
							onClick={handleRevalidate}
							disabled={revalidating}
							aria-busy={revalidating}
							aria-label="Re-validate stats.fm tier status"
							style={revalidating ? { opacity: 0.6 } : undefined}
						>
							{revalidating ? "Re-validating..." : "Re-validate"}
						</button>
						<button
							type="button"
							className="btn-destructive"
							onClick={handleDisconnect}
							aria-label="Disconnect stats.fm account"
						>
							Disconnect
						</button>
					</div>
					{revalidateError && (
						<div className="provider-connect-error" role="alert">
							{revalidateError}
						</div>
					)}
				</div>
			)}

			{/* Last.fm Account section */}
			<h3 className="section-header" style={{ marginTop: "20px" }}>
				Last.fm account
			</h3>

			{!lfmProvConfig ? (
				<div>
					<div className="settings-sublabel" style={{ marginBottom: "8px" }}>
						Connect your Last.fm account to use it as a stats provider (also enables World Charts data).
					</div>
					<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
						<input
							type="text"
							value={lfmUsername}
							onChange={(e) => setLfmUsername(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !lfmConnecting) handleLastfmProviderConnect();
							}}
							placeholder="Enter your Last.fm username"
							disabled={lfmConnecting}
							aria-label="Last.fm username"
							className="settings-input"
						/>
						<input
							type="text"
							value={lfmApiKeyInput}
							onChange={(e) => setLfmApiKeyInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !lfmConnecting) handleLastfmProviderConnect();
							}}
							placeholder="Enter your Last.fm API key"
							disabled={lfmConnecting}
							aria-label="Last.fm provider API key"
							className="settings-input"
						/>
						<button
							type="button"
							className="btn-primary"
							onClick={handleLastfmProviderConnect}
							disabled={
								lfmConnecting ||
								!lfmUsername.trim() ||
								!(lfmApiKeyInput.trim() || localStorage.getItem(LS_KEYS.LASTFM_API_KEY))
							}
							aria-busy={lfmConnecting}
							style={lfmConnecting ? { opacity: 0.6 } : undefined}
						>
							{lfmConnecting ? "Connecting..." : "Connect Account"}
						</button>
					</div>
					{lfmConnectError && (
						<div className="provider-connect-error" role="alert">
							{lfmConnectError}
						</div>
					)}
				</div>
			) : (
				<div className="provider-status-card">
					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						<span style={{ color: "var(--spice-text)", fontWeight: 700 }}>{lfmProvConfig.username}</span>
					</div>
					<div className="settings-sublabel">Last.fm API key is configured and active.</div>
					<button
						type="button"
						className="btn-destructive"
						onClick={handleLastfmProviderDisconnect}
						style={{ marginTop: "8px", alignSelf: "flex-start" }}
					>
						Disconnect
					</button>
				</div>
			)}
		</div>
	);
}
