/**
 * Settings as a modal over the page (native <dialog>: focus stays inside,
 * Esc closes). Sections on the left, the chosen one on the right, which
 * scrolls on its own. Narrow panes stack them.
 */
import { useEffect, useReducer, useRef, useState } from "react";
import { EVENTS, listen } from "../../shared/constants/events";
import { onBackdrop } from "../components/dialog";
import { Icon } from "../components/Icon";
import { useApp } from "../state";
import { AboutTab } from "./AboutTab";
import { DataTab } from "./DataTab";
import { DisplayTab } from "./DisplayTab";
import { PlaylistsTab } from "./PlaylistsTab";
import { SourcesTab } from "./SourcesTab";
import { TrackingTab } from "./TrackingTab";
import "./Settings.css";

const TABS = [
	{ id: "sources", label: "Data sources", render: () => <SourcesTab /> },
	{ id: "tracking", label: "Tracking", render: () => <TrackingTab /> },
	{ id: "display", label: "Display", render: () => <DisplayTab /> },
	{ id: "playlists", label: "Playlists", render: () => <PlaylistsTab /> },
	{ id: "data", label: "Import and export", render: () => <DataTab /> },
	{ id: "about", label: "About and help", render: () => <AboutTab /> },
] as const;

export type SettingsTabId = (typeof TABS)[number]["id"];

export function SettingsView() {
	const { settingsOpen, setSettingsOpen } = useApp();
	const [tab, setTab] = useState<SettingsTabId>("sources");
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const d = ref.current;
		if (!d) return;
		if (settingsOpen && !d.open) d.showModal();
		if (!settingsOpen && d.open) d.close();
	}, [settingsOpen]);
	const close = () => setSettingsOpen(false);
	// Connection changes are stored outside React; re-render when they happen.
	const [, bump] = useReducer((n: number) => n + 1, 0);
	useEffect(() => listen(EVENTS.SETTINGS_CHANGED, bump), []);
	const current = TABS.find((t) => t.id === tab) ?? TABS[0];
	return (
		<dialog
			ref={ref}
			className="ls-settings"
			aria-labelledby="ls-settings-title"
			onClose={close}
			onCancel={close}
			// A click on the backdrop lands on the dialog element itself.
			onClick={(e) => onBackdrop(e) && close()}
		>
			<div className="ls-settings-top">
				<h2 id="ls-settings-title" className="ls-settings-title">
					Settings
				</h2>
				<button type="button" className="ls-icon-btn" aria-label="Close settings" onClick={close}>
					<Icon name="close" />
				</button>
			</div>
			<div className="ls-settings-body">
				<nav className="ls-settings-nav" aria-label="Settings sections">
					{TABS.map((t) => (
						<button
							key={t.id}
							type="button"
							className="ls-settings-tab"
							aria-current={t.id === tab ? "page" : undefined}
							onClick={() => setTab(t.id)}
						>
							{t.label}
						</button>
					))}
				</nav>
				<div className="ls-settings-panel">{settingsOpen && current.render()}</div>
			</div>
		</dialog>
	);
}
