/**
 * EntryPoint Module
 * 
 * The main orchestration layer for the Reveal SDK.
 * Wires together all SDK modules (ConfigClient, SessionManager, EventPipeline, etc.)
 * and provides the public API surface (Reveal.init, Reveal.track, Reveal.onNudgeDecision).
 * 
 * Responsibilities:
 * - Initialize and coordinate all SDK modules
 * - Handle global error handling and teardown
 * - Manage SDK lifecycle (initialized, disabled states)
 * - Provide stable public API to host applications
 * 
 * @module core/entryPoint
 */

import { createLogger, type Logger } from "../utils/logger";
import { safeTry, safeTryAsync } from "../utils/safe";
import { createDetectorManager, type DetectorManager } from "../modules/detectorManager";
import { createProgressTimeoutDetector, type ProgressTimeoutDetector } from "../detectors/progressTimeoutDetector";
import { createSessionManager, type SessionManager } from "../modules/sessionManager";
import { createDecisionClient, type DecisionClient } from "../modules/decisionClient";
import { createTransport, type Transport } from "../modules/transport";
import { createEventPipeline, type EventPipeline } from "../modules/eventPipeline";
import { createConfigClient, type ConfigClient } from "../modules/configClient";
import { setAuditLogger } from "../security/auditLogger";
import { setErrorLogger } from "../errors/errorHandler";
import { validateAllBackendUrls, validateHttpsUrl } from "../security/inputValidation";
import { getOrCreateAnonymousId } from "../utils/anonymousId";
import { getTabState, incrementSeq } from "../utils/tabState";
import { transformBaseEventToBackendFormat, type PageContext } from "../modules/eventTransformer";
import type { BaseEvent } from "../types/events";
import type { FrictionSignal } from "../types/friction";
import type { ClientConfig } from "../types/config";
import { DEFAULT_FEATURES } from "../types/config";
import type { WireNudgeDecision } from "../types/decisions";
import type { EventKind, EventPayload } from "../types/events";
import { storePendingTraceId } from "../internal/traceCorrelation";
import { sanitizeReason, sanitizeMeta } from "../utils/sanitize";
import type { TraceRequestContext } from "../types/recording";
import {
  emitTraceRequested,
  setTraceEventPipeline,
  onTraceRequested as onTraceRequestedInternal
} from "../internal/traceRequested";

// ──────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────────────────────────────

/**
 * Compute sampling decision based on anonymousId and samplingRate
 * Uses same hash algorithm as backend bucketing for consistency
 * @param anonymousId - User identifier
 * @param samplingRate - Sampling rate (0.0 to 1.0)
 * @returns true if user is sampled in, false otherwise
 */
