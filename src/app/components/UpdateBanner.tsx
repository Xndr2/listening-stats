import { UpdateInfo } from "../../services/updater";
import { Icons } from "../icons";

interface UpdateBannerProps {
  updateInfo: UpdateInfo;
  commandCopied: boolean;
  onDismiss: () => void;
  onCopyCommand: () => void;
}

export function UpdateBanner({
  updateInfo,
  commandCopied,
  onDismiss,
  onCopyCommand,
}: UpdateBannerProps) {
  return (
    <div className="stats-page">
      <div className="update-banner-container">
        <div className="update-banner">
          <div className="update-banner-header">
            <div className="update-banner-icon">🎉</div>
            <div className="update-banner-title">Update Available!</div>
            <div className="update-banner-version">
              v{updateInfo.currentVersion} → v{updateInfo.latestVersion}
            </div>
          </div>
          {updateInfo.changelog && (
            <div className="update-banner-changelog">
              {updateInfo.changelog}
            </div>
          )}
          <div className="update-banner-links">
            <a
              className="lastfm-help-link standalone"
              href="https://github.com/Xndr2/listening-stats/wiki/stats.fm-Setup-Guide"
              target="_blank"
              rel="noopener noreferrer"
            >
              stats.fm Setup Guide
              <span dangerouslySetInnerHTML={{ __html: Icons.external }} />
            </a>
            <a
              className="lastfm-help-link standalone"
              href="https://github.com/Xndr2/listening-stats/wiki/Last.fm-Setup-Guide"
              target="_blank"
              rel="noopener noreferrer"
            >
              Last.fm Setup Guide
              <span dangerouslySetInnerHTML={{ __html: Icons.external }} />
            </a>
          </div>
          <div className="update-banner-actions">
            <button className="update-banner-btn secondary" onClick={onDismiss}>
              I'll do this later
            </button>
            <button
              className={`update-banner-btn primary ${commandCopied ? "copied" : ""}`}
              onClick={onCopyCommand}
            >
              {commandCopied ? "✓ Copied!" : "📋 Copy Command"}
            </button>
          </div>
          <div className="updating-text">
            Paste the command in your terminal, then restart Spotify.
          </div>
        </div>
      </div>
    </div>
  );
}
