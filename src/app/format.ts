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
