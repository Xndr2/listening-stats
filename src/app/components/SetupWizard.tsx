import * as LastFm from "../../services/lastfm";
import { activateProvider } from "../../services/providers";
import * as Statsfm from "../../services/statsfm";
import { Icons } from "../icons";

const { useState, useEffect } = Spicetify.React;

type ProviderChoice = "statsfm" | "lastfm" | "local" | null;
type WizardStep = "choose" | "configure" | "validate" | "success";

const STEPS: WizardStep[] = ["choose", "configure", "validate", "success"];

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [provider, setProvider] = useState<ProviderChoice>(null);

  // Configure step state
  const [username, setUsername] = useState("");
  const [apiKey, setApiKey] = useState("");

  // Validate step state
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState("");

  // Success step state
  const [confirmedUsername, setConfirmedUsername] = useState("");

  const currentStep = STEPS[stepIndex];

  const goBack = () => {
    if (stepIndex > 0) {
      setValidationError("");
      setValidating(false);
      setStepIndex(stepIndex - 1);
    }
  };

  const handleChooseProvider = (choice: ProviderChoice) => {
    if (choice === "local") {
      activateProvider("local");
      onComplete();
      return;
    }
    setProvider(choice);
    setUsername("");
    setApiKey("");
    setValidationError("");
    setStepIndex(1);
  };

  const handleConfigureNext = () => {
    if (provider === "statsfm" && !username.trim()) return;
    if (provider === "lastfm" && (!username.trim() || !apiKey.trim())) return;
    setStepIndex(2);
  };

  const providerLabel =
    provider === "statsfm"
      ? "stats.fm"
      : provider === "lastfm"
        ? "Last.fm"
        : "";

  const canAdvanceConfigure =
    provider === "statsfm"
      ? username.trim().length > 0
      : provider === "lastfm"
        ? username.trim().length > 0 && apiKey.trim().length > 0
        : false;

  return (
    <div className="setup-wizard">
      {/* Progress dots */}
      <div className="wizard-progress">
        {STEPS.map((step, i) => {
          let cls = "wizard-dot";
          if (i === stepIndex) cls += " wizard-dot--active";
          else if (i < stepIndex) cls += " wizard-dot--completed";
          return <div key={step} className={cls} />;
        })}
      </div>

      {/* Step content */}
      <div className="wizard-step">
        {currentStep === "choose" && (
          <ChooseStep onChoose={handleChooseProvider} />
        )}
        {currentStep === "configure" && (
          <ConfigureStep
            provider={provider!}
            username={username}
            apiKey={apiKey}
            onUsernameChange={setUsername}
            onApiKeyChange={setApiKey}
            onBack={goBack}
            onNext={handleConfigureNext}
            canAdvance={canAdvanceConfigure}
          />
        )}
        {currentStep === "validate" && (
          <ValidateStep
            provider={provider!}
            username={username}
            apiKey={apiKey}
            validating={validating}
            error={validationError}
            onValidating={setValidating}
            onError={setValidationError}
            onSuccess={(name: string) => {
              setConfirmedUsername(name);
              setStepIndex(3);
            }}
            onBack={goBack}
          />
        )}
        {currentStep === "success" && (
          <SuccessStep
            provider={provider!}
            username={confirmedUsername}
            onComplete={onComplete}
          />
        )}
      </div>
    </div>
  );
}

/* ===== Step Components ===== */

function ChooseStep({
  onChoose,
}: {
  onChoose: (choice: ProviderChoice) => void;
}) {
  return (
    <div>
      <h2 className="wizard-step-title">Choose your data source</h2>
      <p className="wizard-step-desc">
        Select where your listening stats come from.
      </p>

      <div
        className="wizard-card recommended"
        onClick={() => onChoose("statsfm")}
      >
        <div className="wizard-card-header">
          <div className="wizard-card-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4l-4 4-4-4H4a2 2 0 0 1-2-2V4zm6 3a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V8a1 1 0 0 0-1-1zm4-1a1 1 0 0 0-1 1v6a1 1 0 0 0 2 0V7a1 1 0 0 0-1-1zm4 2a1 1 0 0 0-1 1v3a1 1 0 0 0 2 0V9a1 1 0 0 0-1-1z" />
            </svg>
          </div>
          <div>
            <strong>stats.fm</strong>
            <span className="setup-badge">Recommended</span>
          </div>
        </div>
        <p className="wizard-card-desc">
          Accurate play counts and listening time. Just needs your username.
        </p>
      </div>

      <div className="wizard-card" onClick={() => onChoose("lastfm")}>
        <div className="wizard-card-header">
          <div className="wizard-card-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.422 0 3.19 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.284 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.63-3.932l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.595 0-.935.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.602l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.932-1.457-4.59-3.464l-.907-2.75c-1.155-3.573-2.997-4.893-6.653-4.893C2.144 5.333 0 7.89 0 12.233c0 4.18 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z" />
            </svg>
          </div>
          <div>
            <strong>Last.fm</strong>
          </div>
        </div>
        <p className="wizard-card-desc">
          Accurate play counts across all devices. Requires an API key.
        </p>
      </div>

      <div className="setup-divider">
        <span>or</span>
      </div>

      <button
        className="setup-alt-option"
        onClick={() => onChoose("local")}
      >
        <span dangerouslySetInnerHTML={{ __html: Icons.music }} />
        <div>
          <strong>Use Local Tracking instead</strong>
          <span>Tracks on this device only, no account needed</span>
        </div>
      </button>
    </div>
  );
}

