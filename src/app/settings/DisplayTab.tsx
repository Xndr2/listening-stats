import { ITEMS_PER_LIST, PLAY_COUNT_VARIANTS } from "../../shared/settings/registry";
import { Icon } from "../components/Icon";
import { useSetting } from "../hooks/useSetting";
import { MAIN_SLOTS, ordered, RAIL_SLOTS, type SlotDef } from "../layout/Dashboard";
import { ChoiceRow, Row, Section, Switch, ToggleRow } from "./controls";

function OverviewRow() {
	const [hidden, setHidden] = useSetting("hiddenWidgets");
	return (
		<Row
			label="Overview"
			hint="The headline and the row of numbers at the top."
			control={
				<Switch
					label="Show Overview"
					checked={!hidden.includes("overview")}
					onChange={(on) => setHidden(on ? hidden.filter((h) => h !== "overview") : [...hidden, "overview"])}
				/>
			}
		/>
	);
}

function SectionList({ title, slots }: { title: string; slots: SlotDef[] }) {
	const [hidden, setHidden] = useSetting("hiddenWidgets");
	const [order, setOrder] = useSetting("widgetOrder");
	const list = ordered(slots, order);
	const move = (i: number, by: number) => {
		const ids = list.map((s) => s.id);
		[ids[i], ids[i + by]] = [ids[i + by], ids[i]];
		// Keep other columns' positions; replace this column's ids in one go.
		setOrder([...order.filter((id) => !ids.includes(id)), ...ids]);
	};
	return (
		<>
			<p className="ls-set-sub">{title}</p>
			{list.map((s, i) => (
				<Row
					key={s.id}
					label={s.label}
					control={
						<div className="ls-set-buttons">
							<button
								type="button"
								className="ls-icon-btn"
								aria-label={`Move ${s.label} up`}
								disabled={i === 0}
								onClick={() => move(i, -1)}
							>
								<Icon name="chevronDown" size={14} flip />
							</button>
							<button
								type="button"
								className="ls-icon-btn"
								aria-label={`Move ${s.label} down`}
								disabled={i === list.length - 1}
								onClick={() => move(i, 1)}
							>
								<Icon name="chevronDown" size={14} />
							</button>
							<Switch
								label={`Show ${s.label}`}
								checked={!hidden.includes(s.id)}
								onChange={(on) => setHidden(on ? hidden.filter((h) => h !== s.id) : [...hidden, s.id])}
							/>
						</div>
					}
				/>
			))}
		</>
	);
}

export function DisplayTab() {
	const [weekStart, setWeekStart] = useSetting("weekStart");
	const [items, setItems] = useSetting("itemsPerList");
	const [variant, setVariant] = useSetting("playCountVariant");
	const variantLabels: Record<(typeof PLAY_COUNT_VARIANTS)[number], string> = {
		pill: "Pill",
		bubble: "Bubble",
		minimal: "Minimal",
		off: "Off",
	};
	return (
		<>
			<Section title="Formats">
				<ToggleRow name="use24HourTime" label="24-hour clock" />
				<ChoiceRow
					label="Weeks start on"
					value={weekStart}
					onChange={setWeekStart}
					options={[
						{ value: "monday", label: "Monday" },
						{ value: "sunday", label: "Sunday" },
					]}
				/>
				<ChoiceRow
					label="Rows in top lists"
					value={String(items)}
					onChange={(v) => setItems(Number(v))}
					options={ITEMS_PER_LIST.map((n) => ({ value: String(n), label: String(n) }))}
				/>
			</Section>
			<Section
				title="Dashboard"
				description="Choose what shows on the dashboard and in which order. Hidden parts don't load anything."
			>
				<OverviewRow />
				<SectionList title="Main column" slots={MAIN_SLOTS} />
				<SectionList title="Side column" slots={RAIL_SLOTS} />
				<ToggleRow name="heatmapFit" label="Fit the heatmap to its box" hint="Off: fixed-size squares that scroll." />
			</Section>
			<Section
				title="Play count in the player bar"
				description="Shows how often you've played the current track, next to the song title."
			>
				<ChoiceRow
					label="Style"
					value={variant}
					onChange={setVariant}
					options={PLAY_COUNT_VARIANTS.map((v) => ({ value: v, label: variantLabels[v] }))}
				/>
				<ToggleRow
					name="playCountShowPeriod"
					label="Also show the current period"
					hint="For example 12 this month next to the all-time count."
				/>
			</Section>
			<Section title="Sharing">
				<ToggleRow name="showShareCaption" label="Put your username on share cards" />
			</Section>
		</>
	);
}
