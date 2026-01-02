/**
 * Friction Types
 * 
 * Type definitions for friction detection.
 * 
 * @module types/friction
 */

/**
 * Friction type enumeration
 */
export type FrictionType = "stall" | "rageclick" | "backtrack" | "no_progress";

/**
 * Friction signal emitted by detectors
 * 
 * @property {FrictionType} type - Type of friction detected ("stall" | "rageclick" | "backtrack" | "no_progress")
 * @property {string} pageUrl - Current page URL where friction was detected
 * @property {string | null} selector - CSS selector of the element (if applicable)
 * @property {number} timestamp - Timestamp when friction was detected (milliseconds since epoch)
 * @property {string} [path] - Optional pathname extracted from pageUrl (backend will extract if not provided)
 * @property {string | null} [referrerPath] - Optional pathname from referrer URL (immediate previous page)
 * @property {string | null} [activationContext] - Optional activation context label (task/flow identifier) from app
 * @property {Record<string, any>} [extra] - Additional metadata. Standard semantic keys:
 *   - For `type: "rageclick"`: `target_id` (string) - Stable target identifier
 *   - For `type: "backtrack"`: `from_view` (string) - View identifier before navigation, `to_view` (string) - View identifier after navigation
 *   - For `type: "stall"`: `stall_ms` (number) - Stall duration in milliseconds
 *   - For `type: "no_progress"`: `trigger_kind` (string) - "progress_timeout", `timeout_seconds` (number), `hard_timeout_seconds` (number, optional), `last_progress_at_ms` (number), `time_since_progress_ms` (number)
 */
export interface FrictionSignal {
  type: FrictionType;
  pageUrl: string;
  selector: string | null;
  timestamp: number;
  path?: string; // Optional: pathname extracted from pageUrl
  referrerPath?: string | null; // Optional: pathname from referrer URL
  activationContext?: string | null; // Optional: activation context label from app
  extra?: Record<string, any>;
}

