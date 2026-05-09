import { CloseIcon } from "../../icons";
import { AboutTab } from "./AboutTab";
import { DataTab } from "./DataTab";
import { DisplayTab } from "./DisplayTab";
import { ProvidersTab } from "./ProvidersTab";
import { TrackingTab } from "./TrackingTab";

const { useState, useEffect } = Spicetify.React;

export type SettingsTab = "tracking" | "display" | "data" | "providers" | "about";

const TAB_LABELS: Record<SettingsTab, string> = {
	tracking: "Tracking",
	display: "Display",
	data: "Data Management",
	providers: "Providers",
	about: "About",
};

interface Props {
	onClose: () => void;
	onRefresh: () => void;
	onPrefsChanged: () => void;
	onRestartTour?: () => void;
	/** Opens the Updates modal (changelog / version check). */
	onOpenUpdates: () => void;
	/** After toggling prerelease preference  -  refresh remote version compare. */
	onReceiveBetaUpdatesChanged?: () => void;
	initialTab?: SettingsTab;
	appVersion: string;
	/** Current banner dismiss key (remote id or local version), for snapshot when hiding via Display settings. */
	announcementDismissKey?: string | null;
}

export function SettingsModal({
	onClose,
	onRefresh,
	onPrefsChanged,
	onRestartTour,
	onOpenUpdates,
	onReceiveBetaUpdatesChanged,
	initialTab = "tracking",
	appVersion,
	announcementDismissKey = null,
}: Props) {
	const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onClose]);

	const { createPortal } = Spicetify.ReactDOM;

	return createPortal(
		<div
			className="settings-overlay"
			onClick={(e) => {
				if ((e.target as HTMLElement).classList.contains("settings-overlay")) onClose();
			}}
		>
			<div className="settings-modal" role="dialog" aria-modal="true">
				<div className="settings-modal-header">
					<h2 className="settings-modal-title">Settings</h2>
					<button
						type="button"
						className="settings-btn"
						onClick={onClose}
						aria-label="Close settings"
						dangerouslySetInnerHTML={{ __html: CloseIcon }}
					/>
				</div>

				<div className="settings-tabs" role="tablist">
					{(["tracking", "display", "data", "providers", "about"] as const).map((tab) => (
						<button
							type="button"
							key={tab}
							className={`settings-tab ${activeTab === tab ? "active" : ""}`}
							role="tab"
							aria-selected={activeTab === tab}
							onClick={() => setActiveTab(tab)}
						>
							{TAB_LABELS[tab]}
						</button>
					))}
				</div>

				{activeTab === "tracking" && <TrackingTab onPrefsChanged={onPrefsChanged} />}
				{activeTab === "display" && (
					<DisplayTab
						onPrefsChanged={onPrefsChanged}
						onRestartTour={onRestartTour}
						announcementDismissKey={announcementDismissKey}
					/>
				)}
				{activeTab === "data" && <DataTab onRefresh={onRefresh} />}
				{activeTab === "providers" && <ProvidersTab />}
				{activeTab === "about" && (
					<AboutTab
						version={appVersion}
						onOpenUpdates={onOpenUpdates}
						onPrefsChanged={onPrefsChanged}
						onReceiveBetaUpdatesChanged={onReceiveBetaUpdatesChanged}
					/>
				)}
			</div>
		</div>,
		document.body,
	);
}