function computeSamplingDecision(anonymousId: string, samplingRate: number): boolean {
  if (samplingRate >= 1.0) return true;
  if (samplingRate <= 0.0) return false;

  // Hash anonymousId (same algorithm as backend bucketing)
  let hash = 0;
  for (let i = 0; i < anonymousId.length; i++) {
    const char = anonymousId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const bucket = Math.abs(hash) % 100;
  return bucket < samplingRate * 100;
}

/**
 * Compute treatment assignment from config rules
 * Uses same hash-mod-100 bucketing algorithm as sampling
 * @param params - anonymousId, sessionId, rules
 * @returns "control" | "treatment" | null
 */
function computeTreatmentFromRules(params: {
  anonymousId: string;
  sessionId: string;
  rules?: { sticky?: boolean; treatment_percentage?: number };
}): "control" | "treatment" | null {
  const { anonymousId, sessionId, rules } = params;

  // No rules => no treatment assignment
  if (!rules) return null;

  const treatmentPercentage = rules.treatment_percentage ?? 0;
  const sticky = rules.sticky ?? true;

  // All control
  if (treatmentPercentage <= 0) return "control";

  // All treatment
  if (treatmentPercentage >= 100) return "treatment";

  // Probabilistic bucketing (same algorithm as computeSamplingDecision)
  const bucketKey = sticky ? anonymousId : sessionId;

  // Hash-mod-100 algorithm
  let hash = 0;
  for (let i = 0; i < bucketKey.length; i++) {
    const char = bucketKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const bucket = Math.abs(hash) % 100;

  return bucket < treatmentPercentage ? "treatment" : "control";
}

/**
 * Check if a template is enabled in the config
 * @param templateId - Template identifier
 * @param config - Client configuration
 * @returns true if template is enabled, false otherwise
 */
function isTemplateEnabled(templateId: string, config: ClientConfig): boolean {
  const features = config.features || DEFAULT_FEATURES;
  const nudgeFlags = features.nudges || DEFAULT_FEATURES.nudges;
  const enabled = nudgeFlags[templateId as keyof typeof nudgeFlags];
  return enabled ?? true; // Default enabled
}

// Global singleton state (closure scope, not exposed)
let isInitialized = false;
let isDisabled = false;

// Internal module references (held in closure)
let configClient: any = null;
let sessionManager: SessionManager | null = null;
let eventPipeline: EventPipeline | null = null;
let transport: Transport | null = null;
let detectorManager: DetectorManager | null = null;
let decisionClient: DecisionClient | null = null;
let progressTimeoutDetector: ProgressTimeoutDetector | null = null;
let logger: Logger | null = null;

// Merged final config (includes init options.features merged with backend config)
let mergedConfig: ClientConfig | null = null;

// Nudge decision subscribers (host app callbacks)
let nudgeSubscribers: Array<(decision: WireNudgeDecision) => void> = [];

// Track last decision ID for deduplication
let lastDecisionId: string | null = null;

// Track if a nudge is currently active/visible (prevents multiple nudges)
let isNudgeActive = false;

// Track cooldown period after nudge dismissal (prevents immediate re-triggering)
// Cooldown duration: 2 seconds (gives backend time to process dismissal event)
const NUDGE_DISMISSAL_COOLDOWN_MS = 2000;
let nudgeDismissalCooldownUntil: number | null = null;

// Track sampling decision (persistent across page reloads via localStorage)
let sampledIn: boolean = true; // Default: true (no sampling)

/**
 * Initialize the Reveal SDK
 * 
 * @param clientKey - Client authentication key
 * @param options - Configuration options
 * @returns Promise that resolves when initialization is complete
 */
export async function init(
  clientKey: string,
  options: Record<string, any> = {}
): Promise<void> {
  // GUARD: Prevent double-initialization
  if (isInitialized) {
    logger?.logDebug("Reveal.init() called again; ignoring.");
    return;
  }
  if (isDisabled) {
    logger?.logDebug("Reveal SDK is disabled due to previous fatal error.");
    return;
  }

  // VALIDATION: clientKey is required
  if (!clientKey || typeof clientKey !== "string") {
    console.error("[Reveal SDK] clientKey is required and must be a string.");
    isDisabled = true;
    return;
  }

  // SETUP: Extract options
  const debugMode = options.debug === true;

  // Enable global debug flag for modules without direct access to options
  if (debugMode && typeof window !== "undefined") {
    (window as any).__REVEAL_DEBUG__ = true;
  }

  // INITIALIZE: Logger (must be first for error handling)
  logger = createLogger({ debug: debugMode });
  
  // Store logger reference for safeTry (TypeScript narrowing)
  // createLogger always returns a Logger, so this is safe
  const loggerRef: Logger = logger;

  // SECURITY: Wire logger into audit and error handling modules
  setAuditLogger(loggerRef);
  setErrorLogger(loggerRef);

  // ──────────────────────────────────────────────────────────────────────
  // SECURITY: Validate apiBase first (if provided) before using it to construct URLs
  // This happens synchronously before marking as initialized
  // ──────────────────────────────────────────────────────────────────────
  if (options.apiBase && typeof options.apiBase === "string") {
    const apiBaseValidation = validateHttpsUrl(options.apiBase);
    if (!apiBaseValidation.valid) {
      const errorMessage = `[Reveal SDK] SECURITY: Backend URLs must use HTTPS. API base URL ${apiBaseValidation.error}`;
      loggerRef.logError(errorMessage);
      console.error(errorMessage);
      isDisabled = true;
      isInitialized = false; // Allow retry if desired
      return; // Exit early, no modules initialized
    }
  }

  // Mark as initialized after initial validation passes
  isInitialized = true;

  // ORCHESTRATE: Async initialization flow
  safeTryAsync(async () => {
    // Generate unique trace ID for this init call to detect duplicate instances
    const initTraceId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `init-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    loggerRef.logDebug("Reveal SDK initializing.", { initTraceId });

    // ──────────────────────────────────────────────────────────────────────
    // RESOLVE INGEST ENDPOINT
    // ──────────────────────────────────────────────────────────────────────
    // Support both ingestEndpoint (explicit) and endpoint (backward compat)
    // Also support apiBase + "/ingest" pattern
    let ingestEndpoint: string;
    if (options.ingestEndpoint && typeof options.ingestEndpoint === "string") {
      ingestEndpoint = options.ingestEndpoint;
    } else if (options.endpoint && typeof options.endpoint === "string") {
      // Backward compatibility: if endpoint provided, use it (harness uses this)
      ingestEndpoint = options.endpoint;
      loggerRef.logWarn(
        "Using 'endpoint' option is deprecated, use 'ingestEndpoint' instead"
      );
    } else if (options.apiBase && typeof options.apiBase === "string") {
      ingestEndpoint = `${options.apiBase}/ingest`;
    } else {
      ingestEndpoint = "https://api.revealos.com/ingest";
    }
    loggerRef.logDebug("Resolved ingest endpoint", { ingestEndpoint });

    // ──────────────────────────────────────────────────────────────────────
    // RESOLVE CONFIG ENDPOINT
    // ──────────────────────────────────────────────────────────────────────
    let configEndpoint: string;
    if (options.configEndpoint && typeof options.configEndpoint === "string") {
      configEndpoint = options.configEndpoint;
    } else if (options.apiBase && typeof options.apiBase === "string") {
      configEndpoint = `${options.apiBase}/config`;
    } else {
      configEndpoint = "https://api.revealos.com/config";
    }
    loggerRef.logDebug("Resolved config endpoint", { configEndpoint });

    // ──────────────────────────────────────────────────────────────────────
    // FETCH CONFIG FROM BACKEND (with fallback to minimalConfig)
    // ──────────────────────────────────────────────────────────────────────
    const environment = (options.environment as "production" | "staging" | "development") || "development";
    
    // Environment-aware timeout defaults:
    // - Production: 400ms (realistic for network + backend processing)
    // - Development: 2000ms (allows for CORS preflight + logging overhead)
    const defaultDecisionTimeout = environment === "production" ? 400 : 2000;
    
    // Fallback minimal config (used if backend fetch fails)
    const minimalConfig: ClientConfig = {
      projectId: clientKey, // Temporary: use clientKey as projectId
      environment,
      sdk: {
        samplingRate: 1.0,
      },
      decision: {
        endpoint: options.decisionEndpoint || `${options.apiBase || "https://api.revealos.com"}/decide`,
        timeoutMs: options.decisionTimeoutMs || defaultDecisionTimeout,
      },
      templates: [],
      ttlSeconds: 3600,
    };

    // Try to fetch config from backend
    let clientConfig: ClientConfig | null = null;
    try {
      // Validate config endpoint URL for HTTPS (with localhost exception)
      const configUrlValidation = validateHttpsUrl(configEndpoint);
      if (configUrlValidation.valid) {
        loggerRef.logDebug("Creating ConfigClient", { endpoint: configEndpoint, environment });
        
        // Create ConfigClient instance
        configClient = createConfigClient({
          endpoint: configEndpoint,
          clientKey: clientKey,
          environment: environment,
          fetchFn: typeof fetch !== "undefined" ? fetch : undefined,
          logger: loggerRef,
          timeoutMs: 5000,
        });

        loggerRef.logDebug("Fetching config from backend...", { initTraceId, endpoint: configEndpoint });

        // Fetch config from backend
        clientConfig = await configClient.getConfig();

        // TRACE: Log exact config fetch result
        const fetchSuccess = clientConfig !== null;
        const rawClientConfigKeys = clientConfig ? Object.keys(clientConfig) : [];
        loggerRef.logDebug("Config fetch result", {
          initTraceId,
          fetchSuccess,
          rawClientConfigKeys,
          hasRawTreatmentRules: clientConfig?.treatment_rules !== undefined,
          rawTreatmentRules: clientConfig?.treatment_rules,
        });

        if (clientConfig) {
          loggerRef.logDebug("Config fetched from backend", { initTraceId, projectId: clientConfig.projectId, environment: clientConfig.environment });
          console.log("[Reveal SDK] ✓ Config fetched from backend:", clientConfig);
        } else {
          loggerRef.logWarn("Failed to fetch config from backend, using fallback minimalConfig", { initTraceId });
          console.warn("[Reveal SDK] ⚠ Failed to fetch config from backend, using fallback minimalConfig");
        }
      } else {
        loggerRef.logWarn("Config endpoint URL validation failed, using fallback minimalConfig", { initTraceId, error: configUrlValidation.error });
        console.warn("[Reveal SDK] ⚠ Config endpoint URL validation failed:", configUrlValidation.error);
      }
    } catch (error: any) {
      loggerRef.logWarn("Error during config fetch, using fallback minimalConfig", { initTraceId, error: error?.message || String(error) });
      console.error("[Reveal SDK] ✗ Error during config fetch:", error?.message || String(error));
      // Continue with minimalConfig fallback
    }

    // Use fetched config or fallback to minimalConfig
    const baseConfig: ClientConfig = clientConfig || minimalConfig;
    const usingFallback = clientConfig === null;

    // Merge features from init options (local overrides remote)
    // This ensures SDK features (like recording) can be enabled locally without backend changes
    const finalConfig: ClientConfig = {
      ...baseConfig,
      features: options.features || baseConfig.features,
    };

    // Store merged config in closure for requestTrace() to access
    mergedConfig = finalConfig;

    // TRACE: Verify treatment_rules survived config validation
    loggerRef.logDebug("Config fetched and merged", {
      initTraceId,
      usingFallback,
      finalConfigKeys: Object.keys(finalConfig),
      hasTreatmentRules: finalConfig.treatment_rules !== undefined,
      treatmentRules: finalConfig.treatment_rules,
      hasFeatures: finalConfig.features !== undefined,
      featuresRecording: finalConfig.features?.recording,
      projectId: finalConfig.projectId,
      clientKey,
      decisionEndpoint: finalConfig.decision?.endpoint,
      samplingRate: finalConfig.sdk?.samplingRate,
    });

    // WARN if using fallback and treatment assignment cannot run
    if (usingFallback && !finalConfig.treatment_rules) {
      loggerRef.logWarn("Using minimalConfig fallback without treatment_rules, treatment assignment will NOT run at init", {
        initTraceId,
        reason: clientConfig === null ? "config fetch failed" : "unknown",
      });
    }

    // ──────────────────────────────────────────────────────────────────────
    // STEP: Initialize anonymousId (persistent user identifier)
    // Must be defined before computing sampling decision
    // ──────────────────────────────────────────────────────────────────────
    const anonymousId = getOrCreateAnonymousId();

    // ──────────────────────────────────────────────────────────────────────
    // COMPUTE SAMPLING DECISION (persistent across page reloads via localStorage)
    // ──────────────────────────────────────────────────────────────────────
    // SAFETY: Wrap sampling logic in safeTry - if fails, default to sampledIn = true (fail open)
    const samplingResult = safeTry<boolean>(() => {
      const samplingStorageKey = `reveal_sampled_in_${finalConfig.projectId}_${anonymousId}`;
      let storedSampling: string | null = null;

      // Best-effort localStorage read
      try {
        storedSampling = typeof localStorage !== "undefined" ? localStorage.getItem(samplingStorageKey) : null;
      } catch {
        // Ignore localStorage read errors
      }

      let computed: boolean;
      if (storedSampling !== null) {
        computed = storedSampling === "true";
        loggerRef.logDebug("Sampling decision loaded from storage", { sampledIn: computed, samplingRate: finalConfig.sdk.samplingRate });
      } else {
        computed = computeSamplingDecision(anonymousId, finalConfig.sdk.samplingRate);

        // Best-effort localStorage write
        if (typeof localStorage !== "undefined") {
          try {
            localStorage.setItem(samplingStorageKey, String(computed));
            loggerRef.logDebug("Sampling decision computed and persisted", { sampledIn: computed, samplingRate: finalConfig.sdk.samplingRate });
          } catch (error) {
            loggerRef.logWarn("Failed to persist sampling decision to localStorage", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // DEBUG: Log sampling decision computation result
      loggerRef.logDebug("Sampling decision computed", {
        initTraceId,
        projectId: finalConfig.projectId,
        anonymousId,
        samplingRate: finalConfig.sdk.samplingRate,
        sampledIn: computed,
        samplingStorageKey,
        storedSampling,
      });

      return computed;
    }, loggerRef, "Sampling decision") as boolean | undefined;

    // If SafeTry failed, default to sampledIn = true (fail open - allow events)
    sampledIn = samplingResult ?? true;

    // ──────────────────────────────────────────────────────────────────────
    // RESOLVE RELATIVE DECISION ENDPOINT TO FULL URL
    // ──────────────────────────────────────────────────────────────────────
    // Backend may return relative paths (e.g., "/decide"), so we need to resolve them
    let resolvedDecisionEndpoint = finalConfig.decision.endpoint;
    
    // If decision endpoint is relative (starts with /), resolve it using apiBase or configEndpoint base
    if (resolvedDecisionEndpoint.startsWith("/")) {
      // Use apiBase if available, otherwise derive from configEndpoint
      const baseUrl = options.apiBase || (configEndpoint ? configEndpoint.replace(/\/config.*$/, "") : "https://api.revealos.com");
      resolvedDecisionEndpoint = `${baseUrl}${resolvedDecisionEndpoint}`;
    }

    // ──────────────────────────────────────────────────────────────────────
    // SECURITY: Validate all backend URLs are HTTPS (localhost exception)
    // ──────────────────────────────────────────────────────────────────────
    // Validate ingest and decision endpoints (apiBase already validated above)
    const urlValidation = validateAllBackendUrls({
      ingestEndpoint,
      decisionEndpoint: resolvedDecisionEndpoint,
      // apiBase already validated above, don't validate again
    });

    if (!urlValidation.valid) {
      const errorMessage = `[Reveal SDK] SECURITY: Backend URLs must use HTTPS. ${urlValidation.error}`;
      loggerRef.logError(errorMessage);
      console.error(errorMessage);
      isDisabled = true;
      isInitialized = false; // Allow retry if desired
      return; // Exit early, no modules initialized
    }

    // STEP 6: DetectorManager – friction detection
    // Friction signals may include semantic IDs in extra:
    // - For "stall": stall_ms (number) - stall duration in milliseconds
    // - For "rageclick": target_id (string) - stable target identifier
    // - For "backtrack": from_view (string), to_view (string) - view identifiers
    function onFrictionSignal(rawSignal: FrictionSignal) {
      safeTry(async () => {
        if (!eventPipeline || !sessionManager) {
          // For now, just log the signal
          logger?.logDebug("Friction signal received", rawSignal);
          console.log("[Reveal SDK] Friction signal:", rawSignal);
          return;
        }

        const now = Date.now();
        
        // Extract path from pageUrl if not provided
        const extractPathFromUrl = (url: string): string => {
          try {
            const urlObj = new URL(url);
            return urlObj.pathname;
          } catch {
            // Fallback: try simple string extraction
            const match = url.match(/\/\/[^\/]+(\/.*)?$/);
            return match && match[1] ? match[1] : "/";
          }
        };
        
        // Extract referrerPath from document.referrer if available
        const getReferrerPath = (): string | null => {
          if (typeof document === "undefined") return null;
          const referrer = document.referrer;
          if (!referrer) return null;
          try {
            const urlObj = new URL(referrer);
            return urlObj.pathname;
          } catch {
            return null;
          }
        };
        
        const frictionSignal: FrictionSignal = {
          type: rawSignal.type,
          pageUrl: rawSignal.pageUrl,
          selector: rawSignal.selector ?? null,
          timestamp: rawSignal.timestamp || now,
          path: rawSignal.path || extractPathFromUrl(rawSignal.pageUrl),
          referrerPath: rawSignal.referrerPath !== undefined ? rawSignal.referrerPath : getReferrerPath(),
          activationContext: rawSignal.activationContext || null, // Optional, can be null
          extra: rawSignal.extra || {},
        };

        logger?.logDebug("Friction signal received", frictionSignal);

        // DEBUG PROBE 1: Log friction signal processing
        if (debugMode) {
          console.log("[REVEAL_DEBUG] Friction signal processing:", {
            type: frictionSignal.type,
            pageUrl: frictionSignal.pageUrl,
            selector: frictionSignal.selector,
            hasExtraKeys: Object.keys(frictionSignal.extra || {}).length,
            willTrackEventPipeline: true,
            willCallDecision: !isNudgeActive && (!nudgeDismissalCooldownUntil || now >= nudgeDismissalCooldownUntil),
          });
        }

        // Emit friction event to pipeline
        // CRITICAL: flushImmediately=true ensures friction events are sent before nudge events
        // This preserves causality: friction → decision → nudge
        // Capture event_id for linking decision to friction event
        const frictionEventId = eventPipeline.captureEvent(
          "friction",
          `friction_${frictionSignal.type}`,
          {
            page_url: frictionSignal.pageUrl,
            selector: frictionSignal.selector,
            ...frictionSignal.extra,
            type: frictionSignal.type, // Set type AFTER spread to ensure it's not overwritten
          },
          true // flushImmediately: ensure friction events are sent before nudge events
        );

        // DEBUG PROBE 1b: Log event ID captured
        if (debugMode) {
          console.log("[REVEAL_DEBUG] Friction event captured:", {
            frictionEventId,
            type: frictionSignal.type,
          });
        }

        // Mark activity for session idle handling
        if (sessionManager.markActivity) {
          sessionManager.markActivity();
        }

        // Request decision from backend (only if no nudge is currently active and cooldown has passed)
        // This prevents multiple nudges from appearing when user interacts while a nudge is visible
        const isInCooldown = nudgeDismissalCooldownUntil !== null && now < nudgeDismissalCooldownUntil;
        
        if (isNudgeActive || isInCooldown) {
          logger?.logDebug("Skipping decision request - nudge already active or in cooldown", {
            frictionType: frictionSignal.type,
            isNudgeActive,
            isInCooldown,
            cooldownRemainingMs: isInCooldown ? nudgeDismissalCooldownUntil! - now : 0,
          });
          return;
        }

        const currentSession = sessionManager.getCurrentSession();
        if (currentSession && decisionClient) {
          const decision = await decisionClient.requestDecision(frictionSignal, {
            projectId: finalConfig.projectId,
            sessionId: currentSession.id,
            anonymousId: anonymousId, // Persistent user identifier for treatment assignment
            isNudgeActive, // Send state to backend for monitoring
            frictionEventId: frictionEventId ?? undefined, // Link decision to friction event (convert null to undefined)
          });

          // Extract treatment from backend decision
          const backendTreatment = decisionClient.extractTreatmentFromDecision(decision);

          // Allow backend to override if it differs from current session treatment
          // Use explicit null check (backendTreatment !== null) to include "control"
          if (backendTreatment !== null && sessionManager) {
            const currentSession = sessionManager.getCurrentSession();
            const currentTreatment = currentSession && currentSession.isTreatment === true
              ? "treatment"
              : currentSession && currentSession.isTreatment === false
              ? "control"
              : null;

            if (backendTreatment !== currentTreatment) {
              sessionManager.setTreatment(backendTreatment);
              logger?.logDebug("Treatment overridden by backend decision", {
                previous: currentTreatment,
                new: backendTreatment,
              });
            }
          }

          if (decision) {
            // Check template gating (feature flags)
            if (!isTemplateEnabled(decision.templateId, finalConfig)) {
              logger?.logWarn("Nudge template disabled by feature flags", { templateId: decision.templateId });
              return;
            }

            isNudgeActive = true; // Mark nudge as active
            notifyNudgeSubscribers(decision);
          }
        }
      }, loggerRef, "onFrictionSignal");
    }


    // STEP: Initialize SessionManager (provides session context for decisions and events)
    sessionManager = createSessionManager({
      logger: loggerRef,
      projectId: finalConfig.projectId,
      anonymousId: anonymousId,
      initTraceId, // Pass trace ID for session creation logging
    });

    // STEP: Assign treatment from config rules (before any events are tracked)
    // SAFETY: Wrap treatment assignment in safeTry to prevent crashes from localStorage errors
    safeTry(() => {
      const currentSession = sessionManager?.getCurrentSession();
      if (currentSession) {
        // TRACE: Log treatment computation inputs
        loggerRef.logDebug("Computing treatment from rules", {
          initTraceId,
          hasRules: finalConfig.treatment_rules !== undefined,
          rules: finalConfig.treatment_rules,
          anonymousId,
          sessionId: currentSession.id,
          projectId: finalConfig.projectId,
        });

        const treatment = computeTreatmentFromRules({
          anonymousId,
          sessionId: currentSession.id,
          rules: finalConfig.treatment_rules,
        });

        // Assign treatment to session (creates localStorage key immediately)
        if (treatment !== null && sessionManager) {
          sessionManager.setTreatment(treatment);

          // Confirm localStorage write (best-effort, may fail)
          const storageKey = `reveal_treatment_${finalConfig.projectId}_${anonymousId}`;
          let storedValue: string | null = null;
          try {
            storedValue = typeof localStorage !== "undefined" ? localStorage.getItem(storageKey) : null;
          } catch {
            // Ignore localStorage read errors
          }

          loggerRef.logDebug("Treatment assigned at init", {
            initTraceId,
            treatment,
            sticky: finalConfig.treatment_rules?.sticky ?? true,
            treatmentPercentage: finalConfig.treatment_rules?.treatment_percentage ?? 0,
            projectId: finalConfig.projectId,
            anonymousId,
            storageKey,
            storedValue,
          });
        } else {
          // Treatment computation returned null
          // Only WARN if BOTH (a) treatment_rules missing AND (b) session.isTreatment is null
          // If treatmentLoaded is true (loaded from localStorage), log DEBUG instead
          const treatmentLoaded = currentSession.isTreatment !== null;

          if (!finalConfig.treatment_rules && !treatmentLoaded) {
            loggerRef.logWarn("No treatment assigned (treatment_rules missing or returned null)", {
              initTraceId,
              hasTreatmentRules: finalConfig.treatment_rules !== undefined,
              treatmentRules: finalConfig.treatment_rules,
              projectId: finalConfig.projectId,
              anonymousId,
              treatmentLoaded,
            });
          } else {
            loggerRef.logDebug("Treatment computation returned null (treatment already loaded from storage or rules missing)", {
              initTraceId,
              hasTreatmentRules: finalConfig.treatment_rules !== undefined,
              treatmentLoaded,
              isTreatment: currentSession.isTreatment,
            });
          }
        }
      }
    }, loggerRef, "Treatment assignment");

    // STEP: Initialize event transformation (convert BaseEvent to backend format)
    // anonymousId already defined above (before onFrictionSignal)
    const sdkVersion = "0.1.0"; // TODO: Read from package.json
    const transformEvent = (baseEvent: BaseEvent) => {
      return transformBaseEventToBackendFormat(baseEvent, {
        anonymousId,
        sdkVersion,
        getPageContext: (): PageContext => ({
          url: typeof window !== "undefined" ? window.location.href : null,
          title: typeof document !== "undefined" ? document.title : null,
          referrer: typeof document !== "undefined" ? document.referrer : null,
        }),
      });
    };

    // STEP: Initialize Transport (HTTP transport for event batches)
    safeTry(() => {
      transport = createTransport({
        endpointUrl: ingestEndpoint,
        clientKey: clientKey,
        logger: loggerRef,
        transformEvent,
      });
      loggerRef.logDebug("Transport initialized", { endpointUrl: ingestEndpoint });
    }, loggerRef, "Transport creation");

    // STEP: Initialize ProgressTimeoutDetector (before EventPipeline, so we can pass callback)
    safeTry(() => {
      if (finalConfig.progress_timeout_rules?.enabled === true) {
        progressTimeoutDetector = createProgressTimeoutDetector({
          config: finalConfig.progress_timeout_rules,
          onFrictionSignal,
          logger: loggerRef,
        });
        loggerRef.logDebug("ProgressTimeoutDetector initialized", {
          enabled: true,
          timeout_seconds: finalConfig.progress_timeout_rules.timeout_seconds,
          progress_event_names: finalConfig.progress_timeout_rules.progress_event_names,
        });
      } else {
        loggerRef.logDebug("ProgressTimeoutDetector disabled (not enabled in config)");
      }
    }, loggerRef, "ProgressTimeoutDetector creation");

    // STEP: Initialize EventPipeline (event buffering and enrichment)
    safeTry(() => {
      if (!transport) {
        loggerRef.logError("Transport not available, EventPipeline cannot be created");
        return;
      }
      if (!sessionManager) {
        loggerRef.logError("SessionManager not available, EventPipeline cannot be created");
        return;
      }

      // DEBUG: Log EventPipeline creation options
      loggerRef.logDebug("Creating EventPipeline with options", {
        initTraceId,
        sampledIn,
        hasSessionManager: !!sessionManager,
        hasTransport: !!transport,
        configMaxFlushIntervalMs: 5000,
        configMaxBufferSize: 1000,
        hasProgressTimeoutDetector: !!progressTimeoutDetector,
      });

      eventPipeline = createEventPipeline({
        sessionManager: sessionManager,
        transport: transport,
        logger: loggerRef,
        sampledIn: sampledIn, // Apply sampling decision
        config: {
          maxFlushIntervalMs: 5000,
          maxBufferSize: 1000,
          eventBatchSize: 20,
          maxEventRetries: 2,
        },
        getCurrentLocation: () => {
          // Browser environment: use window.location
          if (typeof window !== "undefined" && window.location) {
            return { 
              path: window.location.pathname,
              route: null, // Not available from window.location
              screen: null, // Not available from window.location
            };
          }
          return { 
            path: null,
            route: null,
            screen: null,
          };
        },
        onEventCaptured: progressTimeoutDetector
          ? (event) => {
              safeTry(() => {
                progressTimeoutDetector?.onEvent(event);
              }, loggerRef, "ProgressTimeoutDetector.onEvent");
            }
          : undefined,
      });

      // Set EventPipeline reference for internal trace notification system
      setTraceEventPipeline(eventPipeline);

      // Start periodic flush for automatic event sending
      safeTry(() => {
        eventPipeline?.startPeriodicFlush();
        loggerRef.logDebug("EventPipeline periodic flush started");
      }, loggerRef, "EventPipeline.startPeriodicFlush");

      loggerRef.logDebug("EventPipeline initialized");
    }, loggerRef, "EventPipeline creation");

    // STEP: Initialize DecisionClient (requests nudge decisions from backend)
    safeTry(() => {
      if (!transport) {
        loggerRef.logError("Transport not available, DecisionClient cannot be created");
        return;
      }
    decisionClient = createDecisionClient({
        endpoint: resolvedDecisionEndpoint, // Use resolved endpoint (full URL)
        timeoutMs: finalConfig.decision.timeoutMs,
        projectId: finalConfig.projectId,
        environment: finalConfig.environment,
      clientKey: clientKey,
      logger: loggerRef,
        transport: transport,
    });
      loggerRef.logDebug("DecisionClient initialized");
    }, loggerRef, "DecisionClient creation");

    detectorManager = createDetectorManager({
      config: finalConfig,
      onFrictionSignal,
      logger: loggerRef,
    });

    // SAFETY: Wrap detector initialization in safeTry to prevent crashes
    safeTry(() => {
      if (detectorManager) {
        detectorManager.initDetectors();
        loggerRef.logDebug("Detectors initialized and listening");
      }
    }, loggerRef, "DetectorManager.initDetectors");

    loggerRef.logDebug("Reveal SDK initialization complete ✓");
  }, loggerRef, "Reveal.init()").catch((error: any) => {
    // FATAL ERROR: Disable SDK entirely
    loggerRef.logError("Fatal error during Reveal SDK initialization", error);
    isDisabled = true;
    isInitialized = false; // Allow retry if desired

    // Clean up any partially initialized modules
    cleanup();
  });
}

/**
 * Track an event
 * 
 * @param eventKind - Type of event (product, friction, nudge, session)
 * @param eventType - Specific event type identifier
 * @param properties - Optional event properties
 */
export function track(
  eventKind: string,
  eventType: string,
  properties: EventPayload = {}
): void {
  if (isDisabled) {
    return;
  }
  if (!isInitialized) {
    // Fails open: log to console in debug, but don't break host app
    console.warn?.(
      "[Reveal SDK] track() called before init; event ignored",
      { eventKind, eventType, properties }
    );
    return;
  }
  
  // EventPipeline may be null if initialization failed (fail-open)
  if (!eventPipeline) {
    logger?.logWarn("EventPipeline not available, event ignored", {
      eventKind,
      eventType,
    });
    return;
  }

  // Simple guard for allowed event kinds
  const allowedKinds: EventKind[] = ["product", "friction", "nudge", "session"];
  if (!allowedKinds.includes(eventKind as EventKind)) {
    logger?.logWarn("Reveal.track(): invalid eventKind, ignoring", {
      eventKind,
      eventType,
    });
    return;
  }

  // Track nudge dismissal/click to reset active flag and set cooldown
  // This allows new friction detection after nudge is dismissed, with a brief cooldown
  // to prevent immediate re-triggering while backend processes the dismissal event
  if (eventKind === "nudge" && (eventType === "nudge_dismissed" || eventType === "nudge_clicked")) {
    isNudgeActive = false;
    nudgeDismissalCooldownUntil = Date.now() + NUDGE_DISMISSAL_COOLDOWN_MS;
    logger?.logDebug("Nudge dismissed/clicked - resuming friction detection after cooldown", {
      eventType,
      nudgeId: properties?.nudgeId,
      cooldownMs: NUDGE_DISMISSAL_COOLDOWN_MS,
    });
  }

  eventPipeline.captureEvent(
    eventKind as EventKind,
    eventType,
    properties || {}
  );
}

/**
 * Subscribe to nudge decisions
 * 
 * @param handler - Callback function to receive nudge decisions
 * @returns Unsubscribe function
 */
export function onNudgeDecision(
  handler: (decision: WireNudgeDecision) => void
): () => void {
  if (typeof handler !== "function") {
    logger?.logWarn("onNudgeDecision called with non-function handler");
  return () => {};
  }

  nudgeSubscribers.push(handler);

  // Return unsubscribe function
  return () => {
    nudgeSubscribers = nudgeSubscribers.filter((h) => h !== handler);
  };
}

/**
 * Request a trace for the current session
 *
 * BYOR (Bring Your Own Recorder) pattern: This method generates a trace_id,
 * notifies subscribers (so they can start their session recorder), and correlates
 * the trace_id with the next /decide request within 60s TTL.
 *
 * @param options - Optional reason and metadata (primitives only, max 2KB)
 * @returns trace_id (UUID) if recording enabled, null otherwise
 *
 * @example
 * ```typescript
 * // Manually request a trace
 * const traceId = Reveal.requestTrace({
 *   reason: 'user_reported_issue',
 *   meta: { page: 'checkout', step: 2, isHighValue: true }
 * });
 * ```
 */
export function requestTrace(options?: {
  reason?: string;
  meta?: Record<string, string | number | boolean | null>;
}): string | null {
  if (isDisabled || !isInitialized) {
    logger?.logWarn("requestTrace called before SDK initialization");
    return null;
  }

  // Check if recording feature is enabled (use mergedConfig which includes init options.features)
  const features = mergedConfig?.features || DEFAULT_FEATURES;
  const recordingEnabled = features.recording?.enabled ?? DEFAULT_FEATURES.recording.enabled;

  if (!recordingEnabled) {
    logger?.logDebug("requestTrace called but recording feature disabled", {
      hasMergedConfig: mergedConfig !== null,
      features,
      recordingEnabled,
    });
    return null;
  }

  // Generate trace_id (use crypto.randomUUID if available, fallback to timestamp-based UUID)
  const traceId = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `trace-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

  // Sanitize inputs
  const sanitizedReason = sanitizeReason(options?.reason);
  const sanitizedMeta = sanitizeMeta(options?.meta) || {};

  // Store trace_id for correlation with next /decide request (60s TTL)
  storePendingTraceId(traceId, 60000);

  // Build trace request context
  const currentSession = sessionManager?.getCurrentSession();
  const context: TraceRequestContext = {
    traceId,
    reason: sanitizedReason,
    meta: sanitizedMeta,
    sessionId: currentSession?.id || "unknown",
    anonymousId: getOrCreateAnonymousId(),
    projectId: mergedConfig?.projectId || "unknown",
  };

  // Emit trace request using shared internal module (handles EventPipeline + subscribers)
  emitTraceRequested(context);

  logger?.logDebug("Trace requested", { traceId, reason: sanitizedReason });

  return traceId;
}

/**
 * Subscribe to trace requests
 *
 * BYOR (Bring Your Own Recorder) pattern: Use this to receive notifications
 * when Reveal.requestTrace() is called, so you can start your session recorder
 * (rrweb, LogRocket, etc.).
 *
 * @param handler - Callback function to receive trace request context
 * @returns Unsubscribe function
 *
 * @example
 * ```typescript
 * const unsubscribe = Reveal.onTraceRequested(async (context) => {
 *   console.log('Starting recording for trace:', context.traceId);
 *   // Start your session recorder here
 *   rrweb.record({ /* config *\/ });
 * });
 *
 * // Later: unsubscribe
 * unsubscribe();
 * ```
 */
/**
 * Subscribe to trace request events (manual or backend-driven)
 *
 * Exported from internal module to share subscribers between requestTrace() and DecisionClient.
 */
export const onTraceRequested = onTraceRequestedInternal;

/**
 * Destroy the SDK instance and clean up resources
 */
export function destroy(): void {
  safeTry(() => {
    logger?.logDebug("Reveal.destroy() called");
    cleanup();
    isInitialized = false;
    isDisabled = false;
  }, logger || undefined, "Reveal.destroy");
}

// ======================================================
// INTERNAL HELPERS
// ======================================================

function notifyNudgeSubscribers(decision: WireNudgeDecision) {
  if (!nudgeSubscribers.length) return;

  // Deduplication: skip if same decision ID
  if (lastDecisionId === decision.nudgeId) {
    logger?.logDebug("Skipping duplicate nudge decision", { nudgeId: decision.nudgeId });
    return;
  }

  lastDecisionId = decision.nudgeId;
  isNudgeActive = true; // Mark nudge as active when notifying subscribers
  nudgeDismissalCooldownUntil = null; // Clear any cooldown when new nudge is shown

  nudgeSubscribers.forEach((handler) => {
    safeTry(() => handler(decision), logger || undefined, "nudgeSubscriber");
  });
}

function cleanup() {
  // Tear down any partially initialized modules
  // Order matters: stop detectors first, then pipeline (which may flush), then others
  
  if (progressTimeoutDetector) {
    const ptd = progressTimeoutDetector; // Capture for TypeScript narrowing
    safeTry(() => ptd.destroy(), logger || undefined, "cleanup:progressTimeoutDetector");
  }

  if (detectorManager) {
    const dm = detectorManager; // Capture for TypeScript narrowing
    safeTry(() => dm.destroy(), logger || undefined, "cleanup:detectors");
  }

  if (eventPipeline) {
    const ep = eventPipeline; // Capture for TypeScript narrowing
    safeTry(() => ep.destroy(), logger || undefined, "cleanup:pipeline");
  }

  if (sessionManager) {
    const sm = sessionManager; // Capture for TypeScript narrowing
    safeTry(() => sm.endSession("cleanup"), logger || undefined, "cleanup:session");
  }

  // Clear references
  configClient = null;
  sessionManager = null;
  eventPipeline = null;
  transport = null;
  detectorManager = null;
  progressTimeoutDetector = null;
  decisionClient = null;

  // Clear subscribers
  nudgeSubscribers = [];
  // Note: traceSubscribers managed by internal/traceRequested module
}

/**
 * Start watching a context for idle behavior
 * 
 * @param config - Idle watch configuration (context, selector, timeoutMs)
 */
export function startIdleWatch(config: {
  context: string;
  selector: string | null;
  timeoutMs?: number;
}): void {
  if (detectorManager) {
    detectorManager.startIdleWatch(config);
  } else {
    logger?.logWarn("startIdleWatch called before SDK initialization");
  }
}

/**
 * Stop watching a context for idle behavior
 * 
 * @param context - Context identifier to stop watching
 */
export function stopIdleWatch(context: string): void {
  if (detectorManager) {
    detectorManager.stopIdleWatch(context);
  } else {
    logger?.logWarn("stopIdleWatch called before SDK initialization");
  }
}

/**
 * Mark a context as closed (stops watching and resets timers)
 * 
 * @param context - Context identifier to mark as closed
 */
export function markContextClosed(context: string): void {
  if (detectorManager) {
    detectorManager.markContextClosed(context);
  } else {
    logger?.logWarn("markContextClosed called before SDK initialization");
  }
}

