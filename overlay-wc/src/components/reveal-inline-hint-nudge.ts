/**
 * RevealInlineHintNudge Component
 *
 * Lightweight inline hint nudge with glassmorphic styling.
 * Simpler than tooltip - no title, no CTA, no arrow, just body text.
 *
 * Features:
 * - Glassmorphic design (same as tooltip but thinner)
 * - Supports topCenter and bottomCenter quadrants only (MVP)
 * - Dismisses on ANY meaningful engagement: click, focus, scroll (>16px), ESC key
 * - Emits reveal:shown once on mount
 * - Emits reveal:dismiss with reason (click|focus|scroll|esc|navigation|tab_hidden)
 * - Idempotent dismissal (only one dismiss event per nudgeId)
 *
 * @module components/reveal-inline-hint-nudge
 */

import type { NudgeDecision, NudgeQuadrant } from "../types/nudge-decision";
import { computeQuadrantPosition } from "../utils/position";

// SSR-safe base class
const HTMLElementBase = (typeof HTMLElement !== 'undefined' ? HTMLElement : Object) as typeof HTMLElement;

export class RevealInlineHintNudge extends HTMLElementBase {
  private _shadowRoot!: ShadowRoot;
  private _decision: NudgeDecision | null = null;
  private _isRendered = false;
  private _isShown = false;
  private _isDismissed = false; // Idempotency guard
  private _isExiting = false;

  // Event handler references for cleanup
  private _clickHandler: ((e: MouseEvent) => void) | null = null;
  private _focusHandler: ((e: FocusEvent) => void) | null = null;
  private _scrollHandler: (() => void) | null = null;
  private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private _exitAnimationEndHandler: ((e: AnimationEvent) => void) | null = null;

  constructor() {
    super();
    if (typeof this.attachShadow !== 'undefined') {
      this._shadowRoot = this.attachShadow({ mode: "open" });
    }
  }

  get decision(): NudgeDecision | null {
    return this._decision;
  }

  set decision(value: NudgeDecision | null) {
    // If decision becomes null and component is rendered, start exit animation
    if (value === null && this._isRendered && !this._isExiting) {
      this.startExit();
      return;
    }

    this._decision = value;
    this._isRendered = false;
    this._isShown = false;
    this._isDismissed = false;
    this._isExiting = false;
    this._render();
  }

  connectedCallback() {
    if (this._decision && !this._isRendered) {
      this._render();
    }

    // Dispatch shown event after connected (React listeners ready)
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

    const quadrant = this._decision.quadrant || "topCenter";

    // Only support topCenter and bottomCenter for MVP
    if (quadrant !== "topCenter" && quadrant !== "bottomCenter") {
      console.warn(`[reveal-inline-hint] Quadrant "${quadrant}" not supported. Using topCenter.`);
    }

    this._shadowRoot.innerHTML = `
      <style>
        :host {
          all: initial;
          display: block;
        }

        .inline-hint-container {
          position: fixed;
          z-index: 10001;

          /* Glassmorphic design - same as tooltip */
          background: hsla(240, 15%, 14%, 0.32);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.22);
          box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.30) inset,
            0 0 8px rgba(255, 255, 255, 0.08),
            0 8px 24px rgba(0, 0, 0, 0.40);

          /* Generous padding for breathability */
          padding: 16px 24px;
          border-radius: 8px;
          width: clamp(200px, 35vw, 450px);

          pointer-events: auto;

          /* Entry animation - zoom-in */
          opacity: 0;
          transform: scale(0.9);
          animation: zoomIn 300ms ease-out forwards;
        }

        @keyframes zoomIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .inline-hint-container.exiting {
          animation: zoomOut 300ms ease-in forwards;
        }

        @keyframes zoomOut {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.9);
          }
        }

        /* Respect reduced motion preference */
        @media (prefers-reduced-motion: reduce) {
          .inline-hint-container {
            animation: none;
            opacity: 1;
            transform: scale(1);
          }
          .inline-hint-container.exiting {
            animation: none;
            opacity: 0;
            transform: scale(0.9);
          }
        }

        .hint-text {
          color: #e8e8eb;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 17px;
          line-height: 1.4;
          margin: 0;
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

      <div class="inline-hint-container">
        <p class="hint-text">${this._escape(this._decision.body || '')}</p>
      </div>

      ${this._decision.debugCode ? `
        <div class="debug-code" aria-hidden="true">
          reveal: ${this._decision.debugCode}
        </div>
      ` : ''}
    `;

    this._isRendered = true;

    // Update position after render
    requestAnimationFrame(() => {
      this._updatePosition();
      this._attachEventListeners();
    });
  }

