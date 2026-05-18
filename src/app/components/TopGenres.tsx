import type { TopGenre } from "../../shared/types/stats";
import { ShareIcon } from "../icons";

interface TopGenresProps {
	topGenres: TopGenre[];
	onGenreClick?: (genre: string) => void;
	activeGenre?: string | null;
	onShare?: () => void;
}

export function TopGenres({ topGenres, onGenreClick, activeGenre, onShare }: TopGenresProps) {
	if (!topGenres || topGenres.length === 0) return null;

	const genres = topGenres.slice(0, 6);
	const totalCount = topGenres.reduce((s, g) => s + g.count, 0) || 1;

	return (
		<div className="section-card">
			<header className="section-heading">
				<span className="section-kicker">Composition</span>
				<h2 className="section-title">Top Genres</h2>
				{onShare && (
					<button
						type="button"
						className="btn-icon share-section-btn"
						style={{ marginLeft: "auto" }}
						onClick={(e) => {
							e.stopPropagation();
							onShare();
						}}
						aria-label="Share genres"
						dangerouslySetInnerHTML={{ __html: ShareIcon }}
					/>
				)}
			</header>
			<div className="top-genres-list">
				{genres.map((genre, i) => {
					const pct = totalCount > 0 ? (genre.count / totalCount) * 100 : 0;
					return (
						<div key={genre.genre} className="top-genres-row">
							<button
								className={`top-genres-name${activeGenre === genre.genre ? " top-genres-name--active" : ""}`}
								onClick={() => onGenreClick?.(genre.genre)}
								type="button"
							>
								{genre.genre}
							</button>
							<div className="top-genres-bar-track">
								<div className={`top-genres-bar${i === 0 ? " peak" : ""}`} style={{ width: `${pct}%` }} />
							</div>
							<span className="top-genres-pct">{Math.round((genre.count / totalCount) * 100)}%</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
