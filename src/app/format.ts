import { getPreferences } from "../services/preferences";

const numberFormatter = new Intl.NumberFormat();

export function formatNumber(n: number): string {
  return numberFormatter.format(n);
}

export function formatHour(h: number): string {
  const { use24HourTime } = getPreferences();
  if (use24HourTime) {
    return h.toString().padStart(2, "0") + ":00";
  }
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/**
 * Lightweight markdown-to-HTML renderer for GitHub release body format.
 * Handles: headings, bold, italic, inline code, links, unordered lists, line breaks.
 */
export function renderMarkdown(text: string): string {
  if (!text) return "";

  // Escape HTML entities
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // Process inline code - protect from further processing
  const codeBlocks: string[] = [];
  html = html.replace(/`([^`]+)`/g, (_match, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<code>${code}</code>`);
    return `\x00CODE${idx}\x00`;
  });

  // Split into lines for block-level processing
  const lines = html.split("\n");
  const processed: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headings
    if (line.match(/^###\s+(.+)$/)) {
      if (inList) { processed.push("</ul>"); inList = false; }
      processed.push(`<h5>${line.replace(/^###\s+/, "")}</h5>`);
      continue;
    }
    if (line.match(/^##\s+(.+)$/)) {
      if (inList) { processed.push("</ul>"); inList = false; }
      processed.push(`<h4>${line.replace(/^##\s+/, "")}</h4>`);
      continue;
    }

    // List items (- or *)
    if (line.match(/^[\-\*]\s+(.+)$/)) {
      if (!inList) { processed.push("<ul>"); inList = true; }
      processed.push(`<li>${line.replace(/^[\-\*]\s+/, "")}</li>`);
      continue;
    }

    // Non-list line: close any open list
    if (inList) { processed.push("</ul>"); inList = false; }

    // Empty line -> paragraph break
    if (line.trim() === "") {
      processed.push("<br>");
      continue;
    }

    processed.push(line);
  }

  // Close any remaining open list
  if (inList) { processed.push("</ul>"); }

  html = processed.join("\n");

  // Inline formatting: bold, italic, links
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Restore inline code blocks
  html = html.replace(/\x00CODE(\d+)\x00/g, (_match, idx) => codeBlocks[parseInt(idx)]);

  // Convert remaining single newlines to <br> (but not inside tags)
  // Only between non-tag lines (not after </ul>, </h4>, etc.)
  html = html.replace(/(?<!\>)\n(?!\<)/g, "<br>");

  return html;
}
