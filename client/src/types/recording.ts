/**
 * Types for trace request and recording functionality
 */

/**
 * Context provided to trace request handlers
 *
 * Contains sanitized trace request data with primitives-only metadata.
 */
export interface TraceRequestContext {
  /** UUID generated for this trace request */
  traceId: string;

  /** Sanitized reason (max 64 chars) or null */
  reason: string | null;

  /** Sanitized metadata (primitives only, max 2KB) */
  meta: Record<string, string | number | boolean | null>;

  /** Current session ID */
  sessionId: string;

  /** Anonymous user ID */
  anonymousId: string;

  /** Project ID */
  projectId: string;
}

/**
 * Handler function for trace requests
 *
 * Subscribe via `Reveal.onTraceRequested(handler)` to receive notifications
 * when `Reveal.requestTrace()` is called.
 *
 * @example
 * ```typescript
 * const unsubscribe = Reveal.onTraceRequested(async (context) => {
 *   // Start your session recorder (rrweb, LogRocket, etc.)
 *   console.log('Trace requested:', context.traceId);
 *   console.log('Reason:', context.reason);
 *   console.log('Meta:', context.meta);
 * });
 *
 * // Later: unsubscribe
 * unsubscribe();
 * ```
 */
export type TraceRequestHandler = (
  context: TraceRequestContext
) => void | Promise<void>;

/**
 * Options for uploading a session recording (Phase 2)
 */
export interface RecordingUploadOptions {
  /** Project ID */
  projectId: string;

  /** Session ID */
  sessionId: string;

  /** Trace ID from Reveal.requestTrace() */
  traceId: string;

  /** Recording blob (rrweb events, video, etc.) */
  blob: Blob;

  /** Human-readable reason (max 64 chars) */
  reason?: string;

  /** Primitives-only metadata (max 2KB) */
  meta?: Record<string, string | number | boolean | null>;

  /** API base URL (e.g., https://api.revealos.com) */
  apiBaseUrl: string;

  /** Client API key */
  clientKey: string;
}

/**
 * Result of recording upload
 */
export interface RecordingUploadResult {
  /** Whether upload succeeded */
  success: boolean;

  /** Recording ID if successful */
  recordingId?: string;

  /** Error message if failed */
  error?: string;
}
