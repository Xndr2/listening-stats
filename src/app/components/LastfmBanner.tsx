import * as LastFm from "../../services/lastfm";
import { Icons } from "../icons";

const { useState, useEffect } = Spicetify.React;

type BannerState = "prompt" | "form" | "validating" | "connected" | "error";

interface LastfmBannerProps {
  onConnected: () => void;
}

export function LastfmBanner({ onConnected }: LastfmBannerProps) {
  const [state, setState] = useState<BannerState>(
    LastFm.isConnected() ? "connected" : "prompt",
  );
  const [username, setUsername] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [userInfo, setUserInfo] = useState<LastFm.LastfmUserInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (LastFm.isConnected()) {
      LastFm.getUserInfo().then((info) => {
        if (info) setUserInfo(info);
      });
    }
  }, []);

  if (dismissed && state === "prompt") return null;

  const handleValidate = async () => {
    if (!username.trim() || !apiKey.trim()) {
      setError("Both fields are required");
      return;
    }

    setState("validating");
    setError("");

    try {
      const info = await LastFm.validateUser(username.trim(), apiKey.trim());
      LastFm.saveConfig({ username: info.username, apiKey: apiKey.trim() });
      setUserInfo(info);
      setState("connected");
      onConnected();
      Spicetify.showNotification(`Connected to Last.fm as ${info.username}`);
    } catch (err: any) {
      setError(err.message || "Validation failed");
      setState("error");
    }
  };

  const handleDisconnect = () => {
    LastFm.clearConfig();
    LastFm.clearLastfmCache();
    setUserInfo(null);
    setUsername("");
    setApiKey("");
    setState("prompt");
    onConnected();
    Spicetify.showNotification("Disconnected from Last.fm");
  };

  if (state === "connected" && userInfo) {
    return (
      <div className="lastfm-banner connected">
        <div className="lastfm-banner-content">
          <div className="lastfm-connected-info">
            <span
              className="lastfm-status-icon"
              dangerouslySetInnerHTML={{ __html: Icons.check }}
            />
            <div>
              <div className="lastfm-connected-user">
                Connected as <strong>{userInfo.username}</strong>
              </div>
              <div className="lastfm-connected-scrobbles">
                {userInfo.totalScrobbles.toLocaleString()} total scrobbles
              </div>
            </div>
          </div>
          <button className="lastfm-btn secondary" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  if (state === "form" || state === "validating" || state === "error") {
    return (
      <div className="lastfm-banner form">
        <div className="lastfm-banner-header">
          <h3 className="lastfm-banner-title">Connect Last.fm</h3>
          <button
            className="lastfm-close-btn"
            onClick={() => {
              setState("prompt");
              setError("");
            }}
            dangerouslySetInnerHTML={{ __html: Icons.close }}
          />
        </div>
        <p className="lastfm-banner-desc">
          Get actual play counts for your top tracks, artists, and albums.
        </p>
        <div className="lastfm-form">
          <div className="lastfm-field">
            <label className="lastfm-label">Username</label>
            <input
              className="lastfm-input"
              type="text"
              placeholder="Your Last.fm username"
              value={username}
              onChange={(e: any) => setUsername(e.target.value)}
              disabled={state === "validating"}
            />
          </div>
          <div className="lastfm-field">
            <label className="lastfm-label">
              API Key
              <a
                className="lastfm-help-link"
                href="https://www.last.fm/api/account/create"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get one here
                <span dangerouslySetInnerHTML={{ __html: Icons.external }} />
              </a>
            </label>
            <input
              className="lastfm-input"
              type="text"
              placeholder="Your Last.fm API key"
              value={apiKey}
              onChange={(e: any) => setApiKey(e.target.value)}
              disabled={state === "validating"}
            />
          </div>
          {error && <div className="lastfm-error">{error}</div>}
          <button
            className="lastfm-btn primary"
            onClick={handleValidate}
            disabled={state === "validating"}
          >
            {state === "validating" ? "Validating..." : "Connect"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lastfm-banner prompt">
      <div className="lastfm-banner-content">
        <div className="lastfm-prompt-text">
          <strong>Get play counts</strong>
          <span>
            Connect Last.fm to see how many times you've played each track
          </span>
        </div>
        <div className="lastfm-prompt-actions">
          <button
            className="lastfm-btn primary"
            onClick={() => setState("form")}
          >
            Connect
          </button>
          <button
            className="lastfm-close-btn"
            onClick={() => setDismissed(true)}
            dangerouslySetInnerHTML={{ __html: Icons.close }}
          />
        </div>
      </div>
    </div>
  );
}
