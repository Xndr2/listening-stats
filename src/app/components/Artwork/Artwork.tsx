import { useState } from "react";
import { isSafeImageUrl } from "../../../shared/util/url-allowlist";
import { Icon } from "../Icon";
import "./Artwork.css";

/** Cover art or artist photo; a quiet placeholder when there's none or it fails. */
export function Artwork({ src, size = 40, round = false }: { src?: string | null; size?: number; round?: boolean }) {
	// Remembers which image failed, so a reused row showing a new one tries it.
	const [failed, setFailed] = useState<string | null | undefined>();
	const ok = isSafeImageUrl(src) && failed !== src;
	return (
		<span className={`ls-art ${round ? "is-round" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
			{ok ? (
				<img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} />
			) : (
				<Icon name="music" size={Math.round(size * 0.4)} />
			)}
		</span>
	);
}
