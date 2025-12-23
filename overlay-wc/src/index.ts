/**
 * @reveal/overlay-wc
 *
 * Framework-agnostic Web Components for Reveal nudge overlays.
 *
 * This package is the source of truth for all nudge UI logic, styling,
 * positioning, and animations.
 */

// Components (auto-register when imported)
export { RevealOverlayManager } from "./components/reveal-overlay-manager";
export { RevealTooltipNudge } from "./components/reveal-tooltip-nudge";

// Types
export type { NudgeDecision, NudgeQuadrant, NudgeTemplateId } from "./types/nudge-decision";

// Utilities
export { computeQuadrantPosition } from "./utils/position";
export type { QuadrantPosition } from "./utils/position";
export { TEMPLATE_IDS, QUADRANTS } from "./utils/constants";