function ConfigureStep({
  provider,
  username,
  apiKey,
  onUsernameChange,
  onApiKeyChange,
  onBack,
  onNext,
  canAdvance,
}: {
  provider: "statsfm" | "lastfm";
  username: string;
  apiKey: string;
  onUsernameChange: (v: string) => void;
  onApiKeyChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  canAdvance: boolean;
}) {
  return (
    <div>
      <h2 className="wizard-step-title">
        Configure {provider === "statsfm" ? "stats.fm" : "Last.fm"}
      </h2>

      {provider === "statsfm" && (
        <div className="wizard-form">
          <input
            className="lastfm-input"
            type="text"
            placeholder="stats.fm username"
            value={username}
            onChange={(e: any) => onUsernameChange(e.target.value)}
            onKeyDown={(e: any) => {
              if (e.key === "Enter" && canAdvance) onNext();
            }}
          />
          <p className="wizard-helper">
            Your stats.fm username (from the URL bar, not your display name).{" "}
            <a
              href="https://stats.fm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Don't have an account? Create one at stats.fm
            </a>
          </p>
        </div>
      )}

      {provider === "lastfm" && (
        <div className="wizard-form">
          <input
            className="lastfm-input"
            type="text"
            placeholder="Last.fm username"
            value={username}
            onChange={(e: any) => onUsernameChange(e.target.value)}
          />
          <input
            className="lastfm-input"
            type="text"
            placeholder="Last.fm API key"
            value={apiKey}
            onChange={(e: any) => onApiKeyChange(e.target.value)}
            onKeyDown={(e: any) => {
              if (e.key === "Enter" && canAdvance) onNext();
            }}
          />
          <div className="wizard-helper">
            <p style={{ margin: "0 0 4px 0" }}>How to get your API key:</p>
            <ol style={{ margin: 0, paddingLeft: "18px" }}>
              <li>
                Visit{" "}
                <a
                  href="https://www.last.fm/api/account/create"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  last.fm/api/account/create
                </a>
              </li>
              <li>Fill in the application form (any name works)</li>
              <li>Copy the API key shown on the next page</li>
            </ol>
          </div>
        </div>
      )}

      <div className="wizard-actions">
        <button className="footer-btn" onClick={onBack}>
          Back
        </button>
        <button
          className="footer-btn primary"
          onClick={onNext}
          disabled={!canAdvance}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function ValidateStep({
  provider,
  username,
  apiKey,
  validating,
  error,
  onValidating,
  onError,
  onSuccess,
  onBack,
}: {
  provider: "statsfm" | "lastfm";
  username: string;
  apiKey: string;
  validating: boolean;
  error: string;
  onValidating: (v: boolean) => void;
  onError: (v: string) => void;
  onSuccess: (confirmedName: string) => void;
  onBack: () => void;
}) {
  const runValidation = () => {
    onValidating(true);
    onError("");

    if (provider === "statsfm") {
      Statsfm.validateUser(username.trim())
        .then((info) => {
          Statsfm.saveConfig({ username: info.customId, isPlus: info.isPlus });
          activateProvider("statsfm");
          onSuccess(info.customId);
        })
        .catch((err: any) => {
          onError(err.message || "Connection failed");
          onValidating(false);
        });
    } else {
      LastFm.validateUser(username.trim(), apiKey.trim())
        .then((info) => {
          LastFm.saveConfig({ username: info.username, apiKey: apiKey.trim() });
          activateProvider("lastfm");
          onSuccess(info.username);
        })
        .catch((err: any) => {
          onError(err.message || "Connection failed");
          onValidating(false);
        });
    }
  };

  useEffect(() => {
    runValidation();
  }, []);

  if (error) {
    return (
      <div>
        <h2 className="wizard-step-title">Validation Failed</h2>
        <div className="wizard-error">{error}</div>
        <div className="wizard-actions">
          <button className="footer-btn" onClick={onBack}>
            Back
          </button>
          <button
            className="footer-btn primary"
            onClick={() => {
              onError("");
              runValidation();
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-validating">
      <div className="wizard-spinner" />
      <p>Validating your account...</p>
    </div>
  );
}

function SuccessStep({
  provider,
  username,
  onComplete,
}: {
  provider: "statsfm" | "lastfm";
  username: string;
  onComplete: () => void;
}) {
  const providerLabel =
    provider === "statsfm" ? "stats.fm" : "Last.fm";

  return (
    <div className="wizard-success">
      <div className="wizard-success-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <h2 className="wizard-step-title">You're all set!</h2>
      <p className="wizard-step-desc">
        Connected to <strong>{providerLabel}</strong> as{" "}
        <strong>{username}</strong>.
      </p>
      <button className="footer-btn primary" onClick={onComplete}>
        Start Exploring
      </button>
    </div>
  );
}
