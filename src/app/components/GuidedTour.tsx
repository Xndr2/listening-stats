import { markTourSeen, type TargetRect, TOUR_STEPS, type TourStep } from "../tour";
import { TourPopover } from "./TourPopover";

const { useState, useLayoutEffect, useCallback, useRef, useEffect } = Spicetify.React;

const SPOTLIGHT_PAD = 6;

function scrollTarget(selector: string): void {
	const el = document.querySelector(selector);
	if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
}

function measureTarget(selector: string): TargetRect | null {
	const el = document.querySelector(selector);
	if (!el) return null;
	const r = el.getBoundingClientRect();
	if (r.width === 0 && r.height === 0) return null;
	return { top: r.top, left: r.left, width: r.width, height: r.height };
}

interface GuidedTourProps {
	active: boolean;
	version: string;
	steps?: TourStep[];
	onComplete: () => void;
}

export function GuidedTour({ active, version, steps = TOUR_STEPS, onComplete }: GuidedTourProps) {
	const [step, setStep] = useState(0);
	const stepRef = useRef(0);
	const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
	const timersRef = useRef<number[]>([]);

	useEffect(() => {
		return () => {
			timersRef.current.forEach(clearTimeout);
		};
	}, []);

	const finish = useCallback(() => {
		markTourSeen(version);
		onComplete();
	}, [version, onComplete]);

	const updateTarget = useCallback(
		(stepIndex: number) => {
			const s = steps[stepIndex];
			if (!s) return;
			timersRef.current.forEach(clearTimeout);
			timersRef.current = [];
			scrollTarget(s.selector);
			const refresh = () => setTargetRect(measureTarget(s.selector));
			refresh();
			timersRef.current.push(window.setTimeout(refresh, 160), window.setTimeout(refresh, 320));
		},
		[steps],
	);

	const handleNext = useCallback(() => {
		if (stepRef.current >= steps.length - 1) {
			finish();
		} else {
			const next = stepRef.current + 1;
			stepRef.current = next;
			setStep(next);
			updateTarget(next);
		}
	}, [finish, updateTarget, steps.length]);

	const handleBack = useCallback(() => {
		const prev = Math.max(0, stepRef.current - 1);
		stepRef.current = prev;
		setStep(prev);
		updateTarget(prev);
	}, [updateTarget]);

	useLayoutEffect(() => {
		if (active) {
			if (steps.length === 0) {
				finish();
				return;
			}
			stepRef.current = 0;
			setStep(0);
			updateTarget(0);
		}
	}, [active, updateTarget, steps.length, finish]);

	useEffect(() => {
		if (!active) return;
		const onViewportChange = () => {
			const s = steps[stepRef.current];
			if (s) setTargetRect(measureTarget(s.selector));
		};
		window.addEventListener("resize", onViewportChange);
		window.addEventListener("scroll", onViewportChange, true);
		return () => {
			window.removeEventListener("resize", onViewportChange);
			window.removeEventListener("scroll", onViewportChange, true);
		};
	}, [active, steps]);

	useLayoutEffect(() => {
		if (!active) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "ArrowRight") {
				handleNext();
			} else if (e.key === "ArrowLeft") {
				handleBack();
			} else if (e.key === "Escape") {
				finish();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [active, handleNext, handleBack, finish]);

	if (!active) return null;

	const hasTarget = targetRect !== null;

	const spotlightStyle = hasTarget
		? {
				position: "fixed" as const,
				top: targetRect.top - SPOTLIGHT_PAD,
				left: targetRect.left - SPOTLIGHT_PAD,
				width: targetRect.width + SPOTLIGHT_PAD * 2,
				height: targetRect.height + SPOTLIGHT_PAD * 2,
				borderRadius: 8,
				boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
				pointerEvents: "none" as const,
				zIndex: 10000,
			}
		: undefined;

	const overlay = (
		<div className={`tour-overlay${hasTarget ? " tour-overlay--targeted" : ""}`}>
			{hasTarget && <div className="tour-spotlight" style={spotlightStyle} />}
			<TourPopover
				step={step}
				steps={steps}
				onNext={handleNext}
				onBack={step > 0 ? handleBack : undefined}
				onSkip={finish}
				targetRect={targetRect}
			/>
		</div>
	);

	return Spicetify.ReactDOM.createPortal(overlay, document.body);
}
