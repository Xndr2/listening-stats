import type { TourStep } from "../hooks/useTour";

const { useState, useEffect, useRef, useCallback } = Spicetify.React;

const TOOLTIP_WIDTH = 320;
const TOOLTIP_HEIGHT = 180;
const OFFSET = 16;
const EDGE_PADDING = 16;
const REPOSITION_DEBOUNCE = 100;

interface TourOverlayProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onEnd: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

function computeTooltipPosition(
  targetRect: Rect,
  placement: "top" | "bottom" | "left" | "right",
): { top: number; left: number; actualPlacement: string } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = 0;
  let left = 0;
  let actualPlacement = placement;

  // Padding around the spotlight (8px on each side)
  const spotTop = targetRect.top - 8;
  const spotLeft = targetRect.left - 8;
  const spotWidth = targetRect.width + 16;
  const spotHeight = targetRect.height + 16;
  const spotRight = spotLeft + spotWidth;
  const spotBottom = spotTop + spotHeight;

  if (placement === "bottom" || placement === "top") {
    // Center horizontally relative to target
    left = targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2;

    if (placement === "bottom") {
      top = spotBottom + OFFSET;
      // Flip to top if overflow
      if (top + TOOLTIP_HEIGHT > vh - EDGE_PADDING) {
        top = spotTop - OFFSET - TOOLTIP_HEIGHT;
        actualPlacement = "top";
      }
    } else {
      top = spotTop - OFFSET - TOOLTIP_HEIGHT;
      // Flip to bottom if overflow
      if (top < EDGE_PADDING) {
        top = spotBottom + OFFSET;
        actualPlacement = "bottom";
      }
    }
  } else {
    // left or right -- center vertically relative to target
    top = targetRect.top + targetRect.height / 2 - TOOLTIP_HEIGHT / 2;

    if (placement === "right") {
      left = spotRight + OFFSET;
      if (left + TOOLTIP_WIDTH > vw - EDGE_PADDING) {
        left = spotLeft - OFFSET - TOOLTIP_WIDTH;
        actualPlacement = "left";
      }
    } else {
      left = spotLeft - OFFSET - TOOLTIP_WIDTH;
      if (left < EDGE_PADDING) {
        left = spotRight + OFFSET;
        actualPlacement = "right";
      }
    }
  }

  // Clamp to viewport
  left = Math.max(EDGE_PADDING, Math.min(left, vw - TOOLTIP_WIDTH - EDGE_PADDING));
  top = Math.max(EDGE_PADDING, Math.min(top, vh - TOOLTIP_HEIGHT - EDGE_PADDING));

  return { top, left, actualPlacement };
}

export function TourOverlay({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onEnd,
}: TourOverlayProps) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const debounceRef = useRef<number>(0);

  const updatePosition = useCallback(() => {
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) {
      // Target not found -- skip to next step
      onNext();
      return;
    }
    const rect = el.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    });
  }, [step.target, onNext]);

  // On mount and step change: scroll target into view, then measure
  useEffect(() => {
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) {
      onNext();
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Wait for scroll to settle before measuring
    const timer = setTimeout(() => {
      updatePosition();
    }, 300);
    return () => clearTimeout(timer);
  }, [step.target, updatePosition, onNext]);

  // Reposition on scroll/resize
  useEffect(() => {
    const handleReposition = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(updatePosition, REPOSITION_DEBOUNCE);
    };

    const scrollContainer = document.querySelector(
      ".main-view-container__scroll-node",
    );
    scrollContainer?.addEventListener("scroll", handleReposition);
    window.addEventListener("scroll", handleReposition);
    window.addEventListener("resize", handleReposition);

    return () => {
      clearTimeout(debounceRef.current);
      scrollContainer?.removeEventListener("scroll", handleReposition);
      window.removeEventListener("scroll", handleReposition);
      window.removeEventListener("resize", handleReposition);
    };
  }, [updatePosition]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEnd();
      } else if (e.key === "ArrowRight") {
        onNext();
      } else if (e.key === "ArrowLeft") {
        onPrev();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onEnd, onNext, onPrev]);

  if (!targetRect) return null;

  const placement = step.placement || "bottom";
  const { top: tooltipTop, left: tooltipLeft } = computeTooltipPosition(
    targetRect,
    placement,
  );

  const isLastStep = stepIndex === totalSteps - 1;

  return Spicetify.React.createElement(
    Spicetify.React.Fragment,
    null,
    // Click-away backdrop
    Spicetify.React.createElement("div", {
      className: "tour-backdrop",
      onClick: onEnd,
    }),
    // Spotlight
    Spicetify.React.createElement("div", {
      className: "tour-spotlight",
      style: {
        top: targetRect.top - 8,
        left: targetRect.left - 8,
        width: targetRect.width + 16,
        height: targetRect.height + 16,
      },
    }),
    // Tooltip
    Spicetify.React.createElement(
      "div",
      {
        className: "tour-tooltip",
        style: { top: tooltipTop, left: tooltipLeft },
      },
      Spicetify.React.createElement(
        "h4",
        { className: "tour-tooltip-title" },
        step.title,
      ),
      Spicetify.React.createElement(
        "p",
        { className: "tour-tooltip-content" },
        step.content,
      ),
      Spicetify.React.createElement(
        "div",
        { className: "tour-tooltip-footer" },
        Spicetify.React.createElement(
          "span",
          { className: "tour-tooltip-counter" },
          `${stepIndex + 1} of ${totalSteps}`,
        ),
        Spicetify.React.createElement(
          "div",
          { className: "tour-tooltip-actions" },
          stepIndex > 0
            ? Spicetify.React.createElement(
                "button",
                { className: "tour-btn", onClick: onPrev },
                "Back",
              )
            : null,
          Spicetify.React.createElement(
            "button",
            { className: "tour-btn", onClick: onEnd },
            "Skip",
          ),
          Spicetify.React.createElement(
            "button",
            {
              className: "tour-btn tour-btn--primary",
              onClick: isLastStep ? onEnd : onNext,
            },
            isLastStep ? "Done" : "Next",
          ),
        ),
      ),
    ),
  );
}
