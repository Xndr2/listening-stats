/**
 * A dropdown that follows the theme. The native <select> list is drawn by
 * the OS (white on Linux, whatever the Spotify theme), so this is a button
 * plus a popover listbox in the same style as LS's other menus. The popover
 * sits in the top layer, so it also works inside the settings dialog.
 */
import { useEffect, useId, useRef } from "react";
import { Icon } from "../Icon";
import "./Select.css";

export interface SelectOption<T extends string> {
	value: T;
	label: string;
}

export function Select<T extends string>({
	options,
	value,
	onChange,
	label,
	variant = "field",
}: {
	options: SelectOption<T>[];
	value: T;
	onChange: (v: T) => void;
	/** Accessible name; not shown. */
	label: string;
	/** "field" matches text inputs, "pill" matches the header controls. */
	variant?: "field" | "pill";
}) {
	const id = useId();
	const list = useRef<HTMLDivElement>(null);
	const current = options.find((o) => o.value === value);

	const items = () => [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])];
	// React 18 doesn't wire onToggle for popovers. Opening focuses the chosen option.
	useEffect(() => {
		const el = list.current;
		const onToggle = (e: Event) => {
			if ((e as ToggleEvent).newState !== "open") return;
			const all = items();
			(all.find((b) => b.getAttribute("aria-selected") === "true") ?? all[0])?.focus();
		};
		el?.addEventListener("toggle", onToggle);
		return () => el?.removeEventListener("toggle", onToggle);
	});
	const onKey = (e: React.KeyboardEvent) => {
		const all = items();
		const i = all.indexOf(document.activeElement as HTMLButtonElement);
		const next =
			e.key === "ArrowDown"
				? all[Math.min(all.length - 1, i + 1)]
				: e.key === "ArrowUp"
					? all[Math.max(0, i - 1)]
					: e.key === "Home"
						? all[0]
						: e.key === "End"
							? all[all.length - 1]
							: null;
		if (!next) return;
		e.preventDefault();
		next.focus();
	};

	return (
		<>
			<button
				type="button"
				className={`ls-select is-${variant}`}
				popovertarget={id}
				aria-haspopup="listbox"
				aria-label={`${label}: ${current?.label ?? ""}`}
			>
				<span className="ls-select-value">{current?.label}</span>
				<Icon name="chevronDown" size={12} />
			</button>
			<div
				id={id}
				ref={list}
				popover="auto"
				className="ls-menu ls-select-menu"
				role="listbox"
				aria-label={label}
				onKeyDown={onKey}
			>
				{options.map((o) => (
					<button
						key={o.value}
						type="button"
						role="option"
						aria-selected={o.value === value}
						className="ls-menu-item"
						onClick={() => {
							list.current?.hidePopover();
							if (o.value !== value) onChange(o.value);
						}}
					>
						<span>{o.label}</span>
						{o.value === value && <Icon name="check" />}
					</button>
				))}
			</div>
		</>
	);
}
