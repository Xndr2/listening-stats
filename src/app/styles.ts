import styles from "./styles.css";

export function injectStyles(): void {
  const existing = document.getElementById("listening-stats-styles");
  if (existing) existing.remove();

  const styleEl = document.createElement("style");
  styleEl.id = "listening-stats-styles";
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
