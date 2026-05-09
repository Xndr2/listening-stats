const { memo } = Spicetify.React;

interface AppFooterProps {
	version: string;
	onCheckForUpdates: () => void;
}

function AppFooterInner({ version, onCheckForUpdates }: AppFooterProps) {
	return (
		<footer className="stats-app-footer">
			<span className="stats-app-footer-credit">Made with love by Xndr</span>
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
