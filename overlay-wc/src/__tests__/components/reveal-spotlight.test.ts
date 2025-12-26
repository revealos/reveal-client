/**
 * RevealSpotlight Component Tests
 *
 * These tests verify the core spotlight Web Component behavior:
 * 1. Component registration and rendering
 * 2. Target element detection via selectorPattern
 * 3. Target-not-found handling (suppress render + immediate dismiss)
 * 4. Event emission (reveal:shown, reveal:dismiss)
 * 5. Dismissal triggers (click, focus, scroll, ESC)
 * 6. Idempotency guards
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RevealSpotlight } from "../../components/reveal-spotlight";
import type { NudgeDecision } from "../../types/nudge-decision";

describe("RevealSpotlight - Web Component", () => {
  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = "";

    // Mock getBoundingClientRect for target elements
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 100,
      width: 200,
      height: 100,
      bottom: 200,
      right: 300,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockDecision = (overrides?: Partial<NudgeDecision>): NudgeDecision => ({
    nudgeId: "test-spotlight-1",
    templateId: "spotlight",
    body: "Click here to get started",
    selectorPattern: "[data-testid='target']",
    quadrant: "bottomCenter",
    ...overrides,
  });

  describe("Component Registration", () => {
    it("registers as custom element", () => {
      expect(customElements.get("reveal-spotlight")).toBeDefined();
    });

    it("creates instance", () => {
      const element = document.createElement("reveal-spotlight");
      expect(element).toBeInstanceOf(RevealSpotlight);
    });
  });

  describe("Target Element Detection", () => {
    it("renders scrim with hole when target found", () => {
      // Create target element
      const target = document.createElement("div");
      target.setAttribute("data-testid", "target");
      document.body.appendChild(target);

      // Create spotlight
      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;
      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      // Check shadow root has scrim
      const shadowRoot = (spotlight as any)._shadowRoot;
      const scrim = shadowRoot.querySelector(".spotlight-scrim");
      expect(scrim).toBeTruthy();
    });

    it("renders caption when body is provided", () => {
      // Create target element
      const target = document.createElement("div");
      target.setAttribute("data-testid", "target");
      document.body.appendChild(target);

      // Create spotlight
      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;
      const decision = createMockDecision({ body: "Test caption" });
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      // Check caption exists
      const shadowRoot = (spotlight as any)._shadowRoot;
      const caption = shadowRoot.querySelector(".spotlight-caption");
      expect(caption).toBeTruthy();
      expect(caption?.textContent).toBe("Test caption");
    });

    it("does not render caption when body is missing", () => {
      // Create target element
      const target = document.createElement("div");
      target.setAttribute("data-testid", "target");
      document.body.appendChild(target);

      // Create spotlight
      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;
      const decision = createMockDecision({ body: undefined });
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      // Check caption does not exist
      const shadowRoot = (spotlight as any)._shadowRoot;
      const caption = shadowRoot.querySelector(".spotlight-caption");
      expect(caption).toBeFalsy();
    });

    it("emits dismiss with target_not_found when selector missing", async () => {
      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;

      const dismissPromise = new Promise<void>((resolve) => {
        spotlight.addEventListener("reveal:dismiss", (e: Event) => {
          const detail = (e as CustomEvent).detail;
          expect(detail.reason).toBe("target_not_found");
          resolve();
        });
      });

      const decision = createMockDecision({ selectorPattern: undefined });
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      await dismissPromise;
    });

    it("emits dismiss with target_not_found when element not found", async () => {
      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;

      const dismissPromise = new Promise<void>((resolve) => {
        spotlight.addEventListener("reveal:dismiss", (e: Event) => {
          const detail = (e as CustomEvent).detail;
          expect(detail.reason).toBe("target_not_found");
          resolve();
        });
      });

      // Don't create target element - selector won't match
      const decision = createMockDecision({ selectorPattern: "[data-testid='nonexistent']" });
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      await dismissPromise;
    });

    it("does not render scrim when target not found", () => {
      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;
      const decision = createMockDecision({ selectorPattern: "[data-testid='nonexistent']" });
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      // Check shadow root has no scrim
      const shadowRoot = (spotlight as any)._shadowRoot;
      const scrim = shadowRoot?.querySelector(".spotlight-scrim");
      expect(scrim).toBeFalsy();
    });
  });

  describe("Event Emission", () => {
    it("emits reveal:shown once on mount", async () => {
      // Create target element
      const target = document.createElement("div");
      target.setAttribute("data-testid", "target");
      document.body.appendChild(target);

      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;
      let shownCount = 0;

      const shownPromise = new Promise<void>((resolve) => {
        spotlight.addEventListener("reveal:shown", (e: Event) => {
          shownCount++;
          const detail = (e as CustomEvent).detail;
          expect(detail.id).toBe("test-spotlight-1");

          // Wait a bit to ensure no duplicate events
          setTimeout(() => {
            expect(shownCount).toBe(1);
            resolve();
          }, 50);
        });
      });

      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      await shownPromise;
    });

    it("emits reveal:dismiss with click_outside reason", async () => {
      // Create target element
      const target = document.createElement("div");
      target.setAttribute("data-testid", "target");
      document.body.appendChild(target);

      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;

      const dismissPromise = new Promise<void>((resolve) => {
        spotlight.addEventListener("reveal:dismiss", (e: Event) => {
          const detail = (e as CustomEvent).detail;
          expect(detail.id).toBe("test-spotlight-1");
          expect(detail.reason).toBe("click_outside");
          resolve();
        });
      });

      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      // Wait longer for requestAnimationFrame to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
      document.body.click();

      await dismissPromise;
    });
  });

  describe("Dismissal Triggers", () => {
    it("dismisses on ESC key", async () => {
      // Create target element
      const target = document.createElement("div");
      target.setAttribute("data-testid", "target");
      document.body.appendChild(target);

      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;

      const dismissPromise = new Promise<void>((resolve) => {
        spotlight.addEventListener("reveal:dismiss", (e: Event) => {
          const detail = (e as CustomEvent).detail;
          expect(detail.reason).toBe("esc");
          resolve();
        });
      });

      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      // Wait longer for requestAnimationFrame to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
      const event = new KeyboardEvent("keydown", { key: "Escape" });
      window.dispatchEvent(event);

      await dismissPromise;
    });

    it("dismisses on focus", async () => {
      // Create target element
      const target = document.createElement("div");
      target.setAttribute("data-testid", "target");
      document.body.appendChild(target);

      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;

      const dismissPromise = new Promise<void>((resolve) => {
        spotlight.addEventListener("reveal:dismiss", (e: Event) => {
          const detail = (e as CustomEvent).detail;
          expect(detail.reason).toBe("focus");
          resolve();
        });
      });

      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      // Wait longer for requestAnimationFrame to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      await dismissPromise;
    });
  });

  describe("Idempotency", () => {
    it("only emits dismiss event once", async () => {
      // Create target element
      const target = document.createElement("div");
      target.setAttribute("data-testid", "target");
      document.body.appendChild(target);

      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;
      let dismissCount = 0;

      spotlight.addEventListener("reveal:dismiss", () => {
        dismissCount++;
      });

      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      // Wait longer for requestAnimationFrame to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
      document.body.click();
      document.body.click();
      const event = new KeyboardEvent("keydown", { key: "Escape" });
      window.dispatchEvent(event);

      // Wait and check count
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(dismissCount).toBe(1);
    });
  });

  describe("Cleanup", () => {
    it("removes event listeners on disconnect", () => {
      // Create target element
      const target = document.createElement("div");
      target.setAttribute("data-testid", "target");
      document.body.appendChild(target);

      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;
      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      // Remove from DOM
      spotlight.remove();

      // Try to trigger dismiss - should not fire
      let dismissFired = false;
      spotlight.addEventListener("reveal:dismiss", () => {
        dismissFired = true;
      });

      document.body.click();

      setTimeout(() => {
        expect(dismissFired).toBe(false);
      }, 50);
    });
  });

  describe("Target Click Tracking", () => {
    it("dispatches reveal:action-click when target element is clicked", async () => {
      // Create target element
      const target = document.createElement("button");
      target.setAttribute("data-testid", "target");
      target.textContent = "Click me";
      document.body.appendChild(target);

      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;

      let actionClickFired = false;
      let actionClickDetail: any = null;

      spotlight.addEventListener("reveal:action-click", (e: Event) => {
        actionClickFired = true;
        actionClickDetail = (e as CustomEvent).detail;
      });

      // Ensure dismiss event does NOT fire
      let dismissFired = false;
      spotlight.addEventListener("reveal:dismiss", () => {
        dismissFired = true;
      });

      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      // Wait for requestAnimationFrame
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Click the target element
      target.click();

      // Wait for event propagation
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(actionClickFired).toBe(true);
      expect(actionClickDetail.id).toBe("test-spotlight-1");
      expect(dismissFired).toBe(false); // Should NOT dismiss on target click
    });

    it("dispatches reveal:action-click when clicking child of target element", async () => {
      // Create target element with child
      const target = document.createElement("div");
      target.setAttribute("data-testid", "target");
      const child = document.createElement("span");
      child.textContent = "Click me";
      target.appendChild(child);
      document.body.appendChild(target);

      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;

      let actionClickFired = false;
      spotlight.addEventListener("reveal:action-click", () => {
        actionClickFired = true;
      });

      let dismissFired = false;
      spotlight.addEventListener("reveal:dismiss", () => {
        dismissFired = true;
      });

      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Click the child element
      child.click();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(actionClickFired).toBe(true);
      expect(dismissFired).toBe(false);
    });

    it("still dismisses when clicking outside target element", async () => {
      // Create target element
      const target = document.createElement("div");
      target.setAttribute("data-testid", "target");
      document.body.appendChild(target);

      // Create element OUTSIDE target
      const outsideElement = document.createElement("div");
      outsideElement.id = "outside";
      document.body.appendChild(outsideElement);

      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;

      let actionClickFired = false;
      spotlight.addEventListener("reveal:action-click", () => {
        actionClickFired = true;
      });

      let dismissFired = false;
      let dismissReason: string | null = null;
      spotlight.addEventListener("reveal:dismiss", (e: Event) => {
        dismissFired = true;
        dismissReason = (e as CustomEvent).detail.reason;
      });

      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Click outside element
      outsideElement.click();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(actionClickFired).toBe(false); // Should NOT fire action-click
      expect(dismissFired).toBe(true);
      expect(dismissReason).toBe("click_outside");
    });

    it("only fires reveal:action-click once per target click (idempotency)", async () => {
      const target = document.createElement("button");
      target.setAttribute("data-testid", "target");
      document.body.appendChild(target);

      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;

      let actionClickCount = 0;
      spotlight.addEventListener("reveal:action-click", () => {
        actionClickCount++;
      });

      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Click target multiple times
      target.click();
      target.click();
      target.click();

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should only fire once due to _isDismissed guard
      expect(actionClickCount).toBe(1);
    });

    it("cleans up target element reference on disconnect", () => {
      const target = document.createElement("div");
      target.setAttribute("data-testid", "target");
      document.body.appendChild(target);

      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;
      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      // Verify target element reference exists
      expect((spotlight as any)._targetElement).toBe(target);

      // Disconnect
      spotlight.remove();

      // Verify cleanup
      expect((spotlight as any)._targetElement).toBeNull();
    });

    it("allows click-through on target element (does not require second click)", async () => {
      // Create target element with click handler
      const target = document.createElement("button");
      target.setAttribute("data-testid", "target");
      target.textContent = "Click me";
      document.body.appendChild(target);

      let targetClicked = false;
      target.addEventListener("click", () => {
        targetClicked = true;
      });

      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;

      let actionClickFired = false;
      spotlight.addEventListener("reveal:action-click", () => {
        actionClickFired = true;
      });

      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Single click on target element
      target.click();

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Both spotlight tracking AND underlying element click should fire
      expect(actionClickFired).toBe(true); // Spotlight tracked the click
      expect(targetClicked).toBe(true); // Underlying element received the click (no second click needed)
    });

    it("detects target click using composedPath", async () => {
      // Create target element with child
      const target = document.createElement("div");
      target.setAttribute("data-testid", "target");
      const child = document.createElement("button");
      child.textContent = "Click";
      target.appendChild(child);
      document.body.appendChild(target);

      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;

      let actionClickFired = false;
      spotlight.addEventListener("reveal:action-click", () => {
        actionClickFired = true;
      });

      let dismissFired = false;
      spotlight.addEventListener("reveal:dismiss", () => {
        dismissFired = true;
      });

      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Create a click event with composedPath
      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        composed: true,
      });

      // Mock composedPath to return path including target
      Object.defineProperty(clickEvent, "composedPath", {
        value: () => [child, target, document.body, document.documentElement, document, window],
        writable: false,
      });

      Object.defineProperty(clickEvent, "target", {
        value: child,
        writable: false,
      });

      // Dispatch the event
      child.dispatchEvent(clickEvent);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should detect as target click via composedPath
      expect(actionClickFired).toBe(true);
      expect(dismissFired).toBe(false);
    });

    it("does NOT dismiss when target element is focused", async () => {
      // Create focusable target element
      const target = document.createElement("button");
      target.setAttribute("data-testid", "target");
      target.textContent = "Focus me";
      document.body.appendChild(target);

      const spotlight = document.createElement("reveal-spotlight") as RevealSpotlight;

      let dismissFired = false;
      spotlight.addEventListener("reveal:dismiss", () => {
        dismissFired = true;
      });

      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Focus the target element
      target.focus();

      // Dispatch focusin event manually to ensure it fires
      const focusEvent = new FocusEvent("focusin", {
        bubbles: true,
        composed: true,
      });
      Object.defineProperty(focusEvent, "target", {
        value: target,
        writable: false,
      });
      target.dispatchEvent(focusEvent);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should NOT dismiss when target is focused
      expect(dismissFired).toBe(false);
    });

    it("DOES dismiss when element outside target is focused", async () => {
      // Create target element
      const target = document.createElement("button");
      target.setAttribute("data-testid", "target");
      document.body.appendChild(target);

      // Create element outside target
      const outsideInput = document.createElement("input");
      outsideInput.id = "outside-input";
      document.body.appendChild(outsideInput);

      const spotlight = document.createElement("reveal-spotlight") as unknown as RevealSpotlight;

      let dismissFired = false;
      let dismissReason: string | null = null;
      spotlight.addEventListener("reveal:dismiss", (e: Event) => {
        dismissFired = true;
        dismissReason = (e as CustomEvent).detail.reason;
      });

      const decision = createMockDecision();
      spotlight.decision = decision;
      document.body.appendChild(spotlight as unknown as Node);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Focus element outside target
      outsideInput.focus();

      // Dispatch focusin event
      const focusEvent = new FocusEvent("focusin", {
        bubbles: true,
        composed: true,
      });
      Object.defineProperty(focusEvent, "target", {
        value: outsideInput,
        writable: false,
      });
      outsideInput.dispatchEvent(focusEvent);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should dismiss when focus goes outside target
      expect(dismissFired).toBe(true);
      expect(dismissReason).toBe("focus");
    });
  });
});
