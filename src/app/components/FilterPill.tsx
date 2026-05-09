import { FilterIcon } from "../icons";
import { setPreference } from "../preferences";
import { EVENTS } from "../../shared/constants/events";

interface FilterPillProps {
	activeGenre: string | null;
	onClear: () => void;
}

export function setActiveGenre(genre: string | null): void {
	setPreference("activeGenre", genre);
	window.dispatchEvent(new CustomEvent(EVENTS.PREFS_CHANGED));
}

export function clearActiveGenre(): void {
	setActiveGenre(null);
}

export function FilterPill({ activeGenre, onClear }: FilterPillProps) {
	if (!activeGenre) return null;

	return (
		<div className="filter-pill">
			<span
				className="filter-pill-icon"
				aria-hidden="true"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: inline SVG icon string from src/app/icons.ts (project pattern)
				dangerouslySetInnerHTML={{ __html: FilterIcon }}
			/>
			<span>Filtering by</span>
			<strong className="filter-pill-genre">{activeGenre}</strong>
			<button
				className="filter-pill-close"
				type="button"
				onClick={onClear}
				aria-label="Clear genre filter"
			>
				×
			</button>
		</div>
	);
}
