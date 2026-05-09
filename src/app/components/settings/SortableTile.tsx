const { React } = Spicetify;

interface SortableTileProps {
	id: string;
	label: string;
	tileDragProps: { onPointerDown: (e: PointerEvent) => void };
	style?: React.CSSProperties;
	children?: React.ReactNode; // Toggle node (with its own stopPropagation wrapper)
}

/**
 * Whole tile is the drag target (Decision 4). The toggle slot wraps its children
 * in a div with stopPropagation on pointerdown so flipping the toggle does NOT
 * accidentally arm a drag (Decision 7).
 */
export function SortableTile({ id, label, tileDragProps, style, children }: SortableTileProps) {
	const stopProp = (e: React.PointerEvent) => e.stopPropagation();
	return (
		<div
			className="sortable-tile"
			data-tile-id={id}
			style={style}
			onPointerDown={tileDragProps.onPointerDown as any}
		>
			<div className="sortable-tile-label">{label}</div>
			<div className="sortable-tile-toggle" onPointerDown={stopProp}>
				{children}
			</div>
		</div>
	);
}
