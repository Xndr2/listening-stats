import { LOG_PREFIX } from "../constants/app";

type SpicetifyProbe = {
	Spicetify?: { Player?: { addEventListener?: unknown; data?: unknown }; React?: unknown; ReactDOM?: unknown };
};

/**
 * The extension bundle is evaluated very early, before the Spicetify globals
 * are populated. Resolves once Player + React exist.
 *
 * It never gives up: a slow Spotify start used to hit a 30 s timeout, and the
 * extension (tracker included) then stayed dead until Spotify restarted. After
 * `warnAfterMs` it logs once and keeps checking, more slowly.
 */
export function waitForSpicetify(warnAfterMs = 30_000, pollMs = 100): Promise<void> {
	const started = Date.now();
	let warned = false;
	return new Promise((resolve) => {
		const poll = () => {
			const sp = (globalThis as SpicetifyProbe).Spicetify;
			if (sp?.Player?.addEventListener && sp.React && sp.ReactDOM) {
				resolve();
				return;
			}
			const late = Date.now() - started > warnAfterMs;
			if (late && !warned) {
				warned = true;
				console.warn(`${LOG_PREFIX} Spicetify still isn't ready after ${warnAfterMs / 1000}s; still waiting`);
			}
			setTimeout(poll, late ? 1000 : pollMs);
		};
		poll();
	});
}
