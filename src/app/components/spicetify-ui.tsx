/**
 * Safe wrappers around Spicetify.ReactComponent.* — those components are not
 * guaranteed to exist on every Spotify/Spicetify version, and rendering an
 * undefined element type crashes the whole route with Spotify's generic
 * "Something went wrong" page. Each wrapper degrades gracefully instead.
 */

type SpicetifyGlobals = {
	Spicetify?: {
		ReactComponent?: {
			TooltipWrapper?: unknown;
			Toggle?: unknown;
		};
	};
};

export interface TooltipProps {
	children?: React.ReactNode;
	label: string;
	placement?: string;
}

export function Tooltip({ children, label, placement }: TooltipProps) {
	const Native = (globalThis as SpicetifyGlobals).Spicetify?.ReactComponent?.TooltipWrapper as
		| React.FC<TooltipProps>
		| undefined;
	if (Native) {
		return (
			<Native label={label} placement={placement}>
				{children}
			</Native>
		);
	}
	// No extra wrapper element — children are often grid/flex cells and a
	// wrapping <span> would break their layout. The tooltip is lost, nothing else.
	return <>{children}</>;
}

export interface ToggleProps {
	value: boolean;
	onSelected: (v: boolean) => void;
}

export function Toggle({ value, onSelected }: ToggleProps) {
	const Native = (globalThis as SpicetifyGlobals).Spicetify?.ReactComponent?.Toggle as
		| React.FC<ToggleProps>
		| undefined;
	if (Native) {
		return <Native value={value} onSelected={onSelected} />;
	}
	return <input type="checkbox" checked={value} onChange={(e) => onSelected(e.currentTarget.checked)} />;
}
