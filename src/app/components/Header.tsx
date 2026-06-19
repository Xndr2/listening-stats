import type { HealthPayload } from "../../extension/tracker/health";
import type { StatsFmHealthPayload } from "../../shared/api/statsfm-client";
import { EVENTS } from "../../shared/constants/events";
import { LS_KEYS } from "../../shared/constants/storage-keys";
import type { ProviderCapabilities } from "../../shared/stats/provider";
import { providerRegistry } from "../../shared/stats/provider";
import type { Period } from "../../shared/types/stats";
import { GearIcon, ShareIcon } from "../icons";
import PeriodTabs from "./PeriodTabs";
import { Tooltip } from "./spicetify-ui";

const { useState, useEffect } = Spicetify.React;
const STATSFM_REFRESH_WINDOW_MS = 2 * 60_000;

function formatMsRemaining(ms: number): string {
	const totalSec = Math.max(0, Math.ceil(ms / 1000));
	const min = Math.floor(totalSec / 60);
	const sec = totalSec % 60;
	if (min <= 0) return `${sec}s`;
	if (sec === 0) return `${min}m`;
	return `${min}m ${sec}s`;
}

export function getLocalHealthColor(health: HealthPayload | null): "green" | "yellow" | "red" {
	if (!health || health.lastWriteAt === null) return "red";
	const ageMin = (Date.now() - health.lastWriteAt) / 60_000;
	if (ageMin < 5) return "green";
	if (ageMin < 60) return "yellow";
	return "red";
}

export function getStatsFmHealthColor(health: StatsFmHealthPayload | null): "green" | "yellow" | "red" {
	if (!health || health.lastSuccessAt === null) return "red";
	if (health.circuitOpen) return "red";
	if (health.lastError !== null) return "red";
	const ageMin = (Date.now() - health.lastSuccessAt) / 60_000;
	if (ageMin < 30) return "green";
	if (ageMin < 120) return "yellow";
	return "red";
}

export function getHealthColor(
	activeProviderId: string,
	localHealth: HealthPayload | null,
	sfmHealth: StatsFmHealthPayload | null,
): "green" | "yellow" | "red" {
	if (activeProviderId === "statsfm") {
		return getStatsFmHealthColor(sfmHealth);
	}
	return getLocalHealthColor(localHealth);
}

export function buildLocalTooltip(health: HealthPayload | null): string {
	if (!health || health.lastWriteAt === null) return "No plays recorded yet";
	if (!health.healthy && health.lastError) return `Tracking error: ${health.lastError}`;
	const ageMin = (Date.now() - health.lastWriteAt) / 60_000;
	const trackSuffix = health.lastTrackName
		? ` - ${health.lastTrackName.length > 40 ? `${health.lastTrackName.slice(0, 40)}...` : health.lastTrackName}`
		: "";
	if (ageMin < 1) return `Last play just now${trackSuffix}`;
	if (ageMin < 60) return `Last play ${Math.floor(ageMin)}m ago${trackSuffix}`;
	return `Last play ${Math.floor(ageMin / 60)}h ago${trackSuffix}`;
}

export function buildStatsFmTooltip(health: StatsFmHealthPayload | null): string {
	if (!health || health.lastFetchAt === null) return "No data fetched yet";
	if (health.circuitOpen) return "stats.fm unavailable: circuit open";
	if (health.lastError !== null) {
		const msg = health.lastError.length > 60 ? `${health.lastError.slice(0, 60)}…` : health.lastError;
		return `API error: ${msg}`;
	}
	if (health.lastSuccessAt === null) return "No data fetched yet";
	const refreshIn = Math.max(0, STATSFM_REFRESH_WINDOW_MS - (Date.now() - health.lastSuccessAt));
	const refreshSuffix = refreshIn > 0 ? ` · refresh in ${formatMsRemaining(refreshIn)}` : " · refresh due now";
	const ageMin = (Date.now() - health.lastSuccessAt) / 60_000;
	if (ageMin < 1) return `API healthy, just refreshed${refreshSuffix}`;
	if (ageMin < 60) return `API healthy, refreshed ${Math.floor(ageMin)}m ago${refreshSuffix}`;
	return `Data stale, last refresh ${Math.floor(ageMin / 60)}h ago${refreshSuffix}`;
}

