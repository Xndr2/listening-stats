const { memo } = Spicetify.React;

import { COMMUNITY_BUYMEACOFFEE_URL, COMMUNITY_DISCORD_URL } from "../../shared/constants/community-links";

interface AppFooterProps {
	version: string;
	onCheckForUpdates: () => void;
}

function AppFooterInner({ version, onCheckForUpdates }: AppFooterProps) {
	return (
		<footer className="stats-app-footer">
			<span className="stats-app-footer-credit">Made with love by Xndr</span>
			<span className="stats-app-footer-links" aria-label="Community links">
				<a className="stats-app-footer-link" href={COMMUNITY_DISCORD_URL} target="_blank" rel="noopener noreferrer">
					Discord
				</a>
				<a
					className="stats-app-footer-link"
					href={COMMUNITY_BUYMEACOFFEE_URL}
					target="_blank"
					rel="noopener noreferrer"
				>
					Buy me a coffee
				</a>
			</span>
			<span className="stats-app-footer-meta">
				<span className="stats-app-footer-version">v{version}</span>
				<button type="button" className="stats-app-footer-install-link" onClick={onCheckForUpdates}>
					Check for updates
				</button>
			</span>
		</footer>
	);
}

export const AppFooter = memo(AppFooterInner);
