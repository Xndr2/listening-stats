import { useEffect, useState } from "react";
import { APP_VERSION, BUYMEACOFFEE_URL } from "../shared/constants/app";
import { Header } from "./components/Header/Header";
import { UpdateDialog } from "./components/UpdateDialog/UpdateDialog";
import { Dashboard } from "./layout/Dashboard";
import { needsSetup, SetupWizard } from "./onboarding/SetupWizard";
import { shouldShowTour, TOUR_EVENT, Tour } from "./onboarding/Tour";
import { SettingsView } from "./settings/SettingsView";
import { ShareDialog } from "./share/ShareDialog";
import { AppStateProvider, useApp } from "./state";
import { WorldView } from "./world/WorldView";
import "./App.css";

function Views() {
	const { view, provider } = useApp();
	const [sharing, setSharing] = useState(false);
	const [setup, setSetup] = useState(needsSetup);
	const [touring, setTouring] = useState(false);
	// The tour starts once the dashboard has rendered (it points at its parts).
	useEffect(() => {
		if (view !== "dashboard" || setup) return;
		const t = setTimeout(() => shouldShowTour() && setTouring(true), 1200);
		return () => clearTimeout(t);
	}, [view, setup]);
	useEffect(() => {
		const start = () => setTouring(true);
		window.addEventListener(TOUR_EVENT, start);
		return () => window.removeEventListener(TOUR_EVENT, start);
	}, []);
	return (
		<>
			<Header onShare={() => setSharing(true)} />
			<main className="ls-main">
				{view === "dashboard" && (setup ? <SetupWizard onDone={() => setSetup(false)} /> : <Dashboard />)}
				{view === "world" && <WorldView />}
			</main>
			{touring && <Tour onDone={() => setTouring(false)} />}
			<SettingsView />
			<ShareDialog open={sharing} onClose={() => setSharing(false)} />
			<UpdateDialog />
			<footer className="ls-footer">
				<span>
					Listening Stats <strong>v{APP_VERSION}</strong>
				</span>
				<span>{provider.id === "local" ? "Local · tracked on this device" : `Data from ${provider.name}`}</span>
				<a className="ls-footer-support" href={BUYMEACOFFEE_URL} target="_blank" rel="noreferrer noopener">
					Buy me a coffee
				</a>
			</footer>
		</>
	);
}

export default function App() {
	return (
		<AppStateProvider>
			<Views />
		</AppStateProvider>
	);
}