  private _updatePosition() {
    const container = this._shadowRoot.querySelector('.inline-hint-container') as HTMLElement;
    if (!container || !this._decision) return;

    const quadrant = this._decision.quadrant || "topCenter";
    const position = computeQuadrantPosition(quadrant, container);

    container.style.top = `${position.top}px`;
    container.style.left = `${position.left}px`;
  }

  private _attachEventListeners() {
    // Click anywhere dismisses
    this._clickHandler = (e: MouseEvent) => {
      this._handleDismiss("click");
    };
    document.addEventListener("click", this._clickHandler, true);

    // Focus anywhere dismisses
    this._focusHandler = (e: FocusEvent) => {
      this._handleDismiss("focus");
    };
    document.addEventListener("focusin", this._focusHandler, true);

    // Scroll dismisses (with threshold)
    let lastScrollY = window.scrollY;
    this._scrollHandler = () => {
      const scrollDelta = Math.abs(window.scrollY - lastScrollY);
      if (scrollDelta > 16) {
        this._handleDismiss("scroll");
      }
    };
    window.addEventListener("scroll", this._scrollHandler, { passive: true });

    // ESC key dismisses
    this._keydownHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this._handleDismiss("esc");
      }
    };
    window.addEventListener("keydown", this._keydownHandler);
  }

  private _handleDismiss(reason: string) {
    if (this._isDismissed) return; // Idempotency
    this._isDismissed = true;

    this.dispatchEvent(
      new CustomEvent("reveal:dismiss", {
        detail: {
          id: this._decision?.nudgeId,
          reason
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  startExit(): void {
    // Idempotency guard: if already exiting, ignore
    if (this._isExiting) {
      return;
    }

    this._isExiting = true;

    // Get container element
    const container = this._shadowRoot.querySelector('.inline-hint-container') as HTMLElement;
    if (!container) {
      // If container doesn't exist, dispatch exit-complete immediately
      this.dispatchEvent(
        new CustomEvent("reveal:exit-complete", {
          bubbles: true,
          composed: true,
        })
      );
      return;
    }

    // Check for reduced motion preference
    let shouldAnimate = true;
    try {
      if (typeof window.matchMedia === "function") {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduceMotion) {
          shouldAnimate = false;
        }
      }
    } catch {
      // If matchMedia fails, proceed with animation
    }

    if (!shouldAnimate) {
      // Skip animation, dispatch immediately
      this.dispatchEvent(
        new CustomEvent("reveal:exit-complete", {
          bubbles: true,
          composed: true,
        })
      );
      return;
    }

    // Add exiting class to trigger exit animation
    container.classList.add("exiting");

    // Listen for animation end
    this._exitAnimationEndHandler = (e: AnimationEvent) => {
      // Only handle animation end for the container element
      if (e.target === container && e.animationName === "zoomOut") {
        container.removeEventListener("animationend", this._exitAnimationEndHandler!);
        this._exitAnimationEndHandler = null;

        // Dispatch exit-complete event
        this.dispatchEvent(
          new CustomEvent("reveal:exit-complete", {
            bubbles: true,
            composed: true,
          })
        );
      }
    };

    container.addEventListener("animationend", this._exitAnimationEndHandler);
  }

  private _cleanup() {
    if (this._clickHandler) {
      document.removeEventListener("click", this._clickHandler, true);
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
    const container = this._shadowRoot.querySelector('.inline-hint-container') as HTMLElement;
    if (this._exitAnimationEndHandler && container) {
      container.removeEventListener("animationend", this._exitAnimationEndHandler);
      this._exitAnimationEndHandler = null;
    }
  }

  private _escape(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Auto-register
if (typeof customElements !== 'undefined') {
  customElements.define("reveal-inline-hint-nudge", RevealInlineHintNudge);
}
