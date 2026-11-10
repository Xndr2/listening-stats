/**
 * What everyone on stats.fm is playing, next to what you play: each row says
 * how often you've played it (from your active source), so the chart answers
 * "how mainstream is my taste right now". Same table, hearts and right-click
 * menus as your own top lists.
 */
import { useMemo, useState } from "react";
import { V2_KEYS } from "../../shared/constants/storage-keys";
import { periodWindow } from "../../shared/providers/periods";
import {
	CHART_WINDOW_LABELS,
	CHART_WINDOWS,
	type ChartKind,
	type ChartWindow,
	fetchChart,
} from "../../shared/providers/statsfm/charts";
import { supports } from "../../shared/providers/types";
import { Artwork } from "../components/Artwork/Artwork";
import { onCardClick } from "../components/clickable";
import { Icon } from "../components/Icon";
import { LikeButton } from "../components/LikeButton";
import { Segmented } from "../components/Segmented/Segmented";
import { SpotifyMenu } from "../components/SpotifyMenu";
import { SkeletonLines, Widget } from "../components/Widget/Widget";
import { formatNumber } from "../format";
import { useQuery } from "../query/useQuery";
import { openItem, playUri } from "../spotify";
import { useApp } from "../state";
import "./World.css";

const QUERY = { tracks: "topTracks", artists: "topArtists", albums: "topAlbums" } as const;

function savedWindow(): ChartWindow {
	const v = localStorage.getItem(V2_KEYS.WORLD_CHARTS_WINDOW);
	return (CHART_WINDOWS as readonly string[]).includes(v ?? "") ? (v as ChartWindow) : "today";
}

/** Your all-time plays per uri, from the active source, for the "You" column. */
function useMyPlays(kind: ChartKind): Map<string, number> | undefined {
	const { provider, source } = useApp();
	const q = QUERY[kind];
	const ok = supports(provider, q);
	const res = useQuery(ok ? `${source}:world-mine:${kind}` : null, async (signal) => {
		const fn = provider[q] as (
			a: Parameters<NonNullable<typeof provider.topTracks>>[0],
		) => Promise<Array<{ uri: string; count?: number }>>;
		const rows = await fn.call(provider, { window: periodWindow("all-time"), rank: "streams", limit: 200, signal });
		return rows.filter((r) => r.uri).map((r) => [r.uri, r.count ?? 0] as const);
	});
	return useMemo(() => (res.data ? new Map(res.data) : undefined), [res.data]);
}

export function WorldView() {
	const { provider } = useApp();
	const [kind, setKind] = useState<ChartKind>("tracks");
	const [win, setWin] = useState<ChartWindow>(savedWindow);
	const [limit, setLimit] = useState(50);
	const q = useQuery(`world:${kind}:${win}:${limit}`, (signal) => fetchChart(kind, win, limit, signal));
	const mine = useMyPlays(kind);
	const counts = provider.perItemCounts();
	const heard = q.data && mine ? q.data.filter((r) => mine.has(r.uri)).length : undefined;
	const top = q.data?.[0]?.streams || 1;

	return (
		<div className="ls-world">
			<div className="ls-world-head">
				<div>
					<h2 className="ls-world-title">World charts</h2>
					<p className="ls-muted">
						Most played across everyone on stats.fm
						{heard !== undefined && q.data ? `. You've played ${heard} of these ${q.data.length}.` : "."}
					</p>
				</div>
				<Segmented
					label="Chart period"
					options={CHART_WINDOWS.map((w) => ({ value: w, label: CHART_WINDOW_LABELS[w] }))}
					value={win}
					onChange={(w) => {
						setWin(w);
						localStorage.setItem(V2_KEYS.WORLD_CHARTS_WINDOW, w);
					}}
				/>
			</div>
			<Widget
				id="world"
				className="ls-world-card"
				query={q}
				title={
					<Segmented
						label="Chart"
						value={kind}
						onChange={setKind}
						options={[
							{ value: "tracks", label: "Tracks" },
							{ value: "artists", label: "Artists" },
							{ value: "albums", label: "Albums" },
						]}
					/>
				}
				skeleton={<SkeletonLines rows={10} height={48} />}
			>
				{(rows) => (
					<>
						<div className="ls-top-scroll">
							<table className="ls-table">
								<thead>
									<tr>
										<th className="ls-col-rank" scope="col">
											#
										</th>
										<th scope="col">{kind === "tracks" ? "Track" : kind === "artists" ? "Artist" : "Album"}</th>
										{kind === "tracks" && (
											<th className="ls-col-album" scope="col">
												Album
											</th>
										)}
										<th className="ls-col-you" scope="col" data-tip={`Your all-time plays on ${provider.name}`}>
											You
										</th>
										{kind === "tracks" && (
											<th className="ls-col-like" scope="col">
												<span className="ls-visually-hidden">Liked</span>
											</th>
										)}
										<th className="ls-col-streams" scope="col">
											Streams
										</th>
									</tr>
								</thead>
								<tbody>
									{rows.map((r, i) => {
										const my = mine?.get(r.uri);
										return (
											<tr
												key={`${kind}:${i}`}
												className={`ls-row is-link ${my !== undefined ? "is-mine" : ""}`}
												onClick={onCardClick(() => openItem(r.uri, `${r.name} ${r.subtitle}`))}
											>
												<td className="ls-col-rank ls-num">{r.rank}</td>
												<td className="ls-col-main">
													<SpotifyMenu uri={r.uri}>
														<div className="ls-row-main">
															<span className="ls-row-art">
																<Artwork src={r.image} round={kind === "artists"} />
																{r.uri && (
																	<button
																		type="button"
																		className="ls-row-play"
																		aria-label={`Play ${r.name}`}
																		onClick={() => playUri(r.uri)}
																	>
																		<Icon name="play" size={14} />
																	</button>
																)}
															</span>
															<div className="ls-row-text">
																<button
																	type="button"
																	className="ls-row-title"
																	data-tip={r.name}
																	data-tip-overflow
																	onClick={() => openItem(r.uri, `${r.name} ${r.subtitle}`)}
																>
																	{r.name}
																</button>
																<span className="ls-row-sub">{[r.subtitle, r.detail].filter(Boolean).join(" · ")}</span>
																<span className="ls-row-bar" aria-hidden="true">
																	<span style={{ width: `${(r.streams / top) * 100}%` }} />
																</span>
															</div>
														</div>
													</SpotifyMenu>
												</td>
												{kind === "tracks" && (
													<td className="ls-col-album ls-muted ls-ellipsis" data-tip={r.albumName} data-tip-overflow>
														{r.albumName}
													</td>
												)}
												<td className="ls-col-you ls-num">
													{my === undefined ? (
														<span className="ls-muted" data-tip="Not in your top plays">
															·
														</span>
													) : (
														<span className="ls-you-chip">{counts && my ? formatNumber(my) : "Yes"}</span>
													)}
												</td>
												{kind === "tracks" && (
													<td className="ls-col-like">
														<LikeButton uri={r.uri} name={r.name} />
													</td>
												)}
												<td className="ls-col-streams ls-num">{formatNumber(r.streams)}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
						<footer className="ls-top-foot">
							<span className="ls-muted">
								Top {rows.length}, {CHART_WINDOW_LABELS[win].toLowerCase()}
							</span>
							{limit < 100 && (
								<button type="button" className="ls-link" onClick={() => setLimit(100)}>
									Show top 100
								</button>
							)}
						</footer>
					</>
				)}
			</Widget>
		</div>
	);
}
