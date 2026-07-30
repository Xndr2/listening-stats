interface ThresholdSliderProps {
	/** Slider range is 0..max in whole units (seconds or percent) */
	max: number;
	value: number;
	/** Clicking a preset label snaps to it */
	presets: number[];
	onChange: (value: number) => void;
	formatValue: (value: number) => string;
}

/**
 * Slider for the play threshold. The green value box is draggable for custom
 * values (whole units only); the preset labels underneath snap on click.
 */
export function ThresholdSlider({ max, value, presets, onChange, formatValue }: ThresholdSliderProps) {
	const React = Spicetify.React;
	const railRef = React.useRef<HTMLDivElement | null>(null);

	const valueFromClientX = (clientX: number): number => {
		const rail = railRef.current;
		if (!rail) return value;
		const rect = rail.getBoundingClientRect();
		if (rect.width <= 0) return value;
		const ratio = (clientX - rect.left) / rect.width;
		return Math.max(0, Math.min(max, Math.round(ratio * max)));
	};

	const handlePointerDown = (e: { currentTarget: HTMLDivElement; pointerId: number; clientX: number }) => {
		e.currentTarget.setPointerCapture?.(e.pointerId);
		onChange(valueFromClientX(e.clientX));
	};

	const handlePointerMove = (e: { currentTarget: HTMLDivElement; pointerId: number; clientX: number }) => {
		if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
		onChange(valueFromClientX(e.clientX));
	};

	const handleKeyDown = (e: { key: string; preventDefault: () => void }) => {
		if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
			e.preventDefault();
			onChange(Math.max(0, value - 1));
		} else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
			e.preventDefault();
			onChange(Math.min(max, value + 1));
		}
	};

	const pct = max > 0 ? (value / max) * 100 : 0;

	return (
		<div className="threshold-slider">
			<div
				className="threshold-slider-rail"
				ref={railRef}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
			>
				<div className="threshold-slider-track" />
				<div className="threshold-slider-fill" style={{ width: `${pct}%` }} />
				<div
					className="threshold-slider-handle"
					style={{ left: `${pct}%` }}
					role="slider"
					tabIndex={0}
					aria-valuemin={0}
					aria-valuemax={max}
					aria-valuenow={value}
					aria-valuetext={formatValue(value)}
					onKeyDown={handleKeyDown}
				>
					{formatValue(value)}
				</div>
			</div>
			<div className="threshold-slider-presets">
				{presets.map((preset) => (
					<button
						key={preset}
						type="button"
						className={`threshold-slider-preset${preset === value ? " active" : ""}`}
						style={{ left: `${max > 0 ? (preset / max) * 100 : 0}%` }}
						onClick={() => onChange(preset)}
					>
						{formatValue(preset)}
					</button>
				))}
			</div>
		</div>
	);
}
