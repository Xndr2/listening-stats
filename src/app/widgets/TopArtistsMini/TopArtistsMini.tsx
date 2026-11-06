/** Stand-in for the genre mix on sources without genres: the top five artists. */
import { Artwork } from "../../components/Artwork/Artwork";
import { SkeletonLines, Widget } from "../../components/Widget/Widget";
import { formatNumber } from "../../format";
import { usePeriodQuery } from "../../query/useProviderQuery";
import { openItem } from "../../spotify";
import "./TopArtistsMini.css";

export function TopArtistsMini() {
	const q = usePeriodQuery("topArtists", 5);
	return (
		<Widget id="top-artists-mini" title="Top artists" query={q} skeleton={<SkeletonLines rows={5} height={36} />}>
			{(artists) =>
				artists.length === 0 ? (
					<p className="ls-note">No artists in this period yet.</p>
				) : (
					<ol className="ls-mini">
						{artists.map((a) => (
							<li key={a.uri || a.name}>
								<button type="button" className="ls-mini-item" onClick={() => openItem(a.uri, a.name)}>
									<Artwork src={a.image} size={32} round />
									<span className="ls-mini-name">{a.name}</span>
									{a.count !== undefined && <span className="ls-num ls-muted">{formatNumber(a.count)}</span>}
								</button>
							</li>
						))}
					</ol>
				)
			}
		</Widget>
	);
}
