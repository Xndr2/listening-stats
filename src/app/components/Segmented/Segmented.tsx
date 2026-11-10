import "./Segmented.css";

export interface SegmentOption<T extends string> {
	value: T;
	label: string;
	disabled?: boolean;
	title?: string;
}

/** A pill row of mutually exclusive choices (radio group semantics). */
export function Segmented<T extends string>({
	options,
	value,
	onChange,
	label,
	size = "md",
}: {
	options: SegmentOption<T>[];
	value: T;
	onChange: (v: T) => void;
	label: string;
	size?: "sm" | "md";
}) {
	const onKey = (e: React.KeyboardEvent, i: number) => {
		const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
		if (!dir) return;
		e.preventDefault();
		for (let j = 1; j <= options.length; j++) {
			const next = options[(i + dir * j + options.length) % options.length];
			if (!next.disabled) {
				onChange(next.value);
				(e.currentTarget.parentElement?.querySelector(`[data-value="${next.value}"]`) as HTMLElement | null)?.focus();
				return;
			}
		}
	};
	return (
		<div className={`ls-seg ls-seg-${size}`} role="radiogroup" aria-label={label}>
			{options.map((o, i) => (
				// biome-ignore lint/a11y/useSemanticElements: ARIA radio group of buttons is the standard segmented-control pattern; native radios can't be styled as pills reliably inside Spotify.
				<button
					key={o.value}
					type="button"
					role="radio"
					aria-checked={o.value === value}
					tabIndex={o.value === value ? 0 : -1}
					data-value={o.value}
					disabled={o.disabled}
					data-tip={o.title}
					className="ls-seg-opt"
					onClick={() => onChange(o.value)}
					onKeyDown={(e) => onKey(e, i)}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}
