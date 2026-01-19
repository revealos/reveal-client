/**
 * Config Types
 * 
 * Type definitions for configuration.
 * 
 * @module types/config
 */

/**
 * Client-safe configuration from backend
 */
export interface ClientConfig {
  configVersion?: number; // Default: 1 (for schema evolution)
  projectId: string;
  environment: "production" | "staging" | "development";
  sdk: {
    samplingRate: number;
  };
  decision: {
    endpoint: string;
    timeoutMs: number;
  };

  // Feature flags for granular control
  features?: {
    enabled?: boolean; // Global kill switch (default: true)
    detectors?: {
      stall?: boolean; // Default: true
      rageclick?: boolean; // Default: true
      backtrack?: boolean; // Default: true
      no_progress?: boolean; // Default: true (also requires progress_timeout_rules.enabled)
    };
    nudges?: {
      tooltip?: boolean; // Default: true
      inline_hint?: boolean; // Default: true
      spotlight?: boolean; // Default: true
      modal?: boolean; // Default: true
      banner?: boolean; // Default: true
    };
    recording?: {
      enabled?: boolean; // Default: false (BYOR trace request hooks - Phase 1)
      uploadEnabled?: boolean; // Reserved for future use (not currently checked - uploadRecording() always available when enabled=true)
    };
  };

  // Treatment rules for A/B testing (optional, backward compatible)
  treatment_rules?: {
    sticky?: boolean; // Default: true (use anonymousId for bucketing)
    treatment_percentage?: number; // Default: 0 (0-100, percent in treatment group)
  };

  // Progress timeout rules for no_progress detector (optional, default: disabled)
  progress_timeout_rules?: {
    enabled: boolean;
    timeout_seconds: number;
    hard_timeout_seconds?: number;
    progress_event_names: string[];
  };

  /**
   * Templates array - always empty in client config.
   * Templates are backend-only and decisioning happens server-side.
   * The SDK validates this field exists but does not use it for filtering.
   */
  templates: any[];
  ttlSeconds: number;
}

/**
 * Current config version supported by this SDK
 */
export const CURRENT_CONFIG_VERSION = 1;

/**
 * Safe defaults for feature flags (if config.features missing)
 */
export const DEFAULT_FEATURES = {
  enabled: true,
  detectors: { stall: true, rageclick: true, backtrack: true, no_progress: true },
  nudges: { tooltip: true, inline_hint: true, spotlight: true, modal: true, banner: true },
  recording: { enabled: false, uploadEnabled: false },
};

