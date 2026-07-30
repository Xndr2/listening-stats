import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Watchdog } from "../extension/tracker/watchdog";

describe("Watchdog", () => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let onReRegister: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let pingDb: any;
	let watchdog: Watchdog;

	// Override visibilityState  -  writable via Object.defineProperty
	const setVisibility = (state: "visible" | "hidden") => {
		Object.defineProperty(document, "visibilityState", {
			value: state,
			writable: true,
			configurable: true,
		});
	};

	const fireVisibilityChange = () => {
		document.dispatchEvent(new Event("visibilitychange"));
	};

	beforeEach(() => {
		vi.useFakeTimers();
		onReRegister = vi.fn();
		pingDb = vi.fn().mockResolvedValue(undefined);
		// Clean up sentinel
		delete (window as any).__lsSongHandler;
		// Default visibility: visible
		setVisibility("visible");
		watchdog = new Watchdog({
			intervalMs: 100,
			sentinelKey: "__lsSongHandler",
			onReRegister,
			pingDb,
		});
	});

	afterEach(() => {
		watchdog.stop();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("start()", () => {
		it("does not fire onReRegister before interval tick", () => {
			watchdog.start();
			expect(onReRegister).not.toHaveBeenCalled();
		});

		it("calls onReRegister on interval tick when sentinel is missing", () => {
			delete (window as any).__lsSongHandler;
			watchdog.start();
			vi.advanceTimersByTime(100);
			expect(onReRegister).toHaveBeenCalledTimes(1);
		});

		it("does NOT call onReRegister on interval tick when sentinel exists", () => {
			(window as any).__lsSongHandler = () => {};
			watchdog.start();
			vi.advanceTimersByTime(100);
			expect(onReRegister).not.toHaveBeenCalled();
		});

		it("calls onReRegister on each tick when sentinel is missing", () => {
			delete (window as any).__lsSongHandler;
			watchdog.start();
			vi.advanceTimersByTime(300);
			expect(onReRegister).toHaveBeenCalledTimes(3);
		});
	});

	describe("visibilitychange", () => {
		it("calls onReRegister on visibilitychange to visible when sentinel missing", () => {
			delete (window as any).__lsSongHandler;
			watchdog.start();
			setVisibility("visible");
			fireVisibilityChange();
			expect(onReRegister).toHaveBeenCalledTimes(1);
		});

		it("does NOT call onReRegister on visibilitychange to visible when sentinel exists", () => {
			(window as any).__lsSongHandler = () => {};
			watchdog.start();
			setVisibility("visible");
			fireVisibilityChange();
			expect(onReRegister).not.toHaveBeenCalled();
		});

		it("calls pingDb on visibilitychange to visible", () => {
			watchdog.start();
			setVisibility("visible");
			fireVisibilityChange();
			expect(pingDb).toHaveBeenCalledTimes(1);
		});

		it("does NOT call pingDb on visibilitychange to hidden", () => {
			watchdog.start();
			setVisibility("hidden");
			fireVisibilityChange();
			expect(pingDb).not.toHaveBeenCalled();
		});

		it("does NOT call onReRegister on visibilitychange to hidden", () => {
			delete (window as any).__lsSongHandler;
			watchdog.start();
			setVisibility("hidden");
			fireVisibilityChange();
			expect(onReRegister).not.toHaveBeenCalled();
		});
	});

	describe("stop()", () => {
		it("clears the interval  -  no more ticks after stop", () => {
			delete (window as any).__lsSongHandler;
			watchdog.start();
			watchdog.stop();
			vi.advanceTimersByTime(300);
			expect(onReRegister).not.toHaveBeenCalled();
		});

		it("removes visibilitychange listener  -  no events after stop", () => {
			delete (window as any).__lsSongHandler;
			watchdog.start();
			watchdog.stop();
			setVisibility("visible");
			fireVisibilityChange();
			expect(onReRegister).not.toHaveBeenCalled();
			expect(pingDb).not.toHaveBeenCalled();
		});

		it("is safe to call stop() without start()", () => {
			expect(() => watchdog.stop()).not.toThrow();
		});

		it("is safe to call stop() multiple times", () => {
			watchdog.start();
			expect(() => {
				watchdog.stop();
				watchdog.stop();
			}).not.toThrow();
		});
	});

	describe("restart protection", () => {
		it("calling start() again clears the old interval", () => {
			delete (window as any).__lsSongHandler;
			watchdog.start();
			watchdog.start(); // second start should replace, not double
			vi.advanceTimersByTime(100);
			// Should only fire once, not twice (no double interval)
			expect(onReRegister).toHaveBeenCalledTimes(1);
		});
	});
});
