import { LS_KEYS } from "../constants/storage-keys";

/** How local top tracks/artists/albums are ordered. */
export type RankMode = "streams" | "minutes";

export function getRankMode(): RankMode {
	return localStorage.getItem(LS_KEYS.RANK_MODE) === "minutes" ? "minutes" : "streams";
}

export function setRankMode(mode: RankMode): void {
	localStorage.setItem(LS_KEYS.RANK_MODE, mode);
}
