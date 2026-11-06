/**
 * The main ranked list: tracks, artists, albums or genres for the period,
 * ranked by plays or by time. The list scrolls inside its card (the page
 * itself doesn't), each row has a share bar relative to #1, tracks get an
 * album column on wide panes and a heart, and right-click opens Spotify's
 * own menu for the item.
 */
import { useMemo, useState } from "react";
import type { TopAlbum, TopArtist, TopGenre, TopTrack } from "../../../shared/providers/types";
import { supports } from "../../../shared/providers/types";
import { Artwork } from "../../components/Artwork/Artwork";
import { onCardClick } from "../../components/clickable";
import { Icon } from "../../components/Icon";
import { LikeButton } from "../../components/LikeButton";
import { Segmented } from "../../components/Segmented/Segmented";
import { SpotifyMenu } from "../../components/SpotifyMenu";
import { SkeletonLines, Widget } from "../../components/Widget/Widget";
import { formatNumber, formatPercent, formatShortTime } from "../../format";
import { useSetting } from "../../hooks/useSetting";
import { usePeriodQuery } from "../../query/useProviderQuery";
import type { QueryResult } from "../../query/useQuery";
import { openItem, playUri } from "../../spotify";
import { useApp } from "../../state";
import "./TopTable.css";

type Tab = "tracks" | "artists" | "albums" | "genres";
const MAX_ROWS = 50;

const QUERY: Record<Tab, "topTracks" | "topArtists" | "topAlbums" | "topGenres"> = {
	tracks: "topTracks",
	artists: "topArtists",
	albums: "topAlbums",
	genres: "topGenres",
};

const LABELS: Record<Tab, { tab: string; one: string }> = {
	tracks: { tab: "Tracks", one: "Track" },
	artists: { tab: "Artists", one: "Artist" },
	albums: { tab: "Albums", one: "Album" },
	genres: { tab: "Genres", one: "Genre" },
};

interface Row {
	key: string;
	rank: number;
	uri?: string;
	title: string;
	subtitle?: string;
	album?: string;
	albumUri?: string;
	image?: string;
	round?: boolean;
	count?: number;
	durationMs?: number;
	share?: number;
	genres?: string[];
	search: string;
}

function toRows(tab: Tab, data: unknown[]): Row[] {
	switch (tab) {
		case "tracks":
			return (data as TopTrack[]).map((t) => ({
				key: t.uri || `${t.name}|${t.artistName}`,
				rank: t.rank,
				uri: t.uri,
				title: t.name,
				subtitle: t.artistName,
				album: t.albumName,
				albumUri: t.albumUri,
				image: t.image,
				count: t.count,
				durationMs: t.durationMs,
				search: `${t.name} ${t.artistName}`,
			}));
		case "artists":
			return (data as TopArtist[]).map((a) => ({
				key: a.uri || a.name,
				rank: a.rank,
				uri: a.uri,
				title: a.name,
				subtitle: a.genres?.slice(0, 2).join(", "),
				image: a.image,
				round: true,
				genres: a.genres,
				count: a.count,
				durationMs: a.durationMs,
				search: a.name,
			}));
		case "albums":
			return (data as TopAlbum[]).map((a) => ({
				key: a.uri || `${a.name}|${a.artistName}`,
				rank: a.rank,
				uri: a.uri,
				title: a.name,
				subtitle: a.artistName,
				image: a.image,
				count: a.count,
				durationMs: a.durationMs,
				search: `${a.name} ${a.artistName}`,
			}));
		case "genres":
			return (data as TopGenre[]).map((g) => ({
				key: g.name,
				rank: g.rank,
				title: g.name,
				count: g.count,
				durationMs: g.durationMs,
				share: g.share,
				search: g.name,
			}));
	}
}

