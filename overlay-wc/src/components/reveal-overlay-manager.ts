/**
 * RevealOverlayManager Web Component
 *
 * Main routing component that renders the appropriate nudge template
 * based on the templateId in the decision.
 *
 * Currently supports:
 * - tooltip (fully implemented)
 * - modal, banner, spotlight, inline_hint (not yet implemented)
 */

import type { NudgeDecision } from "../types/nudge-decision";
import { RevealTooltipNudge } from "./reveal-tooltip-nudge";

// Conditional base class to support SSR
const HTMLElementBase = (typeof HTMLElement !== 'undefined' ? HTMLElement : Object) as typeof HTMLElement;

export class RevealOverlayManager extends HTMLElementBase {
  private _decision: NudgeDecision | null = null;
  private _shadowRoot: ShadowRoot;
  private _currentTemplate: HTMLElement | null = null;

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
    this._render();
  }

  connectedCallback() {
    if (this._decision) {
      this._render();
    }
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === "show-quadrants") {
      this._render();
    }
  }

  private _render() {
    // Clear existing template
    if (this._currentTemplate) {
      this._currentTemplate.remove();
      this._currentTemplate = null;
    }

    if (!this._decision) {
      this._shadowRoot.innerHTML = "";
      return;
    }

    // Route to template
    const templateId = this._decision.templateId;

    if (templateId === "tooltip") {
      const tooltip = document.createElement("reveal-tooltip-nudge") as RevealTooltipNudge;
      tooltip.decision = this._decision;

      // Forward events from template to manager
      tooltip.addEventListener("reveal:dismiss", (e: Event) => {
        const customEvent = e as CustomEvent;
        this.dispatchEvent(
          new CustomEvent("reveal:dismiss", {
            detail: customEvent.detail,
            bubbles: true,
            composed: true,
          })
        );
      });

      tooltip.addEventListener("reveal:action-click", (e: Event) => {
        const customEvent = e as CustomEvent;
        this.dispatchEvent(
          new CustomEvent("reveal:action-click", {
            detail: customEvent.detail,
            bubbles: true,
            composed: true,
          })
        );
      });

      tooltip.addEventListener("reveal:shown", (e: Event) => {
        const customEvent = e as CustomEvent;
        this.dispatchEvent(
          new CustomEvent("reveal:shown", {
            detail: customEvent.detail,
            bubbles: true,
            composed: true,
          })
        );
      });

      this._currentTemplate = tooltip;
      this._shadowRoot.appendChild(tooltip);
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
}

// Register custom element
if (typeof customElements !== "undefined") {
  customElements.define("reveal-overlay-manager", RevealOverlayManager);
}
