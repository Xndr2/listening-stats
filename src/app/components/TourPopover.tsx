import { type TargetRect, TOUR_STEPS, type TourStep } from "../tour";

const { useRef, useLayoutEffect, useState } = Spicetify.React;

interface TourPopoverProps {
	step: number;
	steps?: TourStep[];
	onNext: () => void;
	onBack?: () => void;
	onSkip: () => void;
	targetRect?: TargetRect | null;
}

const POPOVER_WIDTH = 280;
const GAP = 12;
const EDGE_PAD = 8;
const FALLBACK_HEIGHT = 210;

export function computeStyle(rect: TargetRect, popoverHeight: number): React.CSSProperties {
	const viewportHeight = window.innerHeight;
	const viewportWidth = window.innerWidth;
	const belowTop = rect.top + rect.height + GAP;
	const aboveTop = rect.top - popoverHeight - GAP;
	let top: number;
	if (belowTop + popoverHeight <= viewportHeight - EDGE_PAD) {
		top = belowTop;
	} else if (aboveTop >= EDGE_PAD) {
		top = aboveTop;
	} else {
		top = EDGE_PAD;
	}
	let left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
	left = Math.max(EDGE_PAD, Math.min(left, viewportWidth - POPOVER_WIDTH - EDGE_PAD));
	return {
		position: "fixed",
		top,
		left,
		zIndex: 10001,
		maxHeight: `calc(100vh - ${EDGE_PAD * 2}px)`,
		overflowY: "auto",
	};
}

export function TourPopover({
	step,
	steps = TOUR_STEPS,
	onNext,
	onBack,
	onSkip,
	targetRect,
}: TourPopoverProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [style, setStyle] = useState<React.CSSProperties | undefined>(undefined);
	const currentStep = steps[step];
	const isLast = step === steps.length - 1;
	const positioned = targetRect != null;

	useLayoutEffect(() => {
		if (!positioned) {
			setStyle(undefined);
			return;
		}
		const h = ref.current?.offsetHeight || FALLBACK_HEIGHT;
		setStyle(computeStyle(targetRect, h));
	}, [positioned, targetRect, step]);

	const className = `tour-popover${positioned ? " tour-popover--positioned" : ""}`;

	return (
		<div ref={ref} className={className} style={style}>
			<div className="tour-step-counter">
				Step {step + 1} of {steps.length}
			</div>
			<div className="tour-label">{currentStep.label}</div>
			<div className="tour-text">{currentStep.text}</div>
			<div className="tour-footer">
				{onBack ? (
					<button type="button" className="tour-btn-back" onClick={onBack}>
						Back
					</button>
				) : (
					<button type="button" className="tour-btn-skip" onClick={onSkip}>
						Skip
					</button>
				)}
				<div className="tour-dots">
					{steps.map((_, i) => (
						<span key={i} className={`tour-dot${i === step ? " active" : ""}`} />
					))}
				</div>
				<button type="button" className="tour-btn-next" onClick={onNext}>
					{isLast ? "Finish" : "Next"}
				</button>
			</div>
		</div>
	);
}
