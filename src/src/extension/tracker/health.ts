import { EVENTS } from "../../shared/constants/events";
import { LS_KEYS } from "../../shared/constants/storage-keys";

export interface HealthPayload {
	healthy: boolean;
	lastWriteAt: number | null;
	lastTrackName: string | null;
	errorCount: number;
	lastError: string | null;
}

export class HealthIndicator {
	private _state: HealthPayload = {
		healthy: true,
		lastWriteAt: null,
		lastTrackName: null,
		errorCount: 0,
		lastError: null,
	};

	getHealth(): HealthPayload {
		return { ...this._state };
	}

	recordSuccess(trackName: string): void {
		this._state.healthy = true;
		this._state.lastWriteAt = Date.now();
		this._state.lastTrackName = trackName;
		this._state.errorCount = 0;
		this._state.lastError = null;
		this.publish();
	}

	recordFailure(error: string): void {
		this._state.healthy = false;
		this._state.errorCount += 1;
		this._state.lastError = error;
		this.publish();
	}

	private publish(): void {
		try {
			localStorage.setItem(LS_KEYS.TRACKING_HEALTH, JSON.stringify(this._state));
		} catch {
			// localStorage might be full or blocked  -  swallow error
		}
		window.dispatchEvent(new CustomEvent(EVENTS.HEALTH_CHANGED, { detail: { ...this._state } }));
	}
}
