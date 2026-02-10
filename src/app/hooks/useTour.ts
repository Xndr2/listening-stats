import { TourOverlay } from "../components/TourOverlay";

const { useState, useCallback, createContext, useContext } =
  Spicetify.React;

export interface TourStep {
  target: string; // CSS selector
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
}

interface TourContextValue {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  totalSteps: number;
  startTour: (steps: TourStep[]) => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TourStep[]>([]);

  const endTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    setSteps([]);
  }, []);

  const startTour = useCallback((tourSteps: TourStep[]) => {
    setSteps(tourSteps);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev: number) => {
      if (prev >= steps.length - 1) {
        // At last step -- end the tour
        setTimeout(endTour, 0);
        return prev;
      }
      return prev + 1;
    });
  }, [steps.length, endTour]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev: number) => Math.max(0, prev - 1));
  }, []);

  const value: TourContextValue = {
    isActive,
    currentStep,
    steps,
    totalSteps: steps.length,
    startTour,
    nextStep,
    prevStep,
    endTour,
  };

  const overlay =
    isActive && steps.length > 0
      ? Spicetify.ReactDOM.createPortal(
          Spicetify.React.createElement(TourOverlay, {
            step: steps[currentStep],
            stepIndex: currentStep,
            totalSteps: steps.length,
            onNext: nextStep,
            onPrev: prevStep,
            onEnd: endTour,
          }),
          document.body,
        )
      : null;

  return Spicetify.React.createElement(
    TourContext.Provider,
    { value },
    children,
    overlay,
  );
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}
