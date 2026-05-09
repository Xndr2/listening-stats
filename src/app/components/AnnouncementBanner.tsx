/** Same path as `manifest.json` icon  -  bar chart glyph for Listening Stats. */
function ListeningStatsBannerIcon() {
	return (
		<svg
			className="announcement-banner-icon"
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden="true"
			focusable="false"
		>
			<path d="M3 12V15H5V12H3ZM7 8V19H9V8H7ZM11 5V22H13V5H11ZM15 8V19H17V8H15ZM19 12V15H21V12H19Z" />
		</svg>
	);
}

interface AnnouncementBannerProps {
	title: string;
	body: string;
	/** UPDATE-style remote banner: show only the title in the main row (no body / no en dash). */
	titleOnly?: boolean;
	actionLabel?: string;
	actionUrl?: string;
	onActionClick?: () => void;
	onDismiss: () => void;
}

export function AnnouncementBanner({
	title,
	body,
	titleOnly = false,
	actionLabel,
	actionUrl,
	onActionClick,
	onDismiss,
}: AnnouncementBannerProps) {
	return (
		<div className="announcement-banner">
			<ListeningStatsBannerIcon />
			<span className="announcement-banner-text">
				{titleOnly ? (
					<strong>{title}</strong>
				) : (
					<>
						<strong>{title}</strong>
						{" \u2013 "}
						{body}
					</>
				)}
			</span>
			{actionLabel &&
				(onActionClick ? (
					<button
						type="button"
						className="announcement-banner-link announcement-banner-link-btn"
						onClick={onActionClick}
					>
						{actionLabel}
					</button>
				) : (
					<a
						className="announcement-banner-link"
						href={actionUrl ?? "#"}
						target={actionUrl && actionUrl !== "#" ? "_blank" : undefined}
						rel={actionUrl && actionUrl !== "#" ? "noopener noreferrer" : undefined}
					>
						{actionLabel}
					</a>
				))}
			<button
				type="button"
				className="announcement-banner-dismiss"
				onClick={onDismiss}
				aria-label="Dismiss"
			>
				×
			</button>
		</div>
	);
}
