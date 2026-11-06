/**
 * Recently played as one horizontal row that scrolls sideways. Each card
 * plays from its cover, opens the track from its title, can be liked, and
 * right-click gives Spotify's own track menu.
 */
import { supports } from "../../../shared/providers/types";
import { Artwork } from "../../components/Artwork/Artwork";
import { onCardClick } from "../../components/clickable";
import { Icon } from "../../components/Icon";
import { LikeButton } from "../../components/LikeButton";
import { SpotifyMenu } from "../../components/SpotifyMenu";
import { Widget } from "../../components/Widget/Widget";
import { formatAgo } from "../../format";
import { useQuery } from "../../query/useQuery";
import { openItem, playUri } from "../../spotify";
import { useApp } from "../../state";
import "./Recent.css";

const LIMIT = 20;

export function Recent() {
	const { provider, source } = useApp();
	const supported = supports(provider, "recent");
	const q = useQuery(supported ? `${source}:recent:${LIMIT}` : null, (signal) =>
		provider.recent ? provider.recent({ limit: LIMIT, signal }) : Promise.resolve([]),
	);
	if (!supported) return null;
	return (
		<Widget
			id="recent"
			title="Recently played"
			query={q}
			skeleton={
				<div className="ls-recent" aria-hidden="true">
					{Array.from({ length: 8 }, (_, i) => (
						<div key={i} className="ls-skel ls-recent-skel" />
					))}
				</div>
			}
		>
			{(items) =>
				items.length === 0 ? (
					<p className="ls-note">Nothing yet. Plays show up here a few seconds after they count.</p>
				) : (
					<ul className="ls-recent">
						{items.map((r) => (
							<li
								key={`${r.uri}${r.playedAt}`}
								className="ls-recent-card"
								onClick={onCardClick(() => openItem(r.uri, `${r.name} ${r.artistName}`))}
							>
								<SpotifyMenu uri={r.uri}>
									<div className="ls-recent-inner">
										<span className="ls-row-art">
											<Artwork src={r.image} size={48} />
											{r.uri && (
												<button
													type="button"
													className="ls-row-play ls-recent-play"
													aria-label={`Play ${r.name}`}
													onClick={() => playUri(r.uri)}
												>
													<Icon name="play" size={14} />
												</button>
											)}
										</span>
										<span className="ls-recent-text">
											<button
												type="button"
												className="ls-recent-title"
												data-tip={r.name}
												data-tip-overflow
												onClick={() => openItem(r.uri, `${r.name} ${r.artistName}`)}
											>
												{r.name}
											</button>
											<span className="ls-recent-sub">{r.artistName}</span>
											<span className="ls-recent-when">{formatAgo(r.playedAt)}</span>
										</span>
										<LikeButton uri={r.uri} name={r.name} />
									</div>
								</SpotifyMenu>
							</li>
						))}
					</ul>
				)
			}
		</Widget>
	);
}
