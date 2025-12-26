/**
 * RevealSpotlight Web Component
 *
 * Renders a full-screen dark scrim with a circular cutout highlighting a target element.
 * Used for hard-intrusion onboarding and feature discovery.
 *
 * Features:
 * - Full-screen scrim with opacity 0.60
 * - Circular hole via CSS radial-gradient
 * - Optional caption (from decision.body)
 * - Target element detection via decision.selectorPattern
 * - Resize listener with 100ms debounce
 * - Manager-level dismissal triggers
 *
 * Events:
 * - reveal:shown (once on mount)
 * - reveal:dismiss (with reason: click|focus|scroll|esc|target_not_found)
 *
 * @module components/reveal-spotlight
 */

import type { NudgeDecision } from "../types/nudge-decision";
import { computeQuadrantPosition } from "../utils/position";

const HTMLElementBase =
  typeof HTMLElement !== "undefined" ? HTMLElement : (Object as any);

export class RevealSpotlight extends HTMLElementBase {
  private _shadowRoot!: ShadowRoot;
  private _decision: NudgeDecision | null = null;
  private _isRendered = false;
  private _isShown = false;
  private _isDismissed = false; // Idempotency guard

  private _targetRect: DOMRect | null = null;
  private _resizeHandler: (() => void) | null = null;
  private _clickHandler: ((e: MouseEvent) => void) | null = null;
  private _targetClickHandler: ((e: MouseEvent) => void) | null = null;
  private _focusHandler: ((e: FocusEvent) => void) | null = null;
  private _scrollHandler: (() => void) | null = null;
  private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private _targetElement: Element | null = null;

  constructor() {
    super();
    if (typeof this.attachShadow !== "undefined") {
      this._shadowRoot = this.attachShadow({ mode: "open" });
    }
  }

