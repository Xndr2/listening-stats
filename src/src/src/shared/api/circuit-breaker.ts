type CircuitState = "closed" | "open" | "half-open";

const failureThreshold = 3;
const cooldownMs = 30_000;

export class CircuitBreaker {
	private state: CircuitState = "closed";
	private failureCount = 0;
	private openedAt: number | null = null;
	private extraCooldownMs = 0;

	isOpen(): boolean {
		if (this.state === "open") {
			const elapsed = Date.now() - (this.openedAt ?? 0);
			const totalCooldown = cooldownMs + this.extraCooldownMs;
			if (elapsed >= totalCooldown) {
				this.state = "half-open";
				return false;
			}
			return true;
		}
		return false;
	}

	recordSuccess(): void {
		this.failureCount = 0;
		this.state = "closed";
		this.openedAt = null;
		this.extraCooldownMs = 0;
	}

	recordFailure(retryAfter?: number): void {
		if (this.state === "half-open") {
			// immediately reopen
			this.state = "open";
			this.openedAt = Date.now();
			this.extraCooldownMs = retryAfter ? retryAfter * 1000 : 0;
			return;
		}

		this.failureCount += 1;
		if (this.failureCount >= failureThreshold) {
			this.state = "open";
			this.openedAt = Date.now();
			this.extraCooldownMs = retryAfter ? retryAfter * 1000 : 0;
		}
	}

	reset(): void {
		this.recordSuccess();
	}

	getResetAt(): number | null {
		if (this.state !== "open" || this.openedAt === null) return null;
		return this.openedAt + cooldownMs + this.extraCooldownMs;
	}

	getState(): CircuitState {
		return this.state;
	}
}

export const circuitBreaker = new CircuitBreaker();
