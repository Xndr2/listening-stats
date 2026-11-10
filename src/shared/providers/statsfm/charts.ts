/** Global charts from stats.fm's community data. Public; no account needed. */
import { getJson, HttpError } from "../../net/http";
import { SFM_BASE, type SfmAlbum, type SfmArtist, type SfmTrack, spotifyUri } from "./client";

export const CHART_WINDOWS = ["today", "weeks", "months", "lifetime"] as const;
export type ChartWindow = (typeof CHART_WINDOWS)[number];
export type ChartKind = "tracks" | "artists" | "albums";

export const CHART_WINDOW_LABELS: Record<ChartWindow, string> = {
	today: "Today",
	weeks: "Last 4 weeks",
	months: "Last 6 months",
	lifetime: "All time",
};

export interface ChartRow {
	rank: number;
	uri: string;
	name: string;
	subtitle: string;
	/** Extra line: genres for artists, label and year for albums. */
	detail?: string;
	image?: string;
	streams: number;
	/** Album uri for tracks. */
	albumName?: string;
}

const compactFmt = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const compact = (n: number) => compactFmt.format(n);

function albumDetail(b: { label?: string; releaseDate?: number }): string | undefined {
	const year = b.releaseDate ? new Date(b.releaseDate).getFullYear() : undefined;
	return [year, b.label].filter(Boolean).join(" · ") || undefined;
}

export async function fetchChart(
	kind: ChartKind,
	window: ChartWindow,
	limit: number,
	signal?: AbortSignal,
): Promise<ChartRow[]> {
	const body = await getJson<{ items?: unknown }>(`${SFM_BASE}/charts/top/${kind}?range=${window}&limit=${limit}`, {
		signal,
	});
	if (!Array.isArray(body?.items)) throw new HttpError("bad-response", "stats.fm sent unexpected chart data");
	return (body.items as Array<Record<string, unknown>>).slice(0, limit).map((it, i) => {
		const streams = typeof it.streams === "number" ? it.streams : 0;
		if (kind === "tracks") {
			const t = it.track as SfmTrack;
			return {
				rank: i + 1,
				uri: spotifyUri("track", t.externalIds?.spotify),
				name: t.name,
				subtitle: t.artists.map((a) => a.name).join(", "),
				image: t.albums[0]?.image ?? undefined,
				albumName: t.albums[0]?.name,
				streams,
			};
		}
		if (kind === "artists") {
			const a = it.artist as SfmArtist;
			return {
				rank: i + 1,
				uri: spotifyUri("artist", a.externalIds?.spotify),
				name: a.name,
				subtitle: a.genres?.slice(0, 3).join(", ") ?? "",
				detail: typeof a.followers === "number" ? `${compact(a.followers)} followers` : undefined,
				image: a.image ?? undefined,
				streams,
			};
		}
		const b = it.album as SfmAlbum;
		return {
			rank: i + 1,
			uri: spotifyUri("album", b.externalIds?.spotify),
			name: b.name,
			subtitle: b.artists?.map((x) => x.name).join(", ") ?? "",
			detail: albumDetail(b as SfmAlbum & { label?: string; releaseDate?: number }),
			image: b.image ?? undefined,
			streams,
		};
	});
}