interface HeaderProps {
	providerName: string;
	activeProviderId: string;
	onSettingsClick: () => void;
	onShareClick?: () => void;
	periods?: Period[];
	activePeriod?: Period;
	onPeriodChange?: (period: Period) => void;
}

export default function Header({
	providerName,
	activeProviderId,
	onSettingsClick,
	onShareClick,
	periods,
	activePeriod,
	onPeriodChange,
}: HeaderProps) {
	const [health, setHealth] = useState<HealthPayload | null>(() => {
		try {
			const raw = localStorage.getItem(LS_KEYS.TRACKING_HEALTH);
			if (raw) return JSON.parse(raw) as HealthPayload;
		} catch {
			// corrupted, use null
		}
		return null;
	});

	useEffect(() => {
		const handler = () => {
			try {
				const raw = localStorage.getItem(LS_KEYS.TRACKING_HEALTH);
				if (raw) setHealth(JSON.parse(raw) as HealthPayload);
			} catch {
				// corrupted, keep current state
			}
		};
		window.addEventListener(EVENTS.HEALTH_CHANGED, handler);
		return () => {
			window.removeEventListener(EVENTS.HEALTH_CHANGED, handler);
		};
	}, []);

	const [sfmHealth, setSfmHealth] = useState<StatsFmHealthPayload | null>(() => {
		try {
			const raw = localStorage.getItem(LS_KEYS.STATSFM_HEALTH);
			if (raw) return JSON.parse(raw) as StatsFmHealthPayload;
		} catch {
			// corrupted
		}
		return null;
	});

	useEffect(() => {
		const handler = () => {
			try {
				const raw = localStorage.getItem(LS_KEYS.STATSFM_HEALTH);
				if (raw) setSfmHealth(JSON.parse(raw) as StatsFmHealthPayload);
			} catch {
				// corrupted, keep current state
			}
		};
		window.addEventListener(EVENTS.STATSFM_HEALTH_CHANGED, handler);
		return () => {
			window.removeEventListener(EVENTS.STATSFM_HEALTH_CHANGED, handler);
		};
	}, []);

	const [capabilities, setCapabilities] = useState<ProviderCapabilities | null>(
		() => providerRegistry.getActive()?.getProviderInfo().capabilities ?? null,
	);

	useEffect(() => {
		const handler = () => {
			setCapabilities(providerRegistry.getActive()?.getProviderInfo().capabilities ?? null);
		};
		handler();
		window.addEventListener(EVENTS.PROVIDER_CHANGED, handler);
		window.addEventListener(EVENTS.STATSFM_PROFILE_REFRESHED, handler);
		return () => {
			window.removeEventListener(EVENTS.PROVIDER_CHANGED, handler);
			window.removeEventListener(EVENTS.STATSFM_PROFILE_REFRESHED, handler);
		};
	}, [activeProviderId]);

	const healthColor = getHealthColor(activeProviderId, health, sfmHealth);
	const tooltipText = activeProviderId === "statsfm" ? buildStatsFmTooltip(sfmHealth) : buildLocalTooltip(health);

	return (
		<header className="stats-header">
			<div className="stats-header-left">
				<h1 className="stats-header-title">Listening Stats</h1>
				<div data-tour-target="health">
					<Tooltip label={tooltipText} placement="bottom">
						<div className="header-provider-pill">
							<span
								className={`health-dot health-${healthColor}`}
								aria-label={`Health: ${healthColor} - ${tooltipText}`}
							/>
							<span className="header-provider-name">{providerName}</span>
							{capabilities?.tier === "plus" && <span className="tier-badge tier-badge--plus">Plus</span>}
						</div>
					</Tooltip>
				</div>
			</div>
			<div className="stats-header-right">
				{periods && activePeriod && onPeriodChange && (
					<div data-tour-target="period">
						<PeriodTabs periods={periods} activePeriod={activePeriod} onPeriodChange={onPeriodChange} />
					</div>
				)}
				{onShareClick && (
					<button
						type="button"
						className="stats-header-icon-btn"
						onClick={onShareClick}
						aria-label="Share card"
						data-tour-target="share"
						dangerouslySetInnerHTML={{ __html: ShareIcon }}
					/>
				)}
				<button
					type="button"
					className="stats-header-icon-btn"
					onClick={onSettingsClick}
					aria-label="Open settings"
					data-tour-target="settings"
					dangerouslySetInnerHTML={{ __html: GearIcon }}
				/>
			</div>
		</header>
	);
}
