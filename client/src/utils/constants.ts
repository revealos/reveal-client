/**
 * Constants
 * 
 * Shared constants used across the SDK.
 * 
 * @module utils/constants
 */

/**
 * Default configuration values
 */
export const DEFAULTS = {
  // Timeouts
  // Note: Decision timeout is environment-aware (400ms production, 2000ms development)
  // This constant is a fallback; actual default is set in entryPoint.ts based on environment
  DECISION_TIMEOUT_MS: 400, // Production default (development uses 2000ms)
  TRANSPORT_TIMEOUT_MS: 10000,
  
  // Intervals
  MAX_FLUSH_INTERVAL_MS: 5000,
  
  // Sizes
  MAX_BUFFER_SIZE: 1000,
  EVENT_BATCH_SIZE: 20,
  
  // Retries
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
} as const;

/**
 * Event kind constants
 */
export const EVENT_KINDS = {
  PRODUCT: "product",
  FRICTION: "friction",
  NUDGE: "nudge",
  SESSION: "session",
} as const;

/**
 * Template ID constants
 */
export const TEMPLATE_IDS = {
  TOOLTIP: "tooltip",
  MODAL: "modal",
  BANNER: "banner",
  SPOTLIGHT: "spotlight",
  INLINE_HINT: "inline_hint",
} as const;

