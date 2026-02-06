import type { ListeningStats } from "../../types/listeningstats";
import { calculateStats } from "../../services/stats";
import { getActiveProvider } from "../../services/providers";

const { useState, useEffect } = Spicetify.React;

const GENRE_COLORS = [
  "#1db954", "#1e90ff", "#9b59b6", "#e74c3c",
  "#f39c12", "#00bcd4", "#e91e63", "#8bc34a",
];

interface GenreBar {
  genre: string;
  proportion: number;
  color: string;
}

interface PeriodGenres {
  label: string;
  genres: GenreBar[];
}

export function GenreTimeline() {
  const [data, setData] = useState<PeriodGenres[]>([]);

  useEffect(() => {
    loadGenreData();
  }, []);

  async function loadGenreData() {
    const provider = getActiveProvider();
    if (!provider) return;

    // Pick 3 periods to compare
    const periods = provider.periods;
    let selectedPeriods: string[];
    if (provider.type === "local") {
      selectedPeriods = ["this_week", "this_month", "all_time"].filter((p) => periods.includes(p));
    } else if (provider.type === "spotify") {
      selectedPeriods = ["short_term", "medium_term", "long_term"].filter((p) => periods.includes(p));
    } else {
      selectedPeriods = ["1month", "6month", "overall"].filter((p) => periods.includes(p));
    }

    if (selectedPeriods.length === 0) return;

    try {
      const results = await Promise.all(
        selectedPeriods.map(async (p) => {
          const stats = await calculateStats(p);
          return { period: p, stats };
        }),
      );

      // Build a consistent color map from the first period's genres
      const colorMap = new Map<string, string>();
      let colorIdx = 0;
      for (const r of results) {
        for (const g of r.stats.topGenres) {
          if (!colorMap.has(g.genre) && colorIdx < GENRE_COLORS.length) {
            colorMap.set(g.genre, GENRE_COLORS[colorIdx++]);
          }
        }
      }

      const periodData: PeriodGenres[] = results.map((r) => {
        const total = r.stats.topGenres.reduce((sum, g) => sum + g.count, 0);
        if (total === 0) return { label: provider.periodLabels[r.period] || r.period, genres: [] };

        const genres = r.stats.topGenres.slice(0, 6).map((g) => ({
          genre: g.genre,
          proportion: g.count / total,
          color: colorMap.get(g.genre) || "#666",
        }));

        // Add "other" if there's remainder
        const shown = genres.reduce((sum, g) => sum + g.proportion, 0);
        if (shown < 0.98 && r.stats.topGenres.length > 6) {
          genres.push({ genre: "other", proportion: 1 - shown, color: "#444" });
        }

        return { label: provider.periodLabels[r.period] || r.period, genres };
      });

      setData(periodData.filter((p) => p.genres.length > 0));
    } catch {
      // Silently fail — this is a bonus feature
    }
  }

  if (data.length === 0) return null;

  return (
    <div className="genre-timeline-section">
      <h3 className="section-title">Genre Trends</h3>
      <div className="genre-timeline">
        {data.map((period) => (
          <div key={period.label} className="genre-timeline-row">
            <span className="genre-timeline-label">{period.label}</span>
            <div className="genre-timeline-bar">
              {period.genres.map((g) => (
                <div
                  key={g.genre}
                  className="genre-timeline-segment"
                  style={{ flex: g.proportion, backgroundColor: g.color }}
                  title={`${g.genre}: ${Math.round(g.proportion * 100)}%`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="genre-timeline-legend">
        {data[0]?.genres.filter((g) => g.genre !== "other").map((g) => (
          <span key={g.genre} className="genre-timeline-legend-item">
            <span className="genre-timeline-dot" style={{ backgroundColor: g.color }} />
            {g.genre}
          </span>
        ))}
      </div>
    </div>
  );
}
