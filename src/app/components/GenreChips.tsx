import { getPreferences } from "../../services/preferences";

interface GenreChipsProps {
  topGenres: Array<{ genre: string; count: number }>;
}

export function GenreChips({ topGenres }: GenreChipsProps) {
  if (topGenres.length === 0) return null;

  const limit = getPreferences().genresPerSection;
  const genres = topGenres.slice(0, limit);
  const maxCount = genres[0]?.count || 1;

  return (
    <div className="genre-bars-section">
      <h3 className="genre-bars-title">Top Genres</h3>
      <div className="genre-bars">
        {genres.map((g, i) => {
          const pct = (g.count / maxCount) * 100;
          return (
            <div key={g.genre} className="genre-bar-row">
              <span className="genre-bar-rank">{i + 1}</span>
              <div className="genre-bar-track">
                <div
                  className="genre-bar-fill"
                  style={{ width: `${pct}%`, animationDelay: `${0.1 + i * 0.04}s` }}
                />
                <span className="genre-bar-name">{g.genre}</span>
              </div>
              <span className="genre-bar-count">{g.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
