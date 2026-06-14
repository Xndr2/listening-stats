import type { TopGenre } from "../types/stats";
import { GENRE_MAP, type GenrePoint } from "./data";

export interface MappedGenre extends GenrePoint {
	genre: string;
	count: number;
	rank: number;
	matched: boolean;
}

const normalCache = new Map<string, string>();
const KEY_ENTRIES = Object.entries(GENRE_MAP);
const NORM_KEYS = KEY_ENTRIES.map(([k, v]) => [normalise(k), v] as [string, GenrePoint]);

function normalise(name: string): string {
	const cached = normalCache.get(name);
	if (cached !== undefined) return cached;
	const n = name
		.toLowerCase()
		.replace(/['']/g, "")
		.replace(/[^a-z0-9 &]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	normalCache.set(name, n);
	return n;
}

function lastWord(s: string): string {
	const parts = s.split(" ");
	return parts[parts.length - 1];
}

/** Strip trailing parenthesised/braced qualifiers, e.g. "pop (genre)" -> "pop" */
function stripQualifiers(name: string): string {
	return name.replace(/[([{<].*?[)\]}>]/g, "").trim();
}

export function mapUserGenres(userGenres: TopGenre[]): MappedGenre[] {
	if (!userGenres || userGenres.length === 0) return [];

	const result: MappedGenre[] = [];

	for (const ug of userGenres) {
		const raw = ug.genre;
		const norm = normalise(raw);
		const stripped = stripQualifiers(norm);

		let entry: GenrePoint | undefined;

		// 1) Direct key lookup (case-insensitive via normalised)
		entry = GENRE_MAP[raw] ?? GENRE_MAP[norm] ?? GENRE_MAP[stripped];

		// 2) Normalised key walk
		if (!entry) {
			for (const [nk, pt] of NORM_KEYS) {
				if (nk === norm || nk === stripped) {
					entry = pt;
					break;
				}
			}
		}

		// 3) & → and substitution
		if (!entry && norm.includes(" & ")) {
			const withAnd = norm.replace(/ & /g, " and ");
			entry = GENRE_MAP[withAnd];
			if (!entry) {
				for (const [nk, pt] of NORM_KEYS) {
					if (nk === withAnd) {
						entry = pt;
						break;
					}
				}
			}
		}

		// 4) Substring: user genre is suffix of a dataset key (e.g. user "drill" vs dataset "uk drill")
		if (!entry) {
			const last = lastWord(norm);
			if (last.length > 2) {
				for (const [nk, pt] of NORM_KEYS) {
					if (nk.endsWith(` ${last}`) || nk === last) {
						entry = pt;
						break;
					}
				}
			}
		}

		// 5) Superset: dataset key contains all significant words from user genre
		if (!entry) {
			const qWords = norm.split(" ").filter((w) => w.length > 2);
			if (qWords.length > 0) {
				let bestScore = 0;
				let bestPt: GenrePoint | undefined;
				for (const [nk, pt] of NORM_KEYS) {
					const dWords = new Set(nk.split(" "));
					let allFound = true;
					for (const w of qWords) {
						if (!dWords.has(w)) {
							allFound = false;
							break;
						}
					}
					if (allFound) {
						const lenDiff = Math.abs(nk.length - norm.length);
						const score = 100 - lenDiff;
						if (score > bestScore) {
							bestScore = score;
							bestPt = pt;
						}
					}
				}
				if (bestScore > 50) entry = bestPt;
			}
		}

		if (entry) {
			result.push({
				genre: raw,
				x: entry.x,
				y: entry.y,
				c: entry.c,
				count: ug.count,
				rank: ug.rank,
				matched: true,
			});
		}
	}

	return result;
}

export function getAllMappedGenres(): Record<string, GenrePoint> {
	return GENRE_MAP;
}

export function getGenreAxes(): { xLabel: string; yLabel: string } {
	return {
		xLabel: "denser/heavier ← → lighter/bouncier",
		yLabel: "more organic ← → more mechanical",
	};
}
