/**
 * Reveal SDK
 * 
 * Main entry point for the Reveal SDK.
 * Provides the public API surface for host applications.
 * 
 * @module index
 */

// Import from entryPoint
import { init, track, onNudgeDecision, destroy, startIdleWatch, stopIdleWatch, markContextClosed, requestTrace, onTraceRequested } from './core/entryPoint';

// Re-export types
export * from './types';

// Re-export recording types (Phase 1 + Phase 2)
export type {
  TraceRequestContext,
  TraceRequestHandler,
  RecordingUploadOptions,
  RecordingUploadResult
} from './types/recording';

// Re-export recording upload helper (Phase 2)
export { uploadRecording } from './modules/recordingUpload';

// Re-export UI decision types and utilities (for React hooks and host apps)
export { mapWireToUI } from './types/uiDecision';
export type { 
  UINudgeDecision, 
  NudgeDecision, 
  NudgeTemplateId, 
  NudgeSeverity 
} from './types/uiDecision';

// Re-export React hooks (optional - requires React peer dependency)
export { useNudgeDecision } from './hooks/useNudgeDecision';
export type { UseNudgeDecisionResult } from './hooks/useNudgeDecision';

// Public API
export const Reveal = {
  init,
  track,
  onNudgeDecision,
  destroy,
  startIdleWatch,
  stopIdleWatch,
  markContextClosed,
  requestTrace,
  onTraceRequested,
};
