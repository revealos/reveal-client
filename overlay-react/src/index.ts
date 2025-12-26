// packages/overlay-react/src/index.ts

/**
 * Reveal Nudge UI - React adapter for @reveal/overlay-wc
 *
 * This package provides React components that wrap @reveal/overlay-wc Web Components.
 * ALL UI logic lives in @reveal/overlay-wc - this package only provides React-friendly adapters.
 */

// Main host component
export { OverlayManager } from "./components/OverlayManager";
export type { OverlayManagerProps } from "./components/OverlayManager";

// Template components
export { TooltipNudge } from "./components/templates/TooltipNudge";
export type { TooltipNudgeProps } from "./components/templates/TooltipNudge";
export { InlineHint } from "./components/templates/InlineHint";
export type { InlineHintProps } from "./components/templates/InlineHint";
export { Spotlight } from "./components/templates/Spotlight";
export type { SpotlightProps } from "./components/templates/Spotlight";

// Re-export types from overlay-wc (source of truth)
export type { NudgeDecision, NudgeQuadrant, NudgeTemplateId } from "@reveal/overlay-wc";

// Re-export legacy types for backward compatibility
export type { WireNudgeDecision, UINudgeDecision } from "./types/NudgeDecision";
export { mapWireToUI } from "./types/NudgeDecision";
