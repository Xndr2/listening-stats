/** Building blocks for settings rows. One look, used everywhere in Settings. */
import { type ReactNode, useId } from "react";
import type { SettingName, SettingValue } from "../../shared/settings/registry";
import { Segmented } from "../components/Segmented/Segmented";
import { useSetting } from "../hooks/useSetting";

export function Row({
	label,
	hint,
	control,
	htmlFor,
}: {
	label: string;
	hint?: ReactNode;
	control: ReactNode;
	htmlFor?: string;
}) {
	return (
		<div className="ls-set-row">
			<div className="ls-set-text">
				{htmlFor ? (
					<label className="ls-set-label" htmlFor={htmlFor}>
						{label}
					</label>
				) : (
					<span className="ls-set-label">{label}</span>
				)}
				{hint && <span className="ls-set-hint">{hint}</span>}
			</div>
			<div className="ls-set-control">{control}</div>
		</div>
	);
}

export function Switch({
	checked,
	onChange,
	label,
}: {
	checked: boolean;
	onChange: (v: boolean) => void;
	label: string;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			className="ls-switch"
			onClick={() => onChange(!checked)}
		>
			<span />
		</button>
	);
}

type BoolSetting = { [K in SettingName]: SettingValue<K> extends boolean ? K : never }[SettingName];

export function ToggleRow({
	name,
	label,
	hint,
	invert = false,
}: {
	name: BoolSetting;
	label: string;
	hint?: ReactNode;
	invert?: boolean;
}) {
	const [value, set] = useSetting(name);
	const on = invert ? !value : (value as boolean);
	return (
		<Row
			label={label}
			hint={hint}
			control={<Switch label={label} checked={on} onChange={(v) => set((invert ? !v : v) as never)} />}
		/>
	);
}

export function ChoiceRow<T extends string>({
	label,
	hint,
	value,
	options,
	onChange,
}: {
	label: string;
	hint?: ReactNode;
	value: T;
	options: Array<{ value: T; label: string; disabled?: boolean }>;
	onChange: (v: T) => void;
}) {
	return (
		<Row
			label={label}
			hint={hint}
			control={<Segmented size="sm" label={label} value={value} options={options} onChange={onChange} />}
		/>
	);
}

export function Section({
	title,
	children,
	description,
}: {
	title: string;
	description?: ReactNode;
	children: ReactNode;
}) {
	const id = useId();
	return (
		<section className="ls-set-section" aria-labelledby={id}>
			<h3 id={id} className="ls-set-heading">
				{title}
			</h3>
			{description && <p className="ls-set-desc">{description}</p>}
			<div className="ls-set-rows">{children}</div>
		</section>
	);
}

export function TextField({
	id,
	value,
	onChange,
	placeholder,
	type = "text",
	invalid,
	autoComplete = "off",
}: {
	id: string;
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	type?: "text" | "password";
	invalid?: boolean;
	autoComplete?: string;
}) {
	return (
		<input
			id={id}
			className="ls-input"
			type={type}
			value={value}
			placeholder={placeholder}
			aria-invalid={invalid || undefined}
			autoComplete={autoComplete}
			spellCheck={false}
			onChange={(e) => onChange(e.target.value)}
		/>
	);
}
