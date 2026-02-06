export function LoadingSkeleton() {
  return (
    <div className="stats-page">
      <div className="skeleton-header">
        <div className="skeleton-line skeleton-title-line" />
        <div className="skeleton-line skeleton-subtitle-line" />
      </div>

      <div className="overview-row">
        <div className="skeleton-card skeleton-hero" />
        <div className="overview-card-list">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      </div>

      <div className="top-lists-section">
        <div className="skeleton-list">
          <div className="skeleton-line skeleton-list-title" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-item">
              <div className="skeleton-circle" />
              <div className="skeleton-item-lines">
                <div className="skeleton-line" />
                <div className="skeleton-line skeleton-short" />
              </div>
            </div>
          ))}
        </div>
        <div className="skeleton-list">
          <div className="skeleton-line skeleton-list-title" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-item">
              <div className="skeleton-circle" />
              <div className="skeleton-item-lines">
                <div className="skeleton-line" />
                <div className="skeleton-line skeleton-short" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
