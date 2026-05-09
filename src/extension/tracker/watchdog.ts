export interface WatchdogConfig {
	/** Interval in milliseconds to check sentinel. Default: 300_000 (5 min) */
	intervalMs: number;
	/** Window property name used as sentinel flag. Default: '__lsSongHandler' */
	sentinelKey: string;
	/** Called when sentinel is missing and listeners need re-registration */
	onReRegister: () => void;
	/** Called on visibility restore to ping DB and force Dexie reconnect */
	pingDb: () => Promise<void>;
}

export class Watchdog {
	private readonly config: Required<WatchdogConfig>;
	private _intervalId: ReturnType<typeof setInterval> | null = null;
	private _visibilityHandler: (() => void) | null = null;

	constructor(config: WatchdogConfig) {
		this.config = {
			intervalMs: config.intervalMs ?? 300_000,
			sentinelKey: config.sentinelKey ?? "__lsSongHandler",
			onReRegister: config.onReRegister,
			pingDb: config.pingDb,
		};
	}

	start(): void {
		// Clear any existing interval (restart protection)
		if (this._intervalId !== null) {
			clearInterval(this._intervalId);
		}

		// Interval-based sentinel check
		this._intervalId = setInterval(() => {
			if (!(window as unknown as Record<string, unknown>)[this.config.sentinelKey]) {
				this.config.onReRegister();
			}
		}, this.config.intervalMs);

		// Remove existing visibilitychange listener if any (restart protection)
		if (this._visibilityHandler !== null) {
			document.removeEventListener("visibilitychange", this._visibilityHandler);
		}

		// visibilitychange-based sentinel check + DB ping
		this._visibilityHandler = () => {
			if (document.visibilityState !== "visible") return;

			// If sentinel is missing, re-register listeners immediately
			if (!(window as unknown as Record<string, unknown>)[this.config.sentinelKey]) {
				this.config.onReRegister();
			}

			// Always ping DB on visibility restore to force Dexie reconnect
			this.config.pingDb().catch(() => {
				// Swallow errors  -  DB will reconnect on next write attempt
			});
		};

		document.addEventListener("visibilitychange", this._visibilityHandler);
	}

	stop(): void {
		if (this._intervalId !== null) {
			clearInterval(this._intervalId);
			this._intervalId = null;
		}

		if (this._visibilityHandler !== null) {
			document.removeEventListener("visibilitychange", this._visibilityHandler);
			this._visibilityHandler = null;
		}
	}
}
