import { Toggle } from "../spicetify-ui";

/**
 * Shared building blocks for the settings modal. Every tab composes these so
 * rows, toggles, and option pickers look and behave identically everywhere.
 */

interface SettingsGroupProps {
	title: string;
	children?: React.ReactNode;
}

export function SettingsGroup({ title, children }: SettingsGroupProps) {
	return (
		<section className="settings-group">
			<h3 className="section-header">{title}</h3>
			{children}
		</section>
	);
}

interface SettingRowProps {
	label: string;
	sublabel?: React.ReactNode;
	/** Stack the control under the label instead of placing it at the right */
	stacked?: boolean;
	testId?: string;
	children?: React.ReactNode;
}

export function SettingRow({ label, sublabel, stacked, testId, children }: SettingRowProps) {
	return (
		<div
			className="settings-row"
			data-testid={testId}
			style={stacked ? { flexDirection: "column", alignItems: "stretch", gap: "8px" } : undefined}
		>
			<div>
				<div className="settings-label">{label}</div>
				{sublabel && <div className="settings-sublabel">{sublabel}</div>}
			</div>
			{children}
		</div>
	);
}

interface SettingToggleProps {
	value: boolean;
	onChange: (value: boolean) => void;
}

export function SettingToggle({ value, onChange }: SettingToggleProps) {
	if (Toggle) {
		return <Toggle value={value} onSelected={onChange} />;
	}
	return <input type="checkbox" checked={value} onChange={(e) => onChange(e.currentTarget.checked)} />;
}

interface OptionGroupProps<T extends string | number> {
	options: readonly { value: T; label: string }[];
	value: T;
	onChange: (value: T) => void;
	testId?: string;
}

export function OptionGroup<T extends string | number>({ options, value, onChange, testId }: OptionGroupProps<T>) {
	return (
		<div className="option-group" role="group" data-testid={testId}>
			{options.map((opt) => (
				<button
					key={String(opt.value)}
					type="button"
					className={`option-group-btn${opt.value === value ? " active" : ""}`}
					aria-pressed={opt.value === value}
					onClick={() => onChange(opt.value)}
				>
					{opt.label}
				</button>
			))}
		</div>
	);
}