export function TopTable() {
	const { provider, rank, setRank } = useApp();
	const [tab, setTab] = useState<Tab>("tracks");
	const [perList] = useSetting("itemsPerList");
	const [expanded, setExpanded] = useState(false);
	/** Genre picked from the genres tab; filters the artists tab. */
	const [genre, setGenre] = useState<string | null>(null);
	const limit = expanded || genre ? MAX_ROWS : perList;

	const available = (Object.keys(QUERY) as Tab[]).filter((t) => supports(provider, QUERY[t]));
	const active = available.includes(tab) ? tab : (available[0] ?? "tracks");
	// Only the visible tab fetches; the others load when picked.
	const queries = {
		tracks: usePeriodQuery("topTracks", limit, active === "tracks"),
		artists: usePeriodQuery("topArtists", limit, active === "artists"),
		albums: usePeriodQuery("topAlbums", limit, active === "albums"),
		genres: usePeriodQuery("topGenres", limit, active === "genres"),
	};
	const q = queries[active];

	const rows = useMemo(() => {
		const all = q.data ? toRows(active, q.data as unknown[]) : [];
		if (!genre || active !== "artists") return all;
		return all.filter((r) => r.genres?.includes(genre)).map((r, i) => ({ ...r, rank: i + 1 }));
	}, [active, q.data, genre]);

	const showCounts = provider.perItemCounts();
	const showTime = rows.some((r) => r.durationMs);
	const showAlbum = active === "tracks" && rows.some((r) => r.album);
	const isTracks = active === "tracks";
	const measure = (r: Row) =>
		r.share !== undefined ? r.share : rank === "minutes" ? (r.durationMs ?? 0) : (r.count ?? 0);
	const top = Math.max(1e-9, ...rows.map(measure));

	const pickTab = (t: Tab) => {
		setTab(t);
		setExpanded(false);
		setGenre(null);
	};
	// A genre row filters the artists by it; anything else opens in Spotify.
	const openRow = (r: Row) => {
		if (active !== "genres") return openItem(r.uri, r.search);
		setGenre(r.title);
		setTab("artists");
	};

	return (
		<Widget
			id="top-table"
			className="ls-top"
			query={q as QueryResult<unknown[]>}
			title={
				<Segmented
					label="Show top"
					options={available.map((t) => ({ value: t, label: LABELS[t].tab }))}
					value={active}
					onChange={pickTab}
				/>
			}
			aside={
				<>
					<span className="ls-rank-label">Rank by</span>
					<Segmented
						size="sm"
						label="Rank by"
						value={rank}
						onChange={setRank}
						options={[
							{ value: "streams", label: "Plays" },
							{
								value: "minutes",
								label: "Time",
								disabled: !provider.rankByMinutes,
								title: provider.rankByMinutes ? undefined : `${provider.name} doesn't track listening time`,
							},
						]}
					/>
				</>
			}
			skeleton={<SkeletonLines rows={Math.min(limit, 8)} height={48} />}
		>
			{() => (
				<>
					{genre && active === "artists" && (
						<p className="ls-filter">
							Artists tagged <strong>{genre}</strong>
							<button type="button" className="ls-link" onClick={() => setGenre(null)}>
								Show all
							</button>
						</p>
					)}
					{rows.length === 0 ? (
						<p className="ls-muted ls-empty">
							{active === "genres"
								? "No genres yet. They show up once your artists have been looked up, which happens in the background."
								: genre
									? `None of your top artists in this period are tagged ${genre}.`
									: "Nothing played in this period yet."}
						</p>
					) : (
						<div className="ls-top-scroll">
							<table className="ls-table">
								<thead>
									<tr>
										<th className="ls-col-rank" scope="col">
											#
										</th>
										<th scope="col">{LABELS[active].one}</th>
										{showAlbum && (
											<th className="ls-col-album" scope="col">
												Album
											</th>
										)}
										{isTracks && (
											<th className="ls-col-like" scope="col">
												<span className="ls-visually-hidden">Liked</span>
											</th>
										)}
										{showCounts && (
											<th className="ls-col-num" scope="col">
												Plays
											</th>
										)}
										{showTime && (
											<th className="ls-col-num ls-col-time" scope="col">
												Time
											</th>
										)}
									</tr>
								</thead>
								<tbody>
									{/* Keyed by place, not item: rows never move in the DOM, so when the
									    order changes each bar slides to its new width instead of regrowing. */}
									{rows.map((r, i) => (
										<tr key={`${active}:${i}`} className="ls-row is-link" onClick={onCardClick(() => openRow(r))}>
											<td className="ls-col-rank ls-num">{r.rank}</td>
											<td className="ls-col-main">
												<SpotifyMenu uri={r.uri}>
													<div className="ls-row-main">
														{active !== "genres" && (
															<span className="ls-row-art">
																<Artwork src={r.image} round={r.round} />
																{r.uri && (
																	<button
																		type="button"
																		className="ls-row-play"
																		aria-label={`Play ${r.title}`}
																		onClick={() => playUri(r.uri as string)}
																	>
																		<Icon name="play" size={14} />
																	</button>
																)}
															</span>
														)}
														<div className="ls-row-text">
															<button
																type="button"
																className="ls-row-title"
																{...(active === "genres"
																	? { "data-tip": `Show artists tagged ${r.title}` }
																	: { "data-tip": r.title, "data-tip-overflow": "" })}
																onClick={() => openRow(r)}
															>
																{r.title}
															</button>
															{r.subtitle && <span className="ls-row-sub">{r.subtitle}</span>}
															<span className="ls-row-bar" aria-hidden="true">
																<span style={{ width: `${(measure(r) / top) * 100}%` }} />
															</span>
														</div>
													</div>
												</SpotifyMenu>
											</td>
											{showAlbum && (
												<td className="ls-col-album">
													{r.album && (
														<button
															type="button"
															className="ls-row-album"
															data-tip={r.album}
															data-tip-overflow
															onClick={() => openItem(r.albumUri, `${r.album} ${r.subtitle ?? ""}`)}
														>
															{r.album}
														</button>
													)}
												</td>
											)}
											{isTracks && (
												<td className="ls-col-like">
													<LikeButton uri={r.uri} name={r.title} />
												</td>
											)}
											{showCounts && (
												<td className="ls-col-num ls-num ls-strong">
													{r.share !== undefined && !r.count ? formatPercent(r.share) : formatNumber(r.count ?? 0)}
												</td>
											)}
											{showTime && (
												<td className="ls-col-num ls-col-time ls-num ls-muted">
													{r.durationMs ? formatShortTime(r.durationMs) : ""}
												</td>
											)}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					{rows.length > 0 && (
						<footer className="ls-top-foot">
							<span className="ls-muted">
								{rows.length} {LABELS[active].tab.toLowerCase()}, ranked by {rank === "minutes" ? "time" : "plays"}
							</span>
							{rows.length >= limit && !expanded && !genre && (
								<button type="button" className="ls-link" onClick={() => setExpanded(true)}>
									Show more
								</button>
							)}
							{expanded && (
								<button type="button" className="ls-link" onClick={() => setExpanded(false)}>
									Show fewer
								</button>
							)}
						</footer>
					)}
				</>
			)}
		</Widget>
	);
}
