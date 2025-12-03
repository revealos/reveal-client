/**
 * Event Types
 * 
 * Type definitions for events in the SDK.
 * 
 * @module types/events
 */

/**
 * Event kind enumeration
 */
export type EventKind = "product" | "friction" | "nudge" | "session";

/**
 * Environment enumeration
 */
export type Environment = "production" | "staging" | "development";

/**
 * Event source enumeration
 */
export type EventSource = "system" | "user";

/**
 * Base event structure (SDK internal)
 */
export interface BaseEvent {
  kind: EventKind;
  name: string;
  event_source: EventSource;
  session_id: string;
  is_treatment: boolean | null;
  timestamp: number;
  path: string | null;
  route: string | null;
  screen: string | null;
  user_agent: string;
  viewport_width: number;
  viewport_height: number;
  payload: Record<string, any>;
}

