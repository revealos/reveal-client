/**
 * ProgressTimeoutDetector
 * 
 * Detects lack of progress by monitoring product events matching progress_event_names.
 * 
 * Logic:
 * - Listens to captured events via onEvent callback
 * - If event.kind === "product" AND event.name in progress_event_names, updates lastProgressAt and resets timer
 * - On timeout (timeout_seconds), emits "no_progress" friction signal
 * - Supports hard timeout (hard_timeout_seconds) for higher confidence
 * 
 * @module detectors/progressTimeoutDetector
 */

import type { BaseEvent } from "../types/events";
import type { FrictionSignal } from "../types/friction";
import type { Logger } from "../utils/logger";
import { safeTry } from "../utils/safe";

/**
 * ProgressTimeoutDetector configuration
 */
export interface ProgressTimeoutDetectorConfig {
  enabled: boolean;
  timeout_seconds: number;
  hard_timeout_seconds?: number;
  progress_event_names: string[];
}

/**
 * ProgressTimeoutDetector options
 */
export interface ProgressTimeoutDetectorOptions {
  config: ProgressTimeoutDetectorConfig;
  onFrictionSignal: (signal: FrictionSignal) => void;
  logger: Logger;
}

/**
 * ProgressTimeoutDetector interface
 */
export interface ProgressTimeoutDetector {
  onEvent(event: BaseEvent): void; // Public method called by EventPipeline callback
  destroy(): void;
  handleRouteChange?: (newPathname: string) => void; // Optional: handle route changes
}

/**
 * Create a new ProgressTimeoutDetector instance
 * 
 * @param options - Configuration options
 * @returns ProgressTimeoutDetector instance
 */
