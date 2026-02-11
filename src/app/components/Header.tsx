import { ProviderType } from "../../types/listeningstats";
import { renderMarkdown } from "../format";
import { Icons } from "../icons";

const { useState, useEffect, useRef } = Spicetify.React;

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

const ANNOUNCEMENT_URL =
  "https://raw.githubusercontent.com/Xndr2/listening-stats/main/ANNOUNCEMENT.md";

function Announcement() {
  const [html, setHtml] = useState<string | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    const url = ANNOUNCEMENT_URL + "?t=" + Math.floor(Date.now() / 300000);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.text();
      })
      .then((text) => {
        const trimmed = text.trim();
        if (trimmed) setHtml(renderMarkdown(trimmed));
      })
      .catch(() => {});
  }, []);

  if (!html) return null;

  return (
    <div
      className="stats-announcement"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

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
          <Announcement />
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
