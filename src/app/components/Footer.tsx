import { UpdateInfo } from "../../services/updater";

interface FooterProps {
  version: string;
  updateInfo: UpdateInfo | null;
  onShowUpdate: () => void;
}

export function Footer({
  version,
  updateInfo,
  onShowUpdate,
}: FooterProps) {
  return (
    <div className="stats-footer">
      <span className="version-text">
        v{version} - made with love by{" "}
        <a href="https://github.com/Xndr2/listening-stats">Xndr</a>
      </span>
      {updateInfo?.available && (
        <button className="footer-btn primary" onClick={onShowUpdate}>
          Update v{updateInfo.latestVersion}
        </button>
      )}
    </div>
  );
}
