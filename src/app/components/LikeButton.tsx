import { likesAvailable, toggleLike, useLiked } from "../library";
import { Icon } from "./Icon";
import "./LikeButton.css";

/** Spotify-style heart for a track. Renders nothing for non-Spotify items. */
export function LikeButton({ uri, name }: { uri?: string; name: string }) {
	const liked = useLiked(uri);
	if (!uri?.startsWith("spotify:track:") || !likesAvailable()) return <span className="ls-like-slot" />;
	return (
		<button
			type="button"
			className={`ls-like ${liked ? "is-liked" : ""}`}
			aria-pressed={!!liked}
			aria-label={liked ? `Remove ${name} from Liked Songs` : `Save ${name} to Liked Songs`}
			data-tip={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
			onClick={(e) => {
				e.stopPropagation();
				void toggleLike(uri);
			}}
		>
			<Icon name={liked ? "heartFilled" : "heart"} />
		</button>
	);
}