  connectedCallback() {
    if (this._decision && !this._isRendered) {
      this._render();
    }

    // Emit shown event after connected
    if (this._decision && !this._isShown) {
      this._isShown = true;
      this.dispatchEvent(
        new CustomEvent("reveal:shown", {
          detail: { id: this._decision.nudgeId },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  disconnectedCallback() {
    this._cleanup();
  }

  private _render() {
    if (!this._decision || this._isRendered) return;

    // CRITICAL: Check if target element exists
    if (!this._decision.selectorPattern) {
      console.warn("[reveal-spotlight] No selectorPattern provided");
      this._handleDismiss("target_not_found");
      return;
    }

    const targetElement = document.querySelector(
      this._decision.selectorPattern
    );
    if (!targetElement) {
      console.warn(
        `[reveal-spotlight] Target not found: ${this._decision.selectorPattern}`
      );
      this._handleDismiss("target_not_found");
      return;
    }

    // Store reference for click detection
    this._targetElement = targetElement;

    // Get target position
    this._targetRect = targetElement.getBoundingClientRect();

    // Calculate hole center and radius
    const centerX = this._targetRect.left + this._targetRect.width / 2;
    const centerY = this._targetRect.top + this._targetRect.height / 2;
    const radius =
      Math.max(this._targetRect.width, this._targetRect.height) / 2 + 12; // 12px padding

    // Render scrim with hole
    this._shadowRoot.innerHTML = `
      <style>
        :host {
          all: initial;
          display: block;
        }

        .spotlight-scrim {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 10000;
          pointer-events: none;

          /* Radial gradient hole with soft falloff and directional bias */
          background: radial-gradient(
            circle ${radius * 0.92}px at ${centerX}px ${centerY}px,
            rgba(0, 0, 0, 0) 0%,
            rgba(0, 0, 0, 0.06) ${radius * 0.85}px,
            rgba(0, 0, 0, 0.18) ${radius * 1.05}px
          );
          box-shadow: inset 0 0 48px rgba(0, 0, 0, 0.18);

          /* Fade-in animation */
          opacity: 0;
          animation: fadeIn 250ms ease-out forwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Respect reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .spotlight-scrim {
            animation: none;
            opacity: 1;
          }
        }

        .spotlight-caption {
          position: fixed;
          z-index: 10001;

          /* Styling */
          background: hsla(240, 15%, 14%, 0.45);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);

          padding: 16px 24px;
          border-radius: 8px;
          width: clamp(200px, 30vw, 300px);

          color: rgba(255, 255, 255, 0.92);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 17px;
          line-height: 1.4;
          text-align: center;
          font-weight: 500;
        }

        .debug-code {
          position: fixed;
          bottom: 8px;
          right: 8px;
          font-size: 9px;
          color: rgba(255, 255, 255, 0.28);
          font-family: ui-monospace, monospace;
          pointer-events: none;
          user-select: none;
          z-index: 10002;
        }
      </style>

      <div class="spotlight-scrim"></div>

      ${
        this._decision.body
          ? `
        <div class="spotlight-caption">${this._escape(this._decision.body)}</div>
      `
          : ""
      }

      ${
        this._decision.debugCode
          ? `
        <div class="debug-code" aria-hidden="true">reveal: ${this._decision.debugCode}</div>
      `
          : ""
      }
    `;

    this._isRendered = true;

    // Position caption and attach listeners
    requestAnimationFrame(() => {
      this._updateCaptionPosition();
      this._attachEventListeners();
    });
  }

  private _updateCaptionPosition() {
    const caption = this._shadowRoot.querySelector(
      ".spotlight-caption"
    ) as HTMLElement;
    if (!caption || !this._decision) return;

    const quadrant = this._decision.quadrant || "bottomCenter";
    const position = computeQuadrantPosition(quadrant, caption);

    caption.style.top = `${position.top}px`;
    caption.style.left = `${position.left}px`;
  }

  private _attachEventListeners() {
    // Direct click listener on target element (bubble phase - fires AFTER capture phase)
    if (this._targetElement) {
      this._targetClickHandler = () => {
        // Dispatch action-click event
        this._handleActionClick();

        // Do NOT call preventDefault() or stopPropagation()
        // Allow click to pass through to underlying element for click-through behavior
      };

      // Use bubble phase (capture: false) so this runs AFTER document capture listener
      (this._targetElement as any).addEventListener("click", this._targetClickHandler, false);
    }

    // Document-level click handler (capture phase - runs first, checks if target will handle)
    this._clickHandler = (e: Event) => {
      // Check if click target is the spotlight target or its child
      if (this._targetElement && e.target instanceof Node) {
        if (e.target === this._targetElement || this._targetElement.contains(e.target)) {
          // Target click will be handled by target listener in bubble phase
          // Do NOT dismiss
          return;
        }
      }

      // Click outside target - dismiss but do NOT block the page
      this._handleDismiss("click_outside");
    };
    document.addEventListener("click", this._clickHandler, true);

    // Focus handler - do NOT dismiss if focus is within target element
    this._focusHandler = (e: FocusEvent) => {
      // If focus is on or within the target element, this is intended interaction
      if (this._targetElement && e.target instanceof Node) {
        if (this._targetElement === e.target || this._targetElement.contains(e.target)) {
          // Focus within target is the intended action - do not dismiss
          return;
        }
      }
      // Focus outside target - dismiss
      this._handleDismiss("focus");
    };
    document.addEventListener("focusin", this._focusHandler, true);

    // Scroll dismisses (>16px threshold)
    let lastScrollY = window.scrollY;
    this._scrollHandler = () => {
      const delta = Math.abs(window.scrollY - lastScrollY);
      if (delta > 16) this._handleDismiss("scroll");
    };
    window.addEventListener("scroll", this._scrollHandler, { passive: true });

    // ESC key dismisses
    this._keydownHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") this._handleDismiss("esc");
    };
    window.addEventListener("keydown", this._keydownHandler);

    // Resize recomputes hole (debounced)
    let resizeTimeout: number | null = null;
    this._resizeHandler = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        this._recomputeHole();
      }, 100);
    };
    window.addEventListener("resize", this._resizeHandler);
  }

  private _recomputeHole() {
    if (!this._decision?.selectorPattern) return;

    const targetElement = document.querySelector(
      this._decision.selectorPattern
    );
    if (!targetElement) {
      this._handleDismiss("target_not_found");
      return;
    }

    // Remove old target listener if target changed
    if (this._targetClickHandler && this._targetElement && this._targetElement !== targetElement) {
      (this._targetElement as any).removeEventListener("click", this._targetClickHandler, false);
    }

    // Update target reference (element might have moved/changed)
    const oldTarget = this._targetElement;
    this._targetElement = targetElement;

    // Re-attach target click listener if target changed
    if (this._targetClickHandler && oldTarget !== targetElement) {
      (this._targetElement as any).addEventListener("click", this._targetClickHandler, false);
    }

    this._targetRect = targetElement.getBoundingClientRect();

    const centerX = this._targetRect.left + this._targetRect.width / 2;
    const centerY = this._targetRect.top + this._targetRect.height / 2;
    const radius =
      Math.max(this._targetRect.width, this._targetRect.height) / 2 + 12;

    const scrim = this._shadowRoot.querySelector(
      ".spotlight-scrim"
    ) as HTMLElement;
    if (scrim) {
      scrim.style.background = `radial-gradient(
        circle ${radius}px at ${centerX}px ${centerY}px,
        transparent 0,
        transparent ${radius}px,
        rgba(0, 0, 0, 0.60) ${radius}px
      )`;
    }
  }

  private _handleDismiss(reason: string) {
    if (this._isDismissed) return; // Idempotency
    this._isDismissed = true;

    this.dispatchEvent(
      new CustomEvent("reveal:dismiss", {
        detail: {
          id: this._decision?.nudgeId,
          reason,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleActionClick() {
    if (this._isDismissed) return; // Idempotency guard
    this._isDismissed = true;

    this.dispatchEvent(
      new CustomEvent("reveal:action-click", {
        detail: {
          id: this._decision?.nudgeId,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _cleanup() {
    if (this._clickHandler) {
      document.removeEventListener("click", this._clickHandler, true);
    }
    if (this._targetClickHandler && this._targetElement) {
      (this._targetElement as any).removeEventListener("click", this._targetClickHandler, false);
    }
    if (this._focusHandler) {
      document.removeEventListener("focusin", this._focusHandler, true);
    }
    if (this._scrollHandler) {
      window.removeEventListener("scroll", this._scrollHandler);
    }
    if (this._keydownHandler) {
      window.removeEventListener("keydown", this._keydownHandler);
    }
    if (this._resizeHandler) {
      window.removeEventListener("resize", this._resizeHandler);
    }

    // Clear target reference
    this._targetElement = null;
  }

  private _escape(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  get decision(): NudgeDecision | null {
    return this._decision;
  }

  set decision(value: NudgeDecision | null) {
    this._decision = value;
    this._isRendered = false;
    this._isShown = false;
    this._isDismissed = false;
    this._targetElement = null; // Clear stale reference
    this._render();
  }
}

// Auto-register
if (typeof customElements !== "undefined") {
  customElements.define("reveal-spotlight", RevealSpotlight as unknown as CustomElementConstructor);
}
