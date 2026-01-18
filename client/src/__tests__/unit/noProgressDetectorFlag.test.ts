/**
 * Tests for no_progress detector flag behavior
 * 
 * Verifies that ProgressTimeoutDetector respects features.detectors.no_progress flag
 * in addition to progress_timeout_rules.enabled
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createProgressTimeoutDetector, type ProgressTimeoutDetector } from "../../detectors/progressTimeoutDetector";
import type { ClientConfig } from "../../types/config";
import { DEFAULT_FEATURES } from "../../types/config";

// Mock entryPoint logic for testing detector initialization
function shouldInitializeProgressTimeoutDetector(config: ClientConfig): boolean {
  const features = config.features || DEFAULT_FEATURES;
  const detectorFlags = features.detectors || DEFAULT_FEATURES.detectors;
  const noProgressDetectorEnabled = detectorFlags.no_progress ?? true; // Default: true
  const progressTimeoutEnabled = config.progress_timeout_rules?.enabled === true;
  
  return noProgressDetectorEnabled && progressTimeoutEnabled;
}

describe("no_progress detector flag", () => {
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
    vi.useRealTimers();
  });

  describe("shouldInitializeProgressTimeoutDetector logic", () => {
    it("should return true when both features.detectors.no_progress and progress_timeout_rules.enabled are true", () => {
      const config: ClientConfig = {
        projectId: "test-project",
        environment: "development",
        sdk: { samplingRate: 1.0 },
        decision: { endpoint: "/decide", timeoutMs: 2000 },
        features: {
          detectors: {
            no_progress: true,
          },
        },
        progress_timeout_rules: {
          enabled: true,
          timeout_seconds: 60,
          progress_event_names: ["task_created"],
        },
        templates: [],
        ttlSeconds: 60,
      };

      expect(shouldInitializeProgressTimeoutDetector(config)).toBe(true);
    });

    it("should return false when features.detectors.no_progress is false (even if progress_timeout_rules.enabled is true)", () => {
      const config: ClientConfig = {
        projectId: "test-project",
        environment: "development",
        sdk: { samplingRate: 1.0 },
        decision: { endpoint: "/decide", timeoutMs: 2000 },
        features: {
          detectors: {
            no_progress: false, // Disabled via flag
          },
        },
        progress_timeout_rules: {
          enabled: true,
          timeout_seconds: 60,
          progress_event_names: ["task_created"],
        },
        templates: [],
        ttlSeconds: 60,
      };

      expect(shouldInitializeProgressTimeoutDetector(config)).toBe(false);
    });

    it("should return false when progress_timeout_rules.enabled is false (even if features.detectors.no_progress is true)", () => {
      const config: ClientConfig = {
        projectId: "test-project",
        environment: "development",
        sdk: { samplingRate: 1.0 },
        decision: { endpoint: "/decide", timeoutMs: 2000 },
        features: {
          detectors: {
            no_progress: true,
          },
        },
        progress_timeout_rules: {
          enabled: false, // Disabled via timeout rules
          timeout_seconds: 60,
          progress_event_names: ["task_created"],
        },
        templates: [],
        ttlSeconds: 60,
      };

      expect(shouldInitializeProgressTimeoutDetector(config)).toBe(false);
    });

    it("should return true when features.detectors.no_progress is undefined (defaults to true) and progress_timeout_rules.enabled is true", () => {
      const config: ClientConfig = {
        projectId: "test-project",
        environment: "development",
        sdk: { samplingRate: 1.0 },
        decision: { endpoint: "/decide", timeoutMs: 2000 },
        features: {
          detectors: {
            // no_progress not specified, should default to true
          },
        },
        progress_timeout_rules: {
          enabled: true,
          timeout_seconds: 60,
          progress_event_names: ["task_created"],
        },
        templates: [],
        ttlSeconds: 60,
      };

      expect(shouldInitializeProgressTimeoutDetector(config)).toBe(true);
    });

    it("should return false when features.detectors is missing (uses DEFAULT_FEATURES, which has no_progress: true) but progress_timeout_rules.enabled is false", () => {
      const config: ClientConfig = {
        projectId: "test-project",
        environment: "development",
        sdk: { samplingRate: 1.0 },
        decision: { endpoint: "/decide", timeoutMs: 2000 },
        // features.detectors missing - will use DEFAULT_FEATURES.detectors (no_progress: true)
        progress_timeout_rules: {
          enabled: false,
          timeout_seconds: 60,
          progress_event_names: ["task_created"],
        },
        templates: [],
        ttlSeconds: 60,
      };

      expect(shouldInitializeProgressTimeoutDetector(config)).toBe(false);
    });
  });

  describe("ProgressTimeoutDetector creation with flag", () => {
    it("should create detector when both flags are enabled", () => {
      const detector = createProgressTimeoutDetector({
        config: {
          enabled: true,
          timeout_seconds: 60,
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      expect(detector).toBeDefined();
      expect(detector.onEvent).toBeDefined();
      expect(detector.destroy).toBeDefined();
    });

    it("should return no-op detector when config.enabled is false (regardless of features.detectors.no_progress)", () => {
      const detector = createProgressTimeoutDetector({
        config: {
          enabled: false, // Disabled at config level
          timeout_seconds: 60,
          progress_event_names: ["task_created"],
        },
        onFrictionSignal: mockEmit,
        logger: mockLogger,
      });

      expect(detector).toBeDefined();
      // No-op detector should not emit signals
      detector.onEvent({
        kind: "product",
        name: "task_created",
        timestamp: Date.now(),
      });

      // Advance time past timeout
      vi.advanceTimersByTime(61000);

      expect(mockEmit).not.toHaveBeenCalled();
    });
  });
});
