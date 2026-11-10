/**
 * Right-click on a row opens Spotify's own menu for that track, artist or
 * album (add to playlist, go to artist, share...). These components are
 * Spotify internals; if a client update breaks them, the row renders without
 * a menu instead of taking the widget down.
 */
import { Component, type ReactElement, type ReactNode } from "react";

type MenuKind = "TrackMenu" | "ArtistMenu" | "AlbumMenu";

const KIND: Record<string, MenuKind> = { track: "TrackMenu", artist: "ArtistMenu", album: "AlbumMenu" };

class Fallback extends Component<{ children: ReactNode; plain: ReactNode }, { broken: boolean }> {
	state = { broken: false };
	static getDerivedStateFromError() {
		return { broken: true };
	}
	render() {
		return this.state.broken ? this.props.plain : this.props.children;
	}
}

export function SpotifyMenu({ uri, children }: { uri?: string; children: ReactElement }) {
	const kind = KIND[uri?.match(/^spotify:(track|artist|album):[A-Za-z0-9]+$/)?.[1] ?? ""];
	const RC = Spicetify.ReactComponent as unknown as Record<
		string,
		React.ComponentType<Record<string, unknown>> | undefined
	>;
	const Wrapper = RC?.RightClickMenu;
	const Menu = kind ? RC?.[kind] : undefined;
	if (!uri || !Wrapper || !Menu) return children;
	return (
		<Fallback plain={children}>
			<Wrapper menu={<Menu uri={uri} />}>{children}</Wrapper>
		</Fallback>
	);
}
