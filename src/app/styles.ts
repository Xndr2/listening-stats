import styles from "./styles.css";

export function injectStyles(): void {
	const existing = document.getElementById("listening-stats-styles");
	if (existing) existing.remove();
	const el = document.createElement("style");
	el.id = "listening-stats-styles";
	el.textContent = styles;
	document.head.appendChild(el);
}
