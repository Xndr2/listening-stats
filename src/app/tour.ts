import { LS_KEYS } from "../shared/constants/storage-keys";

export interface TargetRect {
	top: number;
	left: number;
	width: number;
	height: number;
}

export interface TourStep {
	id: string;
	label: string;
	text: string;
	selector: string;
}

const BASE_TOUR_STEPS: TourStep[] = [
	{
		id: "health",
		label: "Health Indicator",
		text: "This dot shows your tracking status. Green means data is flowing, yellow means it’s been a while, and red means something needs attention. Works for both local and stats.fm tracking.",
		selector: '[data-tour-target="health"], .header-provider-pill',
	},
	{
		id: "period",
		label: "Time Window & World",
		text: "Pick a time range and every section on the dashboard updates to match. Use the World tab at the end for global charts from stats.fm. Available periods depend on your tracking provider.",
		selector: '[data-tour-target="period"], .period-tabs',
	},
];

const SECTION_TOUR_STEPS: Record<string, TourStep> = {
	overview: {
		id: "overview",
		label: "Overview Cards",
		text: "Your headline stats for the selected period include total plays, unique artists, listening streak, and more. The cards shown depend on your provider and tier.",
		selector: '[data-section-id="overview"]',
	},
	lists: {
		id: "lists",
		label: "Top Lists",
		text: "Your most-played tracks, artists, and albums ranked side by side. Click any item to jump straight to it in Spotify.",
		selector: '[data-section-id="top-lists"]',
	},
	activity: {
		id: "activity",
		label: "Activity Charts",
		text: "Hourly and daily listening patterns visualized as charts. Discover your peak hours and most active days of the week.",
		selector: '[data-section-id="activity"]',
	},
	consistency: {
		id: "consistency",
		label: "Consistency",
		text: "See how regularly you listened in this period, including active days, average intensity, and your longest silent gap.",
		selector: '[data-section-id="consistency"]',
	},
};

const ACTION_TOUR_STEPS: TourStep[] = [
	{
		id: "share",
		label: "Share Card",
		text: "Generate a shareable image of your stats. Download it as a PNG or copy it straight to your clipboard.",
		selector: '[data-tour-target="share"], [aria-label="Share card"]',
	},
	{
		id: "gear",
		label: "Settings",
		text: "Customize everything by reordering or hiding sections, switching tracking providers, managing your data, and connecting Last.fm for world charts.",
		selector: '[data-tour-target="settings"], [aria-label="Open settings"]',
	},
];

export interface TourContext {
	activePage: string;
	sectionIds: string[];
	hasShare: boolean;
}

export function getTourSteps(context?: TourContext): TourStep[] {
	if (!context) {
		return [
			...BASE_TOUR_STEPS,
			SECTION_TOUR_STEPS.overview,
			SECTION_TOUR_STEPS.lists,
			SECTION_TOUR_STEPS.activity,
			...ACTION_TOUR_STEPS,
		];
	}
	if (context.activePage === "world") {
		return [BASE_TOUR_STEPS[0], BASE_TOUR_STEPS[1], ACTION_TOUR_STEPS[1]];
	}
	const sectionSteps = context.sectionIds
		.map((id) => SECTION_TOUR_STEPS[id])
		.filter((s): s is TourStep => !!s);
	const actionSteps = context.hasShare
		? ACTION_TOUR_STEPS
		: ACTION_TOUR_STEPS.filter((s) => s.id !== "share");
	return [...BASE_TOUR_STEPS, ...sectionSteps, ...actionSteps];
}

export const TOUR_STEPS: TourStep[] = getTourSteps();

export function getMajorVersion(version: string): string {
	const match = version.match(/^(\d+)/);
	return match ? match[1] : "0";
}

export function shouldAutoStartTour(currentVersion: string): boolean {
	const seen = localStorage.getItem(LS_KEYS.TOUR_SEEN_VERSION);
	if (!seen) return true;
	return seen !== getMajorVersion(currentVersion);
}

export function markTourSeen(currentVersion: string): void {
	localStorage.setItem(LS_KEYS.TOUR_SEEN_VERSION, getMajorVersion(currentVersion));
}

export function resetTourSeen(): void {
	localStorage.removeItem(LS_KEYS.TOUR_SEEN_VERSION);
}
