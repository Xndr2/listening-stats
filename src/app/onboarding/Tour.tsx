/**
 * A four-step tour that points at the parts people look for. Runs once per
 * major version and can be restarted from Settings. Each step is anchored
 * to an element by selector; a missing element skips its step.
 */
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { APP_VERSION } from "../../shared/constants/app";
import { V2_KEYS } from "../../shared/constants/storage-keys";
import "./Onboarding.css";

const STEPS = [
	{
		sel: ".ls-source",
		title: "Where your stats come from",
		text: "Switch between this device, stats.fm and Last.fm here.",
	},
	{
		sel: ".ls-period-wide, .ls-period-narrow",
		title: "Pick a period",
		text: "Everything on the page follows this. Last month is new.",
	},
	{
		sel: '[data-widget="top-table"]',
		title: "Your top lists",
		text: "Switch between tracks, artists, albums and genres. Click a cover to play it.",
	},
	{
		sel: '.ls-icon-btn[aria-label="Settings"]',
		title: "Make it yours",
		text: "Hide parts of the page, set when a play counts, and add auto playlists.",
	},
];

const MAJOR = APP_VERSION.split(".")[0];
export const TOUR_EVENT = "listening-stats:start-tour";

export function shouldShowTour(): boolean {
	try {
		return (localStorage.getItem(V2_KEYS.TOUR_SEEN_VERSION) ?? "").split(".")[0] !== MAJOR;
	} catch {
		return false;
	}
}

export function Tour({ onDone }: { onDone: () => void }) {
	const [i, setI] = useState(0);
	const [rect, setRect] = useState<DOMRect | null>(null);
	const step = STEPS[i];

	const finish = useCallback(() => {
		localStorage.setItem(V2_KEYS.TOUR_SEEN_VERSION, APP_VERSION);
		onDone();
	}, [onDone]);

	// Re-measure when the step changes and when the window resizes.
	useLayoutEffect(() => {
		const el = [...document.querySelectorAll<HTMLElement>(step.sel)].find((e) => e.offsetParent !== null);
		if (!el) {
			if (i < STEPS.length - 1) setI(i + 1);
			else finish();
			return;
		}
		el.scrollIntoView({ block: "nearest" });
		const measure = () => setRect(el.getBoundingClientRect());
		measure();
		window.addEventListener("resize", measure);
		// The page scrolls inside its own container, so listen in the capture phase.
		window.addEventListener("scroll", measure, true);
		return () => {
			window.removeEventListener("resize", measure);
			window.removeEventListener("scroll", measure, true);
		};
	}, [i, step.sel, finish]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [finish]);

	if (!rect) return null;
	const below = rect.bottom + 180 < window.innerHeight;
	const left = Math.min(Math.max(12, rect.left), window.innerWidth - 332);
	// Portal to <body>: inside the page container `position: fixed` would be
	// relative to the container (container-type makes it the containing block).
	return createPortal(
		<div className="ls-portal">
			<div
				className="ls-tour-ring"
				style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
				aria-hidden="true"
			/>
			<div
				className="ls-tour"
				role="dialog"
				aria-label={`Tour step ${i + 1} of ${STEPS.length}`}
				style={below ? { top: rect.bottom + 14, left } : { top: Math.max(12, rect.top - 170), left }}
			>
				<p className="ls-tour-title">{step.title}</p>
				<p className="ls-tour-text">{step.text}</p>
				<div className="ls-tour-foot">
					<span className="ls-muted ls-num">
						{i + 1} of {STEPS.length}
					</span>
					<button type="button" className="ls-link" onClick={finish}>
						Skip
					</button>
					<button
						type="button"
						className="ls-btn-primary"
						onClick={() => (i < STEPS.length - 1 ? setI(i + 1) : finish())}
					>
						{i < STEPS.length - 1 ? "Next" : "Done"}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
