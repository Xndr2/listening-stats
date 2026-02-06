import { ProviderType } from "../../types/listeningstats";
import { Icons } from "../icons";

interface HeaderProps {
  onShare?: () => void;
  onToggleSettings?: () => void;
  providerType?: ProviderType | null;
}

const PROVIDER_NAMES: Record<ProviderType, string> = {
  local: "Local Tracking",
  spotify: "Spotify API",
  lastfm: "Last.fm",
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
          <p className="stats-dev-note">
            Dev note: This is an early build of the new tracking system. Bugs
            are expected, please report them on{" "}
            <a href="https://github.com/Xndr2/listening-stats/issues/new?template=bug_report.md">
              github
            </a>
            .
          </p>
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
