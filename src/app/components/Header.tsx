import { ProviderType } from "../../types/listeningstats";
import { Icons } from "../icons";

interface HeaderProps {
  onShare?: () => void;
  onToggleSettings?: () => void;
  providerType?: ProviderType | null;
}

const PROVIDER_NAMES: Record<ProviderType, string> = {
  local: "Local Tracking",
  lastfm: "Last.fm",
  statsfm: "stats.fm",
};

export function Header({
  onShare,
  onToggleSettings,
  providerType,
}: HeaderProps) {
  return (
    <div className="stats-header">
      <div className="stats-header-row">
        <div>
          <h1 className="stats-title">Listening Stats</h1>
          <p className="stats-subtitle">
            Your personal music analytics
            {providerType && (
              <span className="provider-badge">
                via {PROVIDER_NAMES[providerType]}
              </span>
            )}
          </p>
          <div className="stats-dev-note">
            <p className="stats-dev-note-main">Important!</p>
            <a
              className="stats-dev-note-sub"
              href="https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/"
            >
              Spotify is shutting down it's API to access the Spotify music
              catalog.
            </a>
            <p className="stats-dev-note-sub">
              I have no idea if Listening-Stats will be affected or not. We will
              have to wait and see. I'll keep you all updated.
              <br />
              I'm still working on fixing small bugs so I'll push those soon.
              Thanks for 1K downloads! Y'all are amazing ❤️
            </p>
          </div>
        </div>
        <div className="header-actions">
          {onToggleSettings && (
            <button
              className="header-btn"
              onClick={onToggleSettings}
              title="Settings"
              dangerouslySetInnerHTML={{ __html: Icons.settings }}
            />
          )}
          {onShare && (
            <button
              className="header-btn"
              onClick={onShare}
              title="Share stats"
              dangerouslySetInnerHTML={{ __html: Icons.share }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
