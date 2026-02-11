/**
 * Shared API resilience utilities: retry with backoff, circuit breaker,
 * batch coalescing, and typed ApiError.
 */

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * Typed error for distinguishing "no data" from "fetch failed".
 * Carries optional status code and retryable flag for downstream handling.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Determine whether an error is retryable based on its properties.
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) return error.retryable;
  if (error && typeof error === "object") {
    const e = error as Record<string, any>;
    if (e.retryable === true) return true;
    if (typeof e.status === "number" && RETRYABLE_STATUS_CODES.has(e.status))
      return true;
    if (
      typeof e.statusCode === "number" &&
      RETRYABLE_STATUS_CODES.has(e.statusCode)
    )
      return true;
  }
  return false;
}

/**
 * Generic async retry with exponential backoff and jitter.
 * Only retries errors deemed retryable (429, 5xx, or error.retryable === true).
 * Non-retryable errors (400, 401, 403, 404) are thrown immediately.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // Don't retry non-retryable errors or if we've exhausted retries
      if (!isRetryable(error) || attempt >= maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5);
      await new Promise((r) => setTimeout(r, jitter));
    }
  }

  // Should not be reached, but satisfy TypeScript
  throw lastError;
}

/**
 * Three-state circuit breaker: closed -> open -> half_open -> closed.
 *
 * In closed state: requests pass through normally, failures are counted.
 * When failures hit threshold: transitions to open, all requests rejected immediately.
 * After resetTimeout elapses: transitions to half_open, one request allowed through.
 * If that request succeeds: back to closed. If it fails: back to open.
 */
export class CircuitBreaker {
  private state: "closed" | "open" | "half_open" = "closed";
  private failures = 0;
  private lastFailure = 0;

  constructor(
    private failureThreshold: number = 5,
    private resetTimeoutMs: number = 60000,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailure >= this.resetTimeoutMs) {
        this.state = "half_open";
      } else {
        throw new ApiError(
          "Circuit open: API temporarily unavailable",
          undefined,
          true,
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  reset(): void {
    this.failures = 0;
    this.state = "closed";
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = "open";
    }
  }
}

/**
 * Batch coalescer: collects individual lookups within a time window
 * and flushes them as a single batched call.
 *
 * - Deduplicates: if the same key is requested multiple times within a window,
 *   all callers share the same result.
 * - Flushes when window timer fires OR when pending count reaches maxBatch.
 */
type BatchEntry<V> = {
  resolve: (val: V | undefined) => void;
  reject: (err: unknown) => void;
};

export function createBatchCoalescer<K, V>(
  batchFn: (keys: K[]) => Promise<Map<K, V>>,
  windowMs: number = 50,
  maxBatch: number = 50,
): (key: K) => Promise<V | undefined> {
  let pending = new Map<K, BatchEntry<V>[]>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush(): void {
    timer = null;
    const batch = pending;
    pending = new Map();

    const keys = [...batch.keys()];
    batchFn(keys)
      .then((results) => {
        for (const [key, entries] of batch) {
          const val = results.get(key);
          for (const entry of entries) {
            entry.resolve(val);
          }
        }
      })
      .catch((err) => {
        for (const entries of batch.values()) {
          for (const entry of entries) {
            entry.reject(err);
          }
        }
      });
  }

  return function request(key: K): Promise<V | undefined> {
    return new Promise<V | undefined>((resolve, reject) => {
      const entries = pending.get(key) || [];
      entries.push({ resolve, reject });
      pending.set(key, entries);

      if (pending.size >= maxBatch) {
        if (timer) clearTimeout(timer);
        flush();
      } else if (!timer) {
        timer = setTimeout(flush, windowMs);
      }
    });
  };
}
