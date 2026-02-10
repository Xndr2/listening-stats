import {
  exportRawEventsAsCSV,
  exportRawEventsAsJSON,
  exportStatsAsCSV,
  exportStatsAsJSON,
} from "../../services/export";
import * as LastFm from "../../services/lastfm";
import { getPreferences, setPreference } from "../../services/preferences";
import {
  activateProvider,
  clearProviderSelection,
  getSelectedProviderType,
} from "../../services/providers";
import { clearApiCaches, resetRateLimit } from "../../services/spotify-api";
import { clearStatsCache } from "../../services/stats";
import * as Statsfm from "../../services/statsfm";
import { clearAllData as clearIndexedDB } from "../../services/storage";
import {
  clearPollingData,
  isLoggingEnabled,
  setLoggingEnabled,
} from "../../services/tracker";
import { ListeningStats, ProviderType } from "../../types/listeningstats";
import { Icons } from "../icons";

const { useState } = Spicetify.React;

function SettingsCategory({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="settings-category">
      <button
        className={`settings-category-header ${open ? "open" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <span>{title}</span>
        <span className={`settings-chevron ${open ? "open" : ""}`} />
      </button>
      {open && <div className="settings-category-body">{children}</div>}
    </div>
  );
}

interface SettingsPanelProps {
  onRefresh: () => void;
  onCheckUpdates: () => void;
  onProviderChanged?: () => void;
  onClose?: () => void;
  onReset?: () => void;
  stats?: ListeningStats | null;
  period?: string;
}

const PROVIDER_NAMES: Record<ProviderType, string> = {
  local: "Local Tracking",
  lastfm: "Last.fm",
  statsfm: "stats.fm",
};

export function SettingsPanel({
  onRefresh,
  onCheckUpdates,
  onProviderChanged,
  onClose,
  onReset,
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

  const [sfmUsername, setSfmUsername] = useState("");
  const [sfmValidating, setSfmValidating] = useState(false);
  const [sfmError, setSfmError] = useState("");
  const sfmConnected = Statsfm.isConnected();
  const sfmConfig = Statsfm.getConfig();
  const [loggingOn, setLoggingOn] = useState(isLoggingEnabled());
  const [use24h, setUse24h] = useState(getPreferences().use24HourTime);

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
      const info = await LastFm.validateUser(
        lfmUsername.trim(),
        lfmApiKey.trim(),
      );
      LastFm.saveConfig({ username: info.username, apiKey: lfmApiKey.trim() });
      switchProvider("lastfm");
    } catch (err: any) {
      setLfmError(err.message || "Connection failed");
    } finally {
      setLfmValidating(false);
    }
  };

  const handleStatsfmSwitch = async () => {
    if (!sfmUsername.trim()) {
      setSfmError("Username is required");
      return;
    }
    setSfmValidating(true);
    setSfmError("");
    try {
      const info = await Statsfm.validateUser(sfmUsername.trim());
      Statsfm.saveConfig({ username: info.customId });
      switchProvider("statsfm");
    } catch (err: any) {
      setSfmError(err.message || "Connection failed");
    } finally {
      setSfmValidating(false);
    }
  };

  const handleSfmDisconnect = () => {
    Statsfm.clearConfig();
    Statsfm.clearStatsfmCache();
    Spicetify.showNotification("Disconnected from stats.fm");
    onRefresh();
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
          <button
            className="settings-close-btn"
            onClick={onClose}
            dangerouslySetInnerHTML={{ __html: Icons.close || "&times;" }}
          />
        )}
      </div>

      {/* --- Data Source --- */}
      <SettingsCategory title="Data Source" defaultOpen>
        <div className="settings-provider-current">
          <span>
            Currently using:{" "}
            <strong>
              {currentProvider ? PROVIDER_NAMES[currentProvider] : "None"}
            </strong>
          </span>
          <button
            className="footer-btn"
            onClick={() => setShowProviderPicker(!showProviderPicker)}
          >
            Change
          </button>
        </div>

        {showProviderPicker && (
          <div className="settings-provider-picker">
            {sfmConnected || currentProvider === "statsfm" ? (
              <button
                className={`provider-option ${currentProvider === "statsfm" ? "active" : ""}`}
                onClick={() => switchProvider("statsfm")}
              >
                <strong>stats.fm</strong>
                <span>Connected as {sfmConfig?.username || "..."}</span>
              </button>
            ) : (
              <div className="provider-option lastfm-setup">
                <strong>stats.fm</strong>
                <div className="setup-lastfm-form compact">
                  <input
                    className="lastfm-input"
                    type="text"
                    placeholder="stats.fm username"
                    value={sfmUsername}
                    onChange={(e: any) => setSfmUsername(e.target.value)}
                    disabled={sfmValidating}
                  />
                  {sfmError && <div className="lastfm-error">{sfmError}</div>}
                  <button
                    className="footer-btn primary"
                    onClick={handleStatsfmSwitch}
                    disabled={sfmValidating}
                  >
                    {sfmValidating ? "Connecting..." : "Connect & Switch"}
                  </button>
                </div>
              </div>
            )}
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

        {currentProvider === "lastfm" && lfmConnected && lfmConfig && (
          <div className="settings-lastfm">
            <h4 className="settings-section-title">Last.fm Account</h4>
            <div className="settings-lastfm-connected">
              <div className="settings-lastfm-info">
                <span
                  className="lastfm-status-icon"
                  dangerouslySetInnerHTML={{ __html: Icons.check }}
                />
                <span>
                  Connected as <strong>{lfmConfig.username}</strong>
                </span>
              </div>
              <button
                className="footer-btn danger"
                onClick={() => {
                  handleLfmDisconnect();
                  switchProvider("local");
                }}
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {currentProvider === "statsfm" && sfmConnected && sfmConfig && (
          <div className="settings-lastfm">
            <h4 className="settings-section-title">stats.fm Account</h4>
            <div className="settings-lastfm-connected">
              <div className="settings-lastfm-info">
                <span
                  className="lastfm-status-icon"
                  dangerouslySetInnerHTML={{ __html: Icons.check }}
                />
                <span>
                  Connected as <strong>{sfmConfig.username}</strong>
                </span>
              </div>
              <button
                className="footer-btn danger"
                onClick={() => {
                  handleSfmDisconnect();
                  switchProvider("local");
                }}
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </SettingsCategory>

      {/* --- Display --- */}
      <SettingsCategory title="Display">
        <div className="settings-toggle-row">
          <div className="settings-toggle-info">
            <h4 className="settings-section-title">24-hour time</h4>
            <p className="settings-toggle-desc">
              Show times as 14:00 instead of 2pm
            </p>
          </div>
          <button
            className={`settings-toggle ${use24h ? "active" : ""}`}
            onClick={() => {
              const next = !use24h;
              setPreference("use24HourTime", next);
              setUse24h(next);
            }}
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>
      </SettingsCategory>

      {/* --- Layout --- */}
      <SettingsCategory title="Layout">
        <p className="settings-toggle-desc">
          Layout customization coming soon.
        </p>
      </SettingsCategory>

      {/* --- Advanced --- */}
      <SettingsCategory title="Advanced">
        <div className="settings-toggle-row">
          <div className="settings-toggle-info">
            <h4 className="settings-section-title">Console Logging</h4>
            <p className="settings-toggle-desc">
              Log tracked songs, skips, and playback events to the browser
              console (F12).
            </p>
          </div>
          <button
            className={`settings-toggle ${loggingOn ? "active" : ""}`}
            onClick={() => {
              const next = !loggingOn;
              setLoggingEnabled(next);
              setLoggingOn(next);
              Spicetify.showNotification(
                next
                  ? "Logging enabled. Open DevTools (Ctrl + Shift + I) to see output"
                  : "Logging disabled",
              );
            }}
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>

        <div className="settings-row">
          <button
            className="footer-btn"
            onClick={() => {
              clearStatsCache();
              onRefresh();
            }}
          >
            Refresh
          </button>
          <button
            className="footer-btn"
            onClick={() => {
              resetRateLimit();
              clearApiCaches();
              clearStatsCache();
              LastFm.clearLastfmCache();
              Statsfm.clearStatsfmCache();
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
                if (
                  confirm(
                    "Delete all local tracking data? This cannot be undone.",
                  )
                ) {
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
              onClick={() =>
                stats && period && exportStatsAsJSON(stats, period)
              }
            >
              Export JSON
            </button>
            <button
              className="footer-btn"
              disabled={!stats}
              onClick={() =>
                stats && period && exportStatsAsCSV(stats, period)
              }
            >
              Export CSV
            </button>
            {currentProvider === "local" && (
              <>
                <button
                  className="footer-btn"
                  onClick={() => {
                    exportRawEventsAsJSON();
                    Spicetify.showNotification("Exporting...");
                  }}
                >
                  Raw History (JSON)
                </button>
                <button
                  className="footer-btn"
                  onClick={() => {
                    exportRawEventsAsCSV();
                    Spicetify.showNotification("Exporting...");
                  }}
                >
                  Raw History (CSV)
                </button>
              </>
            )}
          </div>
        </div>

        <div className="settings-danger-zone">
          <h4 className="settings-section-title">Danger Zone</h4>
          <p className="settings-danger-desc">
            Wipe all data and return to the setup screen. This clears the
            IndexedDB database, all saved accounts, caches, and preferences.
          </p>
          <button
            className="footer-btn danger"
            onClick={() => {
              if (
                confirm(
                  "This will delete ALL data including your IndexedDB history, saved accounts, and preferences. This cannot be undone. Continue?",
                )
              ) {
                clearIndexedDB();
                clearPollingData();
                clearStatsCache();
                clearApiCaches();
                resetRateLimit();
                LastFm.clearConfig();
                LastFm.clearLastfmCache();
                Statsfm.clearConfig();
                Statsfm.clearStatsfmCache();
                clearProviderSelection();
                try {
                  localStorage.removeItem(
                    "listening-stats:sfm-promo-dismissed",
                  );
                  localStorage.removeItem("listening-stats:lastUpdateCheck");
                  localStorage.removeItem("listening-stats:lastUpdate");
                  localStorage.removeItem("listening-stats:searchCache");
                  localStorage.removeItem("listening-stats:logging");
                  localStorage.removeItem("listening-stats:preferences");
                } catch {
                  /* ignore */
                }
                onReset?.();
              }
            }}
          >
            Wipe Everything
          </button>
        </div>
      </SettingsCategory>
    </div>
  );
}
