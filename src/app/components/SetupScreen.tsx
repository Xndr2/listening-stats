import { SetupWizard } from "./SetupWizard";

interface SetupScreenProps {
  onProviderSelected: () => void;
}

export function SetupScreen({ onProviderSelected }: SetupScreenProps) {
  return (
    <div className="setup-screen">
      <SetupWizard onComplete={onProviderSelected} />
    </div>
  );
}
