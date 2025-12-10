/**
 * useNudgeVisibility Hook
 * 
 * Manages nudge visibility state and auto-dismiss behavior.
 * Handles manual dismiss and automatic dismiss based on autoDismissMs.
 * 
 * @module hooks/useNudgeVisibility
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { NudgeDecision } from "../types/NudgeDecision";

export interface UseNudgeVisibilityArgs {
  decision: NudgeDecision | null;
  onDismiss?: (id: string) => void;
}

export interface UseNudgeVisibilityResult {
  isVisible: boolean;
  handleManualDismiss: () => void;
}

/**
 * Hook that manages nudge visibility and auto-dismiss behavior.
 * 
 * @param args - Decision and optional dismiss callback
 * @returns Visibility state and manual dismiss handler
 */
export function useNudgeVisibility({
  decision,
  onDismiss,
}: UseNudgeVisibilityArgs): UseNudgeVisibilityResult {
  // ✅ ALL HOOKS MUST BE CALLED UNCONDITIONALLY (Rules of Hooks)
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const timeoutRef = useRef<number | null>(null);

  // Stabilize decision.id to avoid hook dependency issues
  const decisionId = decision?.id ?? null;
  const autoDismissMs = decision?.autoDismissMs ?? null;

  // Handle manual dismiss (only if decision exists)
  const handleManualDismiss = useCallback(() => {
    setIsVisible(false);
    if (onDismiss && decisionId) {
      onDismiss(decisionId);
    }
  }, [decisionId, onDismiss]);

  // Reset visibility when decision changes (new decision = visible again, null = hidden)
  // This must be called BEFORE the auto-dismiss effect to maintain hook order
  useEffect(() => {
    setIsVisible(decisionId !== null);
  }, [decisionId]);

  // Auto-dismiss logic (only if decision exists)
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // If no decision, hide immediately
    if (!decisionId) {
      setIsVisible(false);
      return;
    }

    // If autoDismissMs is set and nudge is visible, set up auto-dismiss
    if (autoDismissMs && autoDismissMs > 0 && isVisible) {
      timeoutRef.current = window.setTimeout(() => {
        setIsVisible(false);
        if (onDismiss && decisionId) {
          onDismiss(decisionId);
        }
        timeoutRef.current = null;
      }, autoDismissMs);
    }

    // Cleanup on unmount or when decision/visibility changes
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [autoDismissMs, decisionId, isVisible, onDismiss]);

  return {
    isVisible: decision ? isVisible : false,
    handleManualDismiss,
  };
}

