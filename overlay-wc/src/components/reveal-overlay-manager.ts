/**
 * RevealOverlayManager Web Component
 *
 * Main routing component that renders the appropriate nudge template
 * based on the templateId in the decision.
 *
 * Currently supports:
 * - tooltip (fully implemented)
 * - inline_hint (fully implemented)
 * - spotlight (fully implemented)
 * - modal, banner (not yet implemented)
 */

import type { NudgeDecision } from "../types/nudge-decision";
import { RevealTooltipNudge } from "./reveal-tooltip-nudge";
import { RevealInlineHintNudge } from "./reveal-inline-hint-nudge";
import "./reveal-spotlight"; // Import for side-effects (registers custom element)

// Conditional base class to support SSR
const HTMLElementBase = (typeof HTMLElement !== 'undefined' ? HTMLElement : Object) as typeof HTMLElement;

export class RevealOverlayManager extends HTMLElementBase {
  private _decision: NudgeDecision | null = null;
  private _shadowRoot: ShadowRoot;
  private _currentTemplate: HTMLElement | null = null;
  private _isRendered: boolean = false;
  private _exitListener: ((e: Event) => void) | null = null;
  private _exitTimeout: number | null = null;

  constructor() {
    super();
    this._shadowRoot = this.attachShadow({ mode: "open" });
  }

  static get observedAttributes() {
    return ["show-quadrants"];
  }

  get decision(): NudgeDecision | null {
    return this._decision;
  }

  set decision(value: NudgeDecision | null) {
    this._decision = value;
    this._isRendered = false; // Reset render flag when decision changes
    this._render();
  }

  connectedCallback() {
    // Only render if not already rendered (prevents double-render on initial mount)
    if (this._decision && !this._isRendered) {
      this._render();
    }
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === "show-quadrants") {
      this._render();
    }
  }

  private _render() {
    // Prevent duplicate renders (fixes double event listener attachment)
    if (this._isRendered) {
      return;
    }

    // Handle exit lifecycle: if decision is null and template exists, start exit animation
    if (!this._decision && this._currentTemplate) {
      // Clear any existing exit listener
      if (this._exitListener) {
        this._currentTemplate.removeEventListener("reveal:exit-complete", this._exitListener);
        this._exitListener = null;
      }
      if (this._exitTimeout) {
        clearTimeout(this._exitTimeout);
        this._exitTimeout = null;
      }

      // Try to call startExit() if the template supports it
      const template = this._currentTemplate as any;
      if (typeof template.startExit === "function") {
        // Set up exit listener
        this._exitListener = () => {
          this._removeTemplate();
        };
        this._currentTemplate.addEventListener("reveal:exit-complete", this._exitListener, { once: true });

        // Fallback timeout: if exit-complete never fires (legacy component), remove after 500ms
        this._exitTimeout = window.setTimeout(() => {
          this._removeTemplate();
        }, 500);

        // Start exit animation
        template.startExit();
      } else {
        // Legacy component without exit support - remove immediately
        this._removeTemplate();
      }
      return;
    }

    // Clear existing template (if we get here, we're rendering a new decision)
    if (this._currentTemplate) {
      this._removeTemplate();
    }

    if (!this._decision) {
      this._shadowRoot.innerHTML = "";
      return;
    }

    this._isRendered = true; // Mark as rendered

    // Route to template
    const templateId = this._decision.templateId;

    if (templateId === "tooltip") {
      const tooltip = document.createElement("reveal-tooltip-nudge") as RevealTooltipNudge;

      // Events from child will bubble naturally through Shadow DOM (composed: true)
      // No need to re-dispatch - React listener on parent will receive them automatically
      tooltip.decision = this._decision;

      this._currentTemplate = tooltip;
      this._shadowRoot.appendChild(tooltip);
    } else if (templateId === "inline_hint") {
      const inlineHint = document.createElement("reveal-inline-hint-nudge") as RevealInlineHintNudge;

      // Events from child will bubble naturally through Shadow DOM (composed: true)
      inlineHint.decision = this._decision;

      this._currentTemplate = inlineHint;
      this._shadowRoot.appendChild(inlineHint);
    } else if (templateId === "spotlight") {
      const spotlight = document.createElement("reveal-spotlight");

      // Events from child will bubble naturally through Shadow DOM (composed: true)
      (spotlight as any).decision = this._decision;

      this._currentTemplate = spotlight;
      this._shadowRoot.appendChild(spotlight);
    } else {
      // Unimplemented template - log warning
      console.warn(`[reveal-overlay-manager] Template "${templateId}" not yet implemented`);
      this._shadowRoot.innerHTML = "";
    }

    // Optionally render quadrant debug overlays
    if (this.hasAttribute("show-quadrants")) {
      this._renderQuadrantDebug();
    }
  }

  private _renderQuadrantDebug() {
    // Create 6 quadrant overlays for debugging
    const debugOverlay = document.createElement("div");
    debugOverlay.innerHTML = `
      <style>
        .quadrant-debug {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 9998;
        }

        .quadrant {
          position: absolute;
          border: 2px dashed rgba(255, 0, 0, 0.3);
          background: rgba(255, 0, 0, 0.05);
        }

        .quadrant-label {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 0, 0, 0.6);
          font-family: system-ui, -apple-system, sans-serif;
          text-align: center;
        }
      </style>

      <div class="quadrant-debug">
        <!-- Top Left -->
        <div class="quadrant" style="top: 0; left: 0; width: 33.333%; height: 50%;">
          <div class="quadrant-label">topLeft</div>
        </div>
        <!-- Top Center -->
        <div class="quadrant" style="top: 0; left: 33.333%; width: 33.333%; height: 50%;">
          <div class="quadrant-label">topCenter</div>
        </div>
        <!-- Top Right -->
        <div class="quadrant" style="top: 0; left: 66.666%; width: 33.333%; height: 50%;">
          <div class="quadrant-label">topRight</div>
        </div>
        <!-- Bottom Left -->
        <div class="quadrant" style="top: 50%; left: 0; width: 33.333%; height: 50%;">
          <div class="quadrant-label">bottomLeft</div>
        </div>
        <!-- Bottom Center -->
        <div class="quadrant" style="top: 50%; left: 33.333%; width: 33.333%; height: 50%;">
          <div class="quadrant-label">bottomCenter</div>
        </div>
        <!-- Bottom Right -->
        <div class="quadrant" style="top: 50%; left: 66.666%; width: 33.333%; height: 50%;">
          <div class="quadrant-label">bottomRight</div>
        </div>
      </div>
    `;

    this._shadowRoot.appendChild(debugOverlay);
  }

  private _removeTemplate() {
    // Clean up exit listener
    if (this._exitListener && this._currentTemplate) {
      this._currentTemplate.removeEventListener("reveal:exit-complete", this._exitListener);
      this._exitListener = null;
    }
    if (this._exitTimeout) {
      clearTimeout(this._exitTimeout);
      this._exitTimeout = null;
    }

    // Remove template
    if (this._currentTemplate) {
      this._currentTemplate.remove();
      this._currentTemplate = null;
    }
  }
}

// Register custom element
if (typeof customElements !== "undefined") {
  customElements.define("reveal-overlay-manager", RevealOverlayManager);
}
