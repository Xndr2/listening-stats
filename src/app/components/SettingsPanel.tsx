import {
  clearApiCaches,
  resetRateLimit,
} from "../../services/spotify-api";
import { clearStatsCache } from "../../services/stats";
import { clearPollingData } from "../../services/tracker";
import { clearAllData as clearIndexedDB } from "../../services/storage";
import * as LastFm from "../../services/lastfm";
import { ListeningStats, ProviderType } from "../../types/listeningstats";
import {
  getSelectedProviderType,
  activateProvider,
} from "../../services/providers";
import { exportStatsAsJSON, exportStatsAsCSV, exportRawEventsAsJSON, exportRawEventsAsCSV } from "../../services/export";
import { Icons } from "../icons";

const { useState } = Spicetify.React;

interface SettingsPanelProps {
  onRefresh: () => void;
  onCheckUpdates: () => void;
  onProviderChanged?: () => void;
  onClose?: () => void;
  stats?: ListeningStats | null;
  period?: string;
}

const PROVIDER_NAMES: Record<ProviderType, string> = {
  local: "Local Tracking",
  spotify: "Spotify API",
  lastfm: "Last.fm",
};

export function SettingsPanel({
  onRefresh,
  onCheckUpdates,
  onProviderChanged,
  onClose,
  stats,
  period,
}: SettingsPanelProps) {
  const currentProvider = getSelectedProviderType();
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [lfmUsername, setLfmUsername] = useState("");
  const [lfmApiKey, setLfmApiKey] = useState("");
  const [lfmValidating, setLfmValidating] = useState(false);
  const [lfmError, setLfmError] = useState("");
  const lfmConnected = LastFm.isConnected();
  const lfmConfig = LastFm.getConfig();

  const switchProvider = (type: ProviderType) => {
    activateProvider(type);
    setShowProviderPicker(false);
    onProviderChanged?.();
  };

  const handleLastfmSwitch = async () => {
    if (!lfmUsername.trim() || !lfmApiKey.trim()) {
      setLfmError("Both fields are required");
      return;
    }
    setLfmValidating(true);
    setLfmError("");
    try {
      const info = await LastFm.validateUser(lfmUsername.trim(), lfmApiKey.trim());
      LastFm.saveConfig({ username: info.username, apiKey: lfmApiKey.trim() });
      switchProvider("lastfm");
    } catch (err: any) {
      setLfmError(err.message || "Connection failed");
    } finally {
      setLfmValidating(false);
    }
  };

  const handleLfmDisconnect = () => {
    LastFm.clearConfig();
    LastFm.clearLastfmCache();
    Spicetify.showNotification("Disconnected from Last.fm");
    onRefresh();
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h3 className="settings-title">Settings</h3>
        {onClose && (
          <button className="settings-close-btn" onClick={onClose}
            dangerouslySetInnerHTML={{ __html: Icons.close || "&times;" }}
          />
        )}
      </div>

      <div className="settings-provider">
        <h4 className="settings-section-title">Data Source</h4>
        <div className="settings-provider-current">
          <span>Currently using: <strong>{currentProvider ? PROVIDER_NAMES[currentProvider] : "None"}</strong></span>
          <button
            className="footer-btn"
            onClick={() => setShowProviderPicker(!showProviderPicker)}
          >
            Change
          </button>
        </div>

        {showProviderPicker && (
          <div className="settings-provider-picker">
            {lfmConnected || currentProvider === "lastfm" ? (
              <button
                className={`provider-option ${currentProvider === "lastfm" ? "active" : ""}`}
                onClick={() => switchProvider("lastfm")}
              >
                <strong>Last.fm</strong>
                <span>Connected as {lfmConfig?.username || "..."}</span>
              </button>
            ) : (
              <div className="provider-option lastfm-setup">
                <strong>Last.fm</strong>
                <div className="setup-lastfm-form compact">
                  <input
                    className="lastfm-input"
                    type="text"
                    placeholder="Username"
                    value={lfmUsername}
                    onChange={(e: any) => setLfmUsername(e.target.value)}
                    disabled={lfmValidating}
                  />
                  <input
                    className="lastfm-input"
                    type="text"
                    placeholder="API key"
                    value={lfmApiKey}
                    onChange={(e: any) => setLfmApiKey(e.target.value)}
                    disabled={lfmValidating}
                  />
                  {lfmError && <div className="lastfm-error">{lfmError}</div>}
                  <button
                    className="footer-btn primary"
                    onClick={handleLastfmSwitch}
                    disabled={lfmValidating}
                  >
                    {lfmValidating ? "Connecting..." : "Connect & Switch"}
                  </button>
                </div>
              </div>
            )}
            <button
              className={`provider-option ${currentProvider === "local" ? "active" : ""}`}
              onClick={() => switchProvider("local")}
            >
              <strong>Local Tracking</strong>
              <span>Tracks on this device with IndexedDB</span>
            </button>
          </div>
        )}
      </div>

      <div className="settings-row">
        <button className="footer-btn" onClick={() => { clearStatsCache(); onRefresh(); }}>
          Refresh
        </button>
        <button
          className="footer-btn"
          onClick={() => {
            resetRateLimit();
            clearApiCaches();
            clearStatsCache();
            LastFm.clearLastfmCache();
            Spicetify.showNotification("Cache cleared");
          }}
        >
          Clear Cache
        </button>
        <button className="footer-btn" onClick={onCheckUpdates}>
          Check Updates
        </button>
        {currentProvider === "local" && (
          <button
            className="footer-btn danger"
            onClick={() => {
              if (confirm("Delete all local tracking data? This cannot be undone.")) {
                clearIndexedDB();
                clearPollingData();
                Spicetify.showNotification("All local data cleared");
                onRefresh();
              }
            }}
          >
            Reset Local Data
          </button>
        )}
      </div>

      <div className="settings-export">
        <h4 className="settings-section-title">Export Data</h4>
        <div className="settings-row">
          <button
            className="footer-btn"
            disabled={!stats}
            onClick={() => stats && period && exportStatsAsJSON(stats, period)}
          >
            Export JSON
          </button>
          <button
            className="footer-btn"
            disabled={!stats}
            onClick={() => stats && period && exportStatsAsCSV(stats, period)}
          >
            Export CSV
          </button>
          {currentProvider === "local" && (
            <>
              <button
                className="footer-btn"
                onClick={() => { exportRawEventsAsJSON(); Spicetify.showNotification("Exporting..."); }}
              >
                Raw History (JSON)
              </button>
              <button
                className="footer-btn"
                onClick={() => { exportRawEventsAsCSV(); Spicetify.showNotification("Exporting..."); }}
              >
                Raw History (CSV)
              </button>
            </>
          )}
        </div>
      </div>

      {currentProvider === "lastfm" && lfmConnected && lfmConfig && (
        <div className="settings-lastfm">
          <h4 className="settings-section-title">Last.fm Account</h4>
          <div className="settings-lastfm-connected">
            <div className="settings-lastfm-info">
              <span
                className="lastfm-status-icon"
                dangerouslySetInnerHTML={{ __html: Icons.check }}
              />
              <span>Connected as <strong>{lfmConfig.username}</strong></span>
            </div>
            <button className="footer-btn danger" onClick={() => {
              handleLfmDisconnect();
              switchProvider("local");
            }}>
              Disconnect
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
