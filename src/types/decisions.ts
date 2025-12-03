/**
 * Decision Types
 * 
 * Type definitions for nudge decisions.
 * 
 * @module types/decisions
 */

/**
 * Template ID enumeration
 */
export type TemplateId =
  | "tooltip"
  | "modal"
  | "banner"
  | "spotlight"
  | "inline_hint";

/**
 * Wire-level NudgeDecision (canonical shape between engine and SDK)
 */
export interface WireNudgeDecision {
  nudgeId: string;
  templateId: TemplateId;
  title?: string;
  body?: string;
  ctaText?: string;
  slotId?: string;
  frictionType?: "stall" | "rageclick" | "backtrack";
  expiresAt?: string; // ISO string
  extra?: Record<string, string | number | boolean | null>;
}

/**
 * SDK NudgeDecision type (alias for WireNudgeDecision)
 */
export type NudgeDecision = WireNudgeDecision;

