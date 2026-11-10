import { useId } from "react";
import { PERIOD_LABELS } from "../../../shared/providers/periods";
import { isConnected, PROVIDERS } from "../../../shared/providers/registry";
import { PROVIDER_IDS } from "../../../shared/settings/registry";
import { useApp } from "../../state";
import { Icon } from "../Icon";
import { Segmented } from "../Segmented/Segmented";
import { Select } from "../Select/Select";
import "./Header.css";

function SourcePicker() {
	const { provider, providerId, setProvider, setSettingsOpen } = useApp();
	const menuId = useId();
	const close = () => (document.getElementById(menuId) as HTMLElement & { hidePopover?: () => void })?.hidePopover?.();
	return (
		<>
			<button
				type="button"
				className="ls-source"
				popovertarget={menuId}
				aria-haspopup="menu"
				data-tip="Where your stats come from"
			>
				<span className="ls-source-dot" aria-hidden="true" />
				{provider.name}
				<Icon name="chevronDown" size={12} />
			</button>
			<div id={menuId} popover="auto" className="ls-menu" role="menu">
				{PROVIDER_IDS.map((id) => {
					const connected = isConnected(id);
					return (
						<button
							key={id}
							type="button"
							role="menuitemradio"
							aria-checked={id === providerId}
							className="ls-menu-item"
							onClick={() => {
								close();
								if (connected) setProvider(id);
								else setSettingsOpen(true);
							}}
						>
							<span>{PROVIDERS[id].name}</span>
							<span className="ls-muted">{id === providerId ? <Icon name="check" /> : connected ? "" : "Connect"}</span>
						</button>
					);
				})}
			</div>
		</>
	);
}

function PeriodPicker() {
	const { provider, periodId, setPeriod } = useApp();
	const options = provider.periods.map((p) => ({ value: p, label: PERIOD_LABELS[p] }));
	return (
		<>
			<div className="ls-period-wide">
				<Segmented label="Time period" options={options} value={periodId} onChange={setPeriod} />
			</div>
			<div className="ls-period-narrow">
				<Select variant="pill" label="Time period" options={options} value={periodId} onChange={setPeriod} />
			</div>
		</>
	);
}

export function Header({ onShare }: { onShare: () => void }) {
	const { view, setView, setSettingsOpen } = useApp();
	return (
		<header className="ls-header">
			<div className="ls-header-start">
				<h1 className="ls-title">Listening Stats</h1>
				<SourcePicker />
				<Segmented
					label="Whose stats"
					options={[
						{ value: "dashboard", label: "You" },
						{ value: "world", label: "World" },
					]}
					value={view === "world" ? "world" : "dashboard"}
					onChange={setView}
				/>
			</div>
			<div className="ls-header-end">
				{view === "dashboard" && <PeriodPicker />}
				{view === "dashboard" && (
					<button type="button" className="ls-btn-primary" onClick={onShare}>
						<Icon name="share" />
						<span className="ls-share-label">Share</span>
					</button>
				)}
				<button
					type="button"
					className="ls-icon-btn"
					aria-label="Settings"
					data-tip="Settings"
					aria-haspopup="dialog"
					onClick={() => setSettingsOpen(true)}
				>
					<Icon name="settings" size={18} />
				</button>
			</div>
		</header>
	);
}
