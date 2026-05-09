import { ChevronGripIcon } from "../../icons";

const { React } = Spicetify;

interface SortableRowProps {
	id: string;
	label: string;
	dragHandleProps: { onPointerDown: (e: PointerEvent) => void };
	style?: React.CSSProperties;
	children?: React.ReactNode; // Toggle slot (right side)
}

export function SortableRow({ id, label, dragHandleProps, style, children }: SortableRowProps) {
	return (
		<div className="sortable-row" data-row-id={id} style={style}>
			<button
				type="button"
				className="settings-drag-handle"
				aria-label={`Drag ${label}`}
				onPointerDown={(e) => dragHandleProps.onPointerDown(e.nativeEvent)}
				dangerouslySetInnerHTML={{ __html: ChevronGripIcon }}
			/>
			<div className="sortable-row-label">{label}</div>
			<div className="sortable-row-toggle">{children}</div>
		</div>
	);
}
