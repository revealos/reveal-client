/**
 * Type definitions for nudge decisions
 *
 * These types define the contract between the backend and overlay components.
 */

export type NudgeTemplateId = "tooltip" | "modal" | "banner" | "spotlight" | "inline_hint";

export type NudgeQuadrant =
  | "topLeft"
  | "topCenter"
  | "topRight"
  | "bottomLeft"
  | "bottomCenter"
  | "bottomRight";

/**
 * Nudge decision object passed to Web Components
 */
export interface NudgeDecision {
  /**
   * Unique identifier for this nudge instance
   */
  nudgeId: string;

  /**
   * Template to render ("tooltip" is currently the only implemented template)
   */
  templateId: NudgeTemplateId;

  /**
   * Nudge title (optional)
   */
  title?: string;

  /**
   * Nudge body text (required for most templates)
   */
  body?: string;

  /**
   * Call-to-action button text (optional)
   */
  ctaText?: string;

  /**
   * CSS selector for target element (used by spotlight template)
   */
  selectorPattern?: string;

  /**
   * Viewport quadrant for positioning (defaults to "topCenter")
   */
  quadrant?: NudgeQuadrant;

  /**
   * Debug code for support (displayed in bottom-right corner)
   */
  debugCode?: string;

  /**
   * Whether the nudge can be dismissed by the user (defaults to true)
   */
  dismissible?: boolean;

  /**
   * Auto-dismiss timeout in milliseconds (null = no auto-dismiss)
   */
  autoDismissMs?: number | null;
}
