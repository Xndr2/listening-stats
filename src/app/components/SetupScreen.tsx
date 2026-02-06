import * as LastFm from "../../services/lastfm";
import { activateProvider } from "../../services/providers";
import { Icons } from "../icons";

const { useState } = Spicetify.React;

interface SetupScreenProps {
  onProviderSelected: () => void;
}

export function SetupScreen({ onProviderSelected }: SetupScreenProps) {
  const [lfmUsername, setLfmUsername] = useState("");
  const [lfmApiKey, setLfmApiKey] = useState("");
  const [lfmValidating, setLfmValidating] = useState(false);
  const [lfmError, setLfmError] = useState("");

  const handleLastfmSelect = async () => {
    if (!lfmUsername.trim() || !lfmApiKey.trim()) {
      setLfmError("Both username and API key are required");
      return;
    }
    setLfmValidating(true);
    setLfmError("");
    try {
      const info = await LastFm.validateUser(lfmUsername.trim(), lfmApiKey.trim());
      LastFm.saveConfig({ username: info.username, apiKey: lfmApiKey.trim() });
      activateProvider("lastfm");
      onProviderSelected();
    } catch (err: any) {
      setLfmError(err.message || "Connection failed");
    } finally {
      setLfmValidating(false);
    }
  };

  const handleLocalSelect = () => {
    activateProvider("local");
    onProviderSelected();
  };

  return (
    <div className="setup-screen">
      <div className="setup-header">
        <h1 className="setup-title">Listening Stats</h1>
        <p className="setup-subtitle">Connect your Last.fm account to get started</p>
      </div>

      <div className="setup-main">
        <div className="setup-card primary">
          <div className="setup-card-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.422 0 3.19 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.284 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.63-3.932l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.595 0-.935.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.602l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.932-1.457-4.59-3.464l-.907-2.75c-1.155-3.573-2.997-4.893-6.653-4.893C2.144 5.333 0 7.89 0 12.233c0 4.18 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z"/>
            </svg>
          </div>
          <h3>Last.fm</h3>
          <p className="setup-card-desc">
            Accurate play counts and listening history across all your devices.
          </p>
          <ul className="setup-card-pros">
            <li>Accurate play counts</li>
            <li>Tracks across all devices</li>
            <li>7 time period options</li>
          </ul>

          <div className="setup-lastfm-form">
            <input
              className="lastfm-input"
              type="text"
              placeholder="Last.fm username"
              value={lfmUsername}
              onChange={(e: any) => setLfmUsername(e.target.value)}
              disabled={lfmValidating}
            />
            <input
              className="lastfm-input"
              type="text"
              placeholder="Last.fm API key"
              value={lfmApiKey}
              onChange={(e: any) => setLfmApiKey(e.target.value)}
              disabled={lfmValidating}
            />
            <div className="setup-links">
              <a
                className="lastfm-help-link standalone"
                href="https://github.com/Xndr2/listening-stats/wiki/Last.fm-Setup-Guide"
                target="_blank"
                rel="noopener noreferrer"
              >
                Setup guide
                <span dangerouslySetInnerHTML={{ __html: Icons.external }} />
              </a>
              <a
                className="lastfm-help-link standalone"
                href="https://www.last.fm/api/account/create"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get an API key
                <span dangerouslySetInnerHTML={{ __html: Icons.external }} />
              </a>
            </div>
            {lfmError && <div className="lastfm-error">{lfmError}</div>}
          </div>

          <button
            className="footer-btn primary"
            onClick={handleLastfmSelect}
            disabled={lfmValidating}
          >
            {lfmValidating ? "Connecting..." : "Connect & Start"}
          </button>
        </div>

        <div className="setup-divider">
          <span>or</span>
        </div>

        <button className="setup-alt-option" onClick={handleLocalSelect}>
          <span dangerouslySetInnerHTML={{ __html: Icons.music }} />
          <div>
            <strong>Use Local Tracking instead</strong>
            <span>Tracks on this device only, no account needed</span>
          </div>
        </button>
      </div>
    </div>
  );
}
