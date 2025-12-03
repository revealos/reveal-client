/**
 * Reveal SDK
 * 
 * Main entry point for the Reveal SDK.
 * Provides the public API surface for host applications.
 * 
 * @module index
 */

// TODO: Import from entryPoint
// import { init, track, onNudgeDecision, destroy } from './core/entryPoint';

// TODO: Re-export types
// export * from './types';

// TODO: Public API
// export const Reveal = {
//   init,
//   track,
//   onNudgeDecision,
//   destroy,
// };

// Placeholder exports (will be replaced with real implementation)
export type EventKind = "product" | "friction" | "nudge" | "session";
export type Environment = "production" | "staging" | "development";
export type FrictionType = "stall" | "rageclick" | "backtrack";

export interface FrictionSignal {
  type: FrictionType;
  pageUrl: string;
  selector: string | null;
  timestamp: number;
  extra?: Record<string, any>;
}

export interface WireNudgeDecision {
  nudgeId: string;
  templateId: "tooltip" | "modal" | "banner" | "spotlight" | "inline_hint";
  title?: string;
  body?: string;
  ctaText?: string;
  slotId?: string;
  frictionType?: FrictionType;
  expiresAt?: string;
  extra?: Record<string, string | number | boolean | null>;
}

export type NudgeDecision = WireNudgeDecision;

// Placeholder Reveal API (will be replaced with real implementation)
export const Reveal = {
  init(clientKey: string, options?: Record<string, any>) {
    // TODO: Replace with real implementation
    console.log("[Reveal SDK] init - placeholder", { clientKey, options });
  },
  track(kind: EventKind, type: string, properties?: Record<string, any>) {
    // TODO: Replace with real implementation
    console.log("[Reveal SDK] track - placeholder", { kind, type, properties });
  },
  onNudgeDecision(handler: (decision: NudgeDecision) => void) {
    // TODO: Replace with real implementation
    console.warn("[Reveal SDK] onNudgeDecision - placeholder");
    return () => {};
  }
};
