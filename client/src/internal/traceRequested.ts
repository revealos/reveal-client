/**
 * Internal Trace Request Module
 *
 * Shared notification system for trace requests.
 * Used by both Reveal.requestTrace() (manual) and DecisionClient (backend-driven).
 *
 * This module avoids circular dependencies between entryPoint and decisionClient.
 */

import type { TraceRequestContext, TraceRequestHandler } from '../types/recording';

/**
 * Subscriber list (shared state)
 */
let traceSubscribers: TraceRequestHandler[] = [];

/**
 * EventPipeline reference (set once from entryPoint)
 */
let eventPipeline: any | null = null;

/**
 * Set EventPipeline reference (called once from entryPoint during init)
 */
export function setTraceEventPipeline(pipeline: any): void {
  eventPipeline = pipeline;
}

/**
 * Emit trace requested notification to all subscribers
 *
 * Called by:
 * - Reveal.requestTrace() (manual dev override)
 * - DecisionClient (backend-driven shouldTrace)
 */
export function emitTraceRequested(context: TraceRequestContext): void {
  // Emit event to EventPipeline if available
  if (eventPipeline && typeof eventPipeline.captureEvent === 'function') {
    try {
      eventPipeline.captureEvent(
        'session',
        'trace_requested',
        {
          trace_id: context.traceId,
          reason: context.reason,
          ...context.meta,
        },
        false
      );
    } catch (error) {
      // EventPipeline errors shouldn't crash SDK
      console.error('[Reveal] EventPipeline.captureEvent error:', error);
    }
  }

  // Notify all subscribers
  for (const handler of traceSubscribers) {
    try {
      handler(context);
    } catch (error) {
      // Subscriber errors shouldn't crash SDK
      console.error('[Reveal] onTraceRequested handler error:', error);
    }
  }
}

/**
 * Subscribe to trace requested events
 *
 * @param handler - Callback function
 * @returns Unsubscribe function
 */
export function onTraceRequested(handler: TraceRequestHandler): () => void {
  traceSubscribers.push(handler);

  return () => {
    traceSubscribers = traceSubscribers.filter(h => h !== handler);
  };
}

/**
 * Reset subscribers (for testing)
 * @internal
 */
export function __TEST_ONLY__resetTraceSubscribers(): void {
  traceSubscribers = [];
  eventPipeline = null;
}
