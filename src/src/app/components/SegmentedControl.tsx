interface SegmentedControlProps {
	stops: number[];
	value: number;
	onSelect: (value: number) => void;
	formatLabel?: (val: number) => string;
	/** Show labels only at these values; other stops render as ticks */
	labelAt?: number[];
}

export function SegmentedControl({ stops, value, onSelect, formatLabel, labelAt }: SegmentedControlProps) {
	const selectedIndex = Math.max(0, stops.indexOf(value));
	const stopWidthPct = 100 / stops.length;
	const indicatorStyle = {
		position: "absolute" as const,
		top: "2px",
		bottom: "2px",
		left: `${selectedIndex * stopWidthPct}%`,
		width: `${stopWidthPct}%`,
		borderRadius: "3px",
		background: "var(--spice-button)",
		opacity: 0.85,
		transition: "left 0.2s ease, width 0.2s ease",
		pointerEvents: "none" as const,
	};

	const React = Spicetify.React;

	return React.createElement(
		"div",
		{ className: "segmented-control" },
		React.createElement("div", { className: "segmented-control-indicator", style: indicatorStyle }),
		...stops.map((stop, i) => {
			const showLabel = !labelAt || labelAt.includes(stop) || i === selectedIndex;
			const label = formatLabel ? formatLabel(stop) : `${stop / 1000}s`;
			return React.createElement(
				"div",
				{
					key: stop,
					className: `segmented-control-stop${i === selectedIndex ? " active" : ""}`,
					onClick: () => onSelect(stop),
					title: label,
				},
				showLabel ? label : null,
			);
		}),
	);
}
