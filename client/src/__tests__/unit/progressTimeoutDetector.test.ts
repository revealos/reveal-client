/**
 * Tests for ProgressTimeoutDetector timer behavior
 * 
 * Verifies soft/hard threshold emission, self-rescheduling, and state management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createProgressTimeoutDetector, type ProgressTimeoutDetector } from "../../detectors/progressTimeoutDetector";

describe("ProgressTimeoutDetector timer behavior", () => {
  let detector: ProgressTimeoutDetector;
  let mockEmit: any;
  let mockLogger: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockEmit = vi.fn();
    mockLogger = {
      logDebug: vi.fn(),
      logWarn: vi.fn(),
      logError: vi.fn(),
    };
  });

  afterEach(() => {
    if (detector) {
      detector.destroy();
    }
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("soft threshold emission", () => {
    it("should emit soft threshold once when timeout_seconds reached (without hard threshold)", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          // No hard_timeout_seconds
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Fast-forward 15s (soft threshold)
      vi.advanceTimersByTime(15000);

      expect(mockEmit).toHaveBeenCalledTimes(1);
      const signal = mockEmit.mock.calls[0][0];
      expect(signal.type).toBe("no_progress");
      expect(signal.extra.time_since_progress_ms).toBe(15000);
      expect(signal.extra.timeout_seconds).toBe(15);

      // Fast-forward another 15s (total 30s)
      vi.advanceTimersByTime(15000);

      // Should NOT emit again (soft already emitted, no hard threshold)
      expect(mockEmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("hard threshold emission", () => {
    it("should emit hard threshold once when hard_timeout_seconds reached", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          hard_timeout_seconds: 30,
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Fast-forward 15s → soft emitted
      vi.advanceTimersByTime(15000);
      expect(mockEmit).toHaveBeenCalledTimes(1);
      const softSignal = mockEmit.mock.calls[0][0];
      expect(softSignal.extra.time_since_progress_ms).toBe(15000);

      // Fast-forward another 15s (total 30s) → hard emitted
      vi.advanceTimersByTime(15000);
      expect(mockEmit).toHaveBeenCalledTimes(2);
      const hardSignal = mockEmit.mock.calls[1][0];
      expect(hardSignal.extra.time_since_progress_ms).toBe(30000);

      // Fast-forward another 15s (total 45s)
      vi.advanceTimersByTime(15000);

      // Should NOT emit again (hard already emitted)
      expect(mockEmit).toHaveBeenCalledTimes(2);
    });

    it("should stop scheduling after hard threshold emitted", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          hard_timeout_seconds: 30,
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Fast-forward 30s → both soft and hard emitted
      vi.advanceTimersByTime(30000);
      expect(mockEmit).toHaveBeenCalledTimes(2);

      // Fast-forward 60s more (total 90s)
      vi.advanceTimersByTime(60000);

      // Should NOT emit again
      expect(mockEmit).toHaveBeenCalledTimes(2);
    });
  });

  describe("progress event resets", () => {
    it("should reset counters and restart timer after progress event", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          hard_timeout_seconds: 30,
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Fast-forward 15s → soft emitted
      vi.advanceTimersByTime(15000);
      expect(mockEmit).toHaveBeenCalledTimes(1);

      // Simulate progress event: task_created (use current fake time)
      const progressEvent = {
        kind: "product" as const,
        name: "task_created",
        timestamp: Date.now(), // Use current fake time (15000)
      };
      detector.onEvent(progressEvent);

      // Fast-forward 15s (new episode)
      vi.advanceTimersByTime(15000);

      // Should emit again (new episode started)
      expect(mockEmit).toHaveBeenCalledTimes(2);
      const newSignal = mockEmit.mock.calls[1][0];
      expect(newSignal.extra.time_since_progress_ms).toBe(15000); // Reset to 15s
    });

    it("should reset both soft and hard flags after progress event", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          hard_timeout_seconds: 30,
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Fast-forward 30s → both soft and hard emitted
      vi.advanceTimersByTime(30000);
      expect(mockEmit).toHaveBeenCalledTimes(2);

      // Simulate progress event (use current fake time)
      const progressEvent = {
        kind: "product" as const,
        name: "task_created",
        timestamp: Date.now(), // Use current fake time (30000)
      };
      detector.onEvent(progressEvent);

      // Fast-forward 30s (new episode)
      vi.advanceTimersByTime(30000);

      // Should emit both soft and hard again (new episode)
      expect(mockEmit).toHaveBeenCalledTimes(4);
    });
  });

  describe("single active timer guard", () => {
    it("should not emit duplicate signals if timer callback fires multiple times rapidly", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          hard_timeout_seconds: 30,
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Fast-forward 15s
      vi.advanceTimersByTime(15000);

      // Should emit exactly once
      expect(mockEmit).toHaveBeenCalledTimes(1);
    });

    it("should handle rapid progress events without duplicate timers", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          hard_timeout_seconds: 30,
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Simulate rapid progress events (all at same time to test timer guard)
      const now = Date.now();
      detector.onEvent({
        kind: "product" as const,
        name: "task_created",
        timestamp: now,
      });
      detector.onEvent({
        kind: "product" as const,
        name: "task_created",
        timestamp: now, // Same timestamp to test guard
      });
      detector.onEvent({
        kind: "product" as const,
        name: "task_created",
        timestamp: now, // Same timestamp to test guard
      });

      // Fast-forward 15s from now (last progress event was at 'now')
      vi.advanceTimersByTime(15000);

      // Should emit exactly once (single active timer guard prevents duplicates)
      expect(mockEmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("no hard threshold configured", () => {
    it("should stop scheduling after soft emits if no hard_timeout_seconds", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          // No hard_timeout_seconds
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Fast-forward 15s → soft emitted
      vi.advanceTimersByTime(15000);
      expect(mockEmit).toHaveBeenCalledTimes(1);

      // Fast-forward 60s more
      vi.advanceTimersByTime(60000);

      // Should NOT emit again (no hard threshold, stop after soft)
      expect(mockEmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("destroy cleanup", () => {
    it("should reset flags and clear timer on destroy", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          hard_timeout_seconds: 30,
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Fast-forward 15s → soft emitted
      vi.advanceTimersByTime(15000);
      expect(mockEmit).toHaveBeenCalledTimes(1);

      // Destroy detector
      detector.destroy();

      // Fast-forward more time
      vi.advanceTimersByTime(30000);

      // Should NOT emit again (destroyed)
      expect(mockEmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("non-matching events", () => {
    it("should not reset timer for non-progress events", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          hard_timeout_seconds: 30,
          progress_event_names: ["task_created"], // Only task_created counts
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Send non-matching event
      detector.onEvent({
        kind: "product" as const,
        name: "navigation_clicked", // Not in progress_event_names
        timestamp: Date.now() + 5000,
      });

      // Fast-forward 15s
      vi.advanceTimersByTime(15000);

      // Should still emit (timer not reset)
      expect(mockEmit).toHaveBeenCalledTimes(1);
      const signal = mockEmit.mock.calls[0][0];
      expect(signal.extra.time_since_progress_ms).toBeGreaterThanOrEqual(15000);
    });

    it("should not reset timer for non-product events", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          hard_timeout_seconds: 30,
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Send non-product event
      detector.onEvent({
        kind: "friction" as const,
        name: "stall",
        timestamp: Date.now() + 5000,
      });

      // Fast-forward 15s
      vi.advanceTimersByTime(15000);

      // Should still emit (timer not reset)
      expect(mockEmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("route change resets", () => {
    it("should reset episode on route change and allow soft to fire again", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          hard_timeout_seconds: 30,
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Fast-forward 15s on page A → soft fires
      vi.advanceTimersByTime(15000);
      expect(mockEmit).toHaveBeenCalledTimes(1);
      const firstSignal = mockEmit.mock.calls[0][0];
      expect(firstSignal.extra.time_since_progress_ms).toBe(15000);

      // Navigate to page B → timer resets
      if (detector.handleRouteChange) {
        detector.handleRouteChange("/page-b");
      }

      // Fast-forward 15s on page B → soft can fire again
      vi.advanceTimersByTime(15000);
      expect(mockEmit).toHaveBeenCalledTimes(2);
      const secondSignal = mockEmit.mock.calls[1][0];
      expect(secondSignal.extra.time_since_progress_ms).toBe(15000); // Reset to 15s
    });

    it("should reset episode on route change even if soft/hard already emitted", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          hard_timeout_seconds: 30,
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Fast-forward 30s → both soft and hard emitted
      vi.advanceTimersByTime(30000);
      expect(mockEmit).toHaveBeenCalledTimes(2);

      // Navigate to new page → episode resets
      if (detector.handleRouteChange) {
        detector.handleRouteChange("/new-page");
      }

      // Fast-forward 15s → soft can fire again (new episode)
      vi.advanceTimersByTime(15000);
      expect(mockEmit).toHaveBeenCalledTimes(3);
      const newSignal = mockEmit.mock.calls[2][0];
      expect(newSignal.extra.time_since_progress_ms).toBe(15000);
    });

    it("should allow hard to fire after route change if no progress", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          hard_timeout_seconds: 30,
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Navigate to page A
      if (detector.handleRouteChange) {
        detector.handleRouteChange("/page-a");
      }

      // Fast-forward 15s → soft fires
      vi.advanceTimersByTime(15000);
      expect(mockEmit).toHaveBeenCalledTimes(1);

      // Fast-forward another 15s (total 30s) → hard fires
      vi.advanceTimersByTime(15000);
      expect(mockEmit).toHaveBeenCalledTimes(2);
      const hardSignal = mockEmit.mock.calls[1][0];
      expect(hardSignal.extra.time_since_progress_ms).toBe(30000);

      // After hard, no further emits until progress or navigation
      vi.advanceTimersByTime(60000);
      expect(mockEmit).toHaveBeenCalledTimes(2);
    });

    it("should preserve progress event reset behavior after route change", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          hard_timeout_seconds: 30,
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Navigate to page A
      if (detector.handleRouteChange) {
        detector.handleRouteChange("/page-a");
      }

      // Fast-forward 10s (not yet at soft threshold)
      vi.advanceTimersByTime(10000);

      // Progress event → resets episode
      const progressEvent = {
        kind: "product" as const,
        name: "task_created",
        timestamp: Date.now(),
      };
      detector.onEvent(progressEvent);

      // Fast-forward 15s from progress event → soft fires
      vi.advanceTimersByTime(15000);
      expect(mockEmit).toHaveBeenCalledTimes(1);
      const signal = mockEmit.mock.calls[0][0];
      expect(signal.extra.time_since_progress_ms).toBe(15000);
    });

    it("should not reset on same pathname", () => {
      detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 15,
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      // Set initial pathname
      if (detector.handleRouteChange) {
        detector.handleRouteChange("/page-a");
      }

      // Fast-forward 10s
      vi.advanceTimersByTime(10000);

      // Call handleRouteChange with same pathname → should NOT reset
      if (detector.handleRouteChange) {
        detector.handleRouteChange("/page-a");
      }

      // Fast-forward 5s more (total 15s) → soft fires
      vi.advanceTimersByTime(5000);
      expect(mockEmit).toHaveBeenCalledTimes(1);
      const signal = mockEmit.mock.calls[0][0];
      expect(signal.extra.time_since_progress_ms).toBe(15000); // Not reset
    });
  });
});
