/**
 * Dashboard layout as slots. Each slot lists widgets in order of preference
 * with the queries they need; the first one the current source can answer is
 * shown. That way a source missing something (Last.fm has no genres) gets a
 * different widget in that spot instead of a hole.
 */
import type { ReactNode } from "react";
import { type QueryName, supports } from "../../shared/providers/types";
import { useSetting } from "../hooks/useSetting";
import { useLiveData } from "../query/useProviderQuery";
import { useApp } from "../state";
import { Notices } from "../widgets/Notices/Notices";
import { Overview } from "../widgets/Overview/Overview";
import { Recent } from "../widgets/Recent/Recent";
import { ByHour, ByWeekday, GenreMix, Heatmap } from "../widgets/Rhythm/Rhythm";
import { TopArtistsMini } from "../widgets/TopArtistsMini/TopArtistsMini";
import { TopTable } from "../widgets/TopTable/TopTable";
import "./Dashboard.css";

interface Candidate {
	id: string;
	needs: QueryName[];
	render: () => ReactNode;
}

export interface SlotDef {
	id: string;
	label: string;
	candidates: Candidate[];
}

export const MAIN_SLOTS: SlotDef[] = [
	{
		id: "top",
		label: "Top lists",
		candidates: [{ id: "top-table", needs: ["topTracks"], render: () => <TopTable /> }],
	},
	{
		id: "recent",
		label: "Recently played",
		candidates: [{ id: "recent", needs: ["recent"], render: () => <Recent /> }],
	},
];

export const RAIL_SLOTS: SlotDef[] = [
	{ id: "hour", label: "By hour", candidates: [{ id: "by-hour", needs: ["hourly"], render: () => <ByHour /> }] },
	{
		id: "weekday",
		label: "By weekday",
		candidates: [{ id: "by-weekday", needs: ["weekday"], render: () => <ByWeekday /> }],
	},
	{
		id: "heatmap",
		label: "Last 26 weeks",
		candidates: [{ id: "heatmap", needs: ["daily"], render: () => <Heatmap /> }],
	},
	{
		id: "mix",
		label: "Genre mix",
		candidates: [
			{ id: "genre-mix", needs: ["topGenres"], render: () => <GenreMix /> },
			{ id: "top-artists-mini", needs: ["topArtists"], render: () => <TopArtistsMini /> },
		],
	},
];

/** Slots in the user's order; slots they never moved keep their default position. */
export function ordered(slots: SlotDef[], order: string[]): SlotDef[] {
	const rank = (s: SlotDef, i: number) => {
		const at = order.indexOf(s.id);
		return at < 0 ? i : at - 0.5;
	};
	return slots
		.map((s, i) => ({ s, r: rank(s, i) }))
		.sort((a, b) => a.r - b.r)
		.map((x) => x.s);
}

function Slots({ slots }: { slots: SlotDef[] }) {
	const { provider } = useApp();
	const [hidden] = useSetting("hiddenWidgets");
	const [order] = useSetting("widgetOrder");
	return (
		<>
			{ordered(slots, order)
				.filter((s) => !hidden.includes(s.id))
				.map((s) => {
					const c = s.candidates.find((x) => x.needs.every((q) => supports(provider, q)));
					return c ? (
						<div key={`${s.id}:${c.id}`} className={`ls-slot ls-slot-${s.id}`}>
							{c.render()}
						</div>
					) : null;
				})}
		</>
	);
}

export function Dashboard() {
	useLiveData();
	const [hidden] = useSetting("hiddenWidgets");
	return (
		<div className="ls-dash">
			<Notices />
			{!hidden.includes("overview") && <Overview />}
			<div className="ls-dash-grid">
				<div className="ls-dash-main">
					<Slots slots={MAIN_SLOTS} />
				</div>
				<aside className="ls-dash-rail" aria-label="Listening rhythm">
					<Slots slots={RAIL_SLOTS} />
				</aside>
			</div>
		</div>
	);
}