export function createProgressTimeoutDetector(
  options: ProgressTimeoutDetectorOptions
): ProgressTimeoutDetector {
  const {
    config,
    onFrictionSignal,
    logger,
  } = options;

  // Early return if disabled
  if (!config.enabled) {
    logger.logDebug("ProgressTimeoutDetector: disabled, returning no-op detector");
    return {
      onEvent: () => {
        // No-op
      },
      destroy: () => {
        // No-op
      },
    };
  }

  // Validate config
  if (!config.progress_event_names || config.progress_event_names.length === 0) {
    logger.logWarn("ProgressTimeoutDetector: progress_event_names is empty, detector will not trigger");
  }

  if (config.timeout_seconds <= 0) {
    logger.logWarn("ProgressTimeoutDetector: timeout_seconds must be positive, detector disabled");
    return {
      onEvent: () => {
        // No-op
      },
      destroy: () => {
        // No-op
      },
    };
  }

  // State
  let lastProgressAt: number = Date.now(); // Initialize to now (timeout measured from detector start unless progress happens)
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let softEmitted: boolean = false; // Track if soft threshold signal was emitted
  let hardEmitted: boolean = false; // Track if hard threshold signal was emitted
  let currentPathname: string | null = null; // Track current route for navigation detection
  const progressEventNamesSet = new Set(config.progress_event_names);
  const timeoutMs = config.timeout_seconds * 1000;
  const hardTimeoutMs = config.hard_timeout_seconds ? config.hard_timeout_seconds * 1000 : undefined;

  /**
   * Clear existing timeout
   */
  function clearTimeout(): void {
    if (timeoutId !== null) {
      safeTry(() => {
        if (typeof window !== "undefined" && window.clearTimeout) {
          window.clearTimeout(timeoutId as any);
        } else if (typeof global !== "undefined" && (global as any).clearTimeout) {
          (global as any).clearTimeout(timeoutId);
        }
      }, logger, "ProgressTimeoutDetector.clearTimeout");
      timeoutId = null;
    }
  }

  /**
   * Set timeout to emit friction signal
   * Self-reschedules to check hard threshold if soft already emitted
   */
  function setTimeout(): void {
    clearTimeout(); // Single active timer guard: clear any existing timeout

    // Stop scheduling if hard threshold already emitted
    if (hardEmitted) {
      return;
    }

    safeTry(() => {
      const timeoutCallback = () => {
        safeTry(() => {
          const now = Date.now();
          const timeSinceProgressMs = now - lastProgressAt;

          // Check hard threshold first (if soft already emitted, we're waiting for hard)
          if (softEmitted && hardTimeoutMs !== undefined) {
            if (timeSinceProgressMs >= hardTimeoutMs && !hardEmitted) {
              // Build friction signal for hard threshold
              const pageUrl = typeof window !== "undefined" && window.location
                ? window.location.href
                : "unknown";

              const signal: FrictionSignal = {
                type: "no_progress",
                pageUrl,
                selector: null,
                timestamp: now,
                extra: {
                  trigger_kind: "progress_timeout",
                  timeout_seconds: config.timeout_seconds,
                  last_progress_at_ms: lastProgressAt,
                  time_since_progress_ms: timeSinceProgressMs,
                  hard_timeout_seconds: config.hard_timeout_seconds,
                },
              };

              logger.logDebug("ProgressTimeoutDetector: emitting no_progress signal (hard threshold)", {
                timeSinceProgressMs,
                timeout_seconds: config.timeout_seconds,
                hard_timeout_seconds: config.hard_timeout_seconds,
              });
              hardEmitted = true;
              onFrictionSignal(signal);
              // Stop scheduling after hard emits
              return;
            } else if (timeSinceProgressMs < hardTimeoutMs) {
              // Not yet at hard threshold, reschedule to check again
              const remainingMs = hardTimeoutMs - timeSinceProgressMs;
              const nextTimeoutMs = Math.max(100, remainingMs); // Minimum 100ms to avoid tight loops
              
              if (typeof window !== "undefined" && window.setTimeout) {
                timeoutId = window.setTimeout(timeoutCallback, nextTimeoutMs) as any;
              } else if (typeof global !== "undefined" && (global as any).setTimeout) {
                timeoutId = (global as any).setTimeout(timeoutCallback, nextTimeoutMs);
              }
              return;
            }
            // Already past hard threshold but hardEmitted is true (shouldn't happen, but guard)
            return;
          }

          // Check soft threshold (only if not already emitted)
          if (!softEmitted && timeSinceProgressMs >= timeoutMs) {
            // Build friction signal for soft threshold
            const pageUrl = typeof window !== "undefined" && window.location
              ? window.location.href
              : "unknown";

            const signal: FrictionSignal = {
              type: "no_progress",
              pageUrl,
              selector: null,
              timestamp: now,
              extra: {
                trigger_kind: "progress_timeout",
                timeout_seconds: config.timeout_seconds,
                last_progress_at_ms: lastProgressAt,
                time_since_progress_ms: timeSinceProgressMs,
              },
            };

            // Add hard_timeout_seconds if configured
            if (config.hard_timeout_seconds !== undefined && signal.extra) {
              signal.extra.hard_timeout_seconds = config.hard_timeout_seconds;
            }

            logger.logDebug("ProgressTimeoutDetector: emitting no_progress signal (soft threshold)", {
              timeSinceProgressMs,
              timeout_seconds: config.timeout_seconds,
              hard_timeout_seconds: config.hard_timeout_seconds,
            });
            softEmitted = true;
            onFrictionSignal(signal);
            
            // If hard_timeout_seconds is configured and not yet reached, reschedule to check hard threshold
            if (hardTimeoutMs !== undefined && timeSinceProgressMs < hardTimeoutMs) {
              // Calculate remaining time until hard threshold
              const remainingMs = hardTimeoutMs - timeSinceProgressMs;
              // Reschedule with remaining time (or minimum 100ms to avoid tight loops)
              const nextTimeoutMs = Math.max(100, remainingMs);
              
              if (typeof window !== "undefined" && window.setTimeout) {
                timeoutId = window.setTimeout(timeoutCallback, nextTimeoutMs) as any;
              } else if (typeof global !== "undefined" && (global as any).setTimeout) {
                timeoutId = (global as any).setTimeout(timeoutCallback, nextTimeoutMs);
              }
            }
            // If no hard threshold configured, stop scheduling after soft emits
            return;
          }

          // Not yet at soft threshold: reschedule with full timeout
          if (typeof window !== "undefined" && window.setTimeout) {
            timeoutId = window.setTimeout(timeoutCallback, timeoutMs) as any;
          } else if (typeof global !== "undefined" && (global as any).setTimeout) {
            timeoutId = (global as any).setTimeout(timeoutCallback, timeoutMs);
          } else {
            logger.logError("ProgressTimeoutDetector: setTimeout not available");
          }
        }, logger, "ProgressTimeoutDetector.timeoutCallback");
      };

      // Initial timer setup
      if (typeof window !== "undefined" && window.setTimeout) {
        timeoutId = window.setTimeout(timeoutCallback, timeoutMs) as any;
      } else if (typeof global !== "undefined" && (global as any).setTimeout) {
        timeoutId = (global as any).setTimeout(timeoutCallback, timeoutMs);
      } else {
        logger.logError("ProgressTimeoutDetector: setTimeout not available");
      }
    }, logger, "ProgressTimeoutDetector.setTimeout");
  }

  /**
   * Reset episode (called on route change or progress event)
   * Resets emission flags and restarts timer
   */
  function resetEpisode(): void {
    softEmitted = false;
    hardEmitted = false;
    lastProgressAt = Date.now();
    clearTimeout();
    setTimeout(); // Restart timer cleanly
    logger.logDebug("ProgressTimeoutDetector: episode reset", {
      lastProgressAt,
    });
  }

  /**
   * Handle route change (called from entryPoint)
   * Resets episode when navigation occurs
   */
  function handleRouteChange(newPathname: string): void {
    safeTry(() => {
      if (currentPathname !== null && currentPathname !== newPathname) {
        // Route changed - reset episode
        logger.logDebug("ProgressTimeoutDetector: route change detected, resetting episode", {
          from: currentPathname,
          to: newPathname,
        });
        resetEpisode();
      }
      currentPathname = newPathname;
    }, logger, "ProgressTimeoutDetector.handleRouteChange");
  }

  /**
   * Handle captured event from EventPipeline
   */
  function onEvent(event: BaseEvent): void {
    safeTry(() => {
      // Only process product events
      if (event.kind !== "product") {
        return;
      }

      // Check if event name matches progress_event_names
      if (!progressEventNamesSet.has(event.name)) {
        return;
      }

      // Update lastProgressAt and reset episode
      lastProgressAt = event.timestamp || Date.now();
      // Reset emission flags for new no-progress episode
      softEmitted = false;
      hardEmitted = false;
      logger.logDebug("ProgressTimeoutDetector: progress event detected, resetting timer", {
        eventName: event.name,
        lastProgressAt,
      });

      // Reset timeout (restart timer cleanly)
      setTimeout();
    }, logger, "ProgressTimeoutDetector.onEvent");
  }

  /**
   * Destroy detector and clean up resources
   */
  function destroy(): void {
    safeTry(() => {
      logger.logDebug("ProgressTimeoutDetector: destroying");
      clearTimeout();
      // Reset emission flags
      softEmitted = false;
      hardEmitted = false;
    }, logger, "ProgressTimeoutDetector.destroy");
  }

  // Initialize: start timer from detector creation
  setTimeout();

  // Initialize current pathname if window is available
  if (typeof window !== "undefined" && window.location) {
    try {
      currentPathname = window.location.pathname;
    } catch {
      // Ignore errors accessing location
    }
  }

  const detector = {
    onEvent,
    destroy,
    handleRouteChange, // Expose for entryPoint to call directly
  };
  
  return detector;
}

