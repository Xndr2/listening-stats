import type { AppError, AppErrorVariant } from "../../shared/errors";

const { useState, useEffect } = Spicetify.React;

interface VariantConfig {
	title: string;
	body: string;
	cta: "retry" | "settings" | null;
}

const VARIANT_CONFIG: Record<AppErrorVariant, VariantConfig> = {
	UserNotFound: {
		title: "We couldn't find that stats.fm user",
		body: "Double-check the username in Settings.",
		cta: "settings",
	},
	NetworkError: {
		title: "Couldn't reach stats.fm",
		body: "Your connection might be flaky.",
		cta: "retry",
	},
	ServiceDown: {
		title: "stats.fm is having a moment",
		body: "Their side, not yours.",
		cta: "retry",
	},
	RateLimited: {
		title: "Too many requests",
		body: "We'll back off automatically.",
		cta: null,
	},
	InvalidApiKey: {
		title: "Invalid Last.fm API key",
		body: "Check your key in Settings.",
		cta: "settings",
	},
	Unknown: {
		title: "Something went sideways",
		body: "It happens. Try once more?",
		cta: "retry",
	},
};

interface InlineErrorCardProps {
	error: AppError;
	onRetry: () => void;
	onOpenSettings: () => void;
}

function useCountdown(resetAt: number | undefined): number {
	const [remaining, setRemaining] = useState(() => {
		if (!resetAt) return 0;
		return Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
	});

	useEffect(() => {
		if (!resetAt) return;
		const id = setInterval(() => {
			const next = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
			setRemaining(next);
			if (next <= 0) clearInterval(id);
		}, 1000);
		return () => clearInterval(id);
	}, [resetAt]);

	return remaining;
}

export function InlineErrorCard({ error, onRetry, onOpenSettings }: InlineErrorCardProps) {
	const config = VARIANT_CONFIG[error.variant];
	const countdown = useCountdown(error.resetAt);

	const handleCta = config.cta === "settings" ? onOpenSettings : onRetry;
	const ctaLabel = config.cta === "settings" ? "Open Settings" : "Retry";

	return (
		<div className="inline-error-card" role="status">
			<div className="inline-error-content">
				<div className="inline-error-title">{config.title}</div>
				<div className="inline-error-body">{config.body}</div>
				{error.resetAt !== undefined && countdown > 0 && (
					<div className="inline-error-countdown">retry in 0:{countdown.toString().padStart(2, "0")}</div>
				)}
			</div>
			{config.cta && (
				<button type="button" className="inline-error-cta" onClick={handleCta}>
					{ctaLabel}
				</button>
			)}
		</div>
	);
}
