import type { ListeningStats, ProviderType } from "../../types/listeningstats";
import { generateShareCard, shareOrDownload } from "../../services/share-card";
import { Icons } from "../icons";

const { useState, useRef, useEffect } = Spicetify.React;

interface ShareCardModalProps {
  stats: ListeningStats;
  period: string;
  providerType?: ProviderType | null;
  onClose: () => void;
}

export function ShareCardModal({ stats, period, providerType, onClose }: ShareCardModalProps) {
  const [format, setFormat] = useState<"story" | "landscape">("story");
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    generatePreview();
  }, [format]);

  async function generatePreview() {
    setGenerating(true);
    try {
      const blob = await generateShareCard({ stats, period, format, providerType });
      blobRef.current = blob;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error("[ListeningStats] Failed to generate share card:", e);
    }
    setGenerating(false);
  }

  async function handleShare() {
    if (!blobRef.current) return;
    const result = await shareOrDownload(blobRef.current);
    if (result === "copied") {
      Spicetify.showNotification("Image copied to clipboard!");
    } else if (result === "downloaded") {
      Spicetify.showNotification("Image downloaded!");
    }
    onClose();
  }

  async function handleDownload() {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const a = document.createElement("a");
    a.href = url;
    a.download = "listening-stats.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Spicetify.showNotification("Image downloaded!");
  }

  return (
    <div className="share-modal-overlay" onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains("share-modal-overlay")) onClose();
    }}>
      <div className="share-modal">
        <div className="share-modal-header">
          <h3>Share Your Stats</h3>
          <button className="settings-close-btn" onClick={onClose}
            dangerouslySetInnerHTML={{ __html: Icons.close || "&times;" }}
          />
        </div>

        <div className="share-format-toggle">
          <button
            className={`share-format-btn ${format === "story" ? "active" : ""}`}
            onClick={() => setFormat("story")}
          >
            Story (9:16)
          </button>
          <button
            className={`share-format-btn ${format === "landscape" ? "active" : ""}`}
            onClick={() => setFormat("landscape")}
          >
            Landscape (16:9)
          </button>
        </div>

        <div className="share-preview">
          {generating ? (
            <div className="share-generating">Generating...</div>
          ) : previewUrl ? (
            <img src={previewUrl} className="share-preview-img" alt="Share card preview" />
          ) : null}
        </div>

        <div className="share-actions">
          <button className="footer-btn primary" onClick={handleShare} disabled={generating}>
            Share / Copy
          </button>
          <button className="footer-btn" onClick={handleDownload} disabled={generating}>
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
