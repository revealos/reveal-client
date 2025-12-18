/**
 * Unit tests for eventTransformer module
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { transformBaseEventToBackendFormat } from "../../modules/eventTransformer";
import type { BaseEvent } from "../../types/events";

describe("eventTransformer", () => {
  const mockPageContext = {
    url: "https://example.com/page",
    title: "Example Page",
    referrer: "https://example.com/referrer",
  };

  const baseOptions = {
    anonymousId: "anonymous-123",
    sdkVersion: "0.1.0",
    getPageContext: () => mockPageContext,
  };

  describe("transformBaseEventToBackendFormat", () => {
    it("should transform product event correctly", () => {
      const baseEvent: BaseEvent = {
        kind: "product",
        name: "button_clicked",
        event_source: "user",
        session_id: "session-123",
        is_treatment: null,
        timestamp: 1234567890000,
        path: "/page",
        route: null,
        screen: null,
        viewKey: "/page",
        user_agent: "Mozilla/5.0",
        viewport_width: 1920,
        viewport_height: 1080,
        payload: { button_text: "Click me" },
      };

      const result = transformBaseEventToBackendFormat(baseEvent, baseOptions);

      expect(result.event_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(result.session_id).toBe("session-123");
      expect(result.timestamp).toBe("2009-02-13T23:31:30.000Z");
      expect(result.event_kind).toBe("product");
      expect(result.event_type).toBe("button_clicked");
      expect(result.event_source).toBe("user");
      expect(result.anonymous_id).toBe("anonymous-123");
      expect(result.sdk_version).toBe("0.1.0");
      expect(result.properties).toEqual({ button_text: "Click me" });
      expect(result.page_url).toBe("https://example.com/page");
      expect(result.page_title).toBe("Example Page");
      expect(result.referrer).toBe("https://example.com/referrer");
      expect(result.friction_type).toBeNull();
      expect(result.user_key).toBeNull();
      expect(result.environment).toBeNull();
      expect(result.batch_id).toBeNull();
    });

    it("should transform friction event with required fields", () => {
      const baseEvent: BaseEvent = {
        kind: "friction",
        name: "friction_stall",
        event_source: "user",
        session_id: "session-123",
        is_treatment: null,
        timestamp: 1234567890000,
        path: "/page",
        route: null,
        screen: null,
        viewKey: "/page",
        user_agent: "Mozilla/5.0",
        viewport_width: 1920,
        viewport_height: 1080,
        payload: {
          selector: "#submit-button",
          pageUrl: "https://example.com/form",
          type: "stall",
        },
      };

      const result = transformBaseEventToBackendFormat(baseEvent, baseOptions);

      expect(result.event_kind).toBe("friction");
      expect(result.event_type).toBe("friction_stall");
      expect(result.selector).toBe("#submit-button");
      expect(result.page_url).toBe("https://example.com/form");
      expect(result.friction_type).toBe("stall");
    });

    it("should handle friction event with pageUrl fallback", () => {
      const baseEvent: BaseEvent = {
        kind: "friction",
        name: "friction_stall",
        event_source: "user",
        session_id: "session-123",
        is_treatment: null,
        timestamp: 1234567890000,
        path: "/page",
        route: null,
        screen: null,
        viewKey: "/page",
        user_agent: "Mozilla/5.0",
        viewport_width: 1920,
        viewport_height: 1080,
        payload: {
          selector: "#submit-button",
          type: "stall",
        },
      };

      const result = transformBaseEventToBackendFormat(baseEvent, baseOptions);

      expect(result.selector).toBe("#submit-button");
      expect(result.page_url).toBe("https://example.com/page"); // Falls back to pageContext.url
      expect(result.friction_type).toBe("stall");
    });

    it("should transform nudge event correctly", () => {
      const baseEvent: BaseEvent = {
        kind: "nudge",
        name: "nudge_shown",
        event_source: "system",
        session_id: "session-123",
        is_treatment: null,
        timestamp: 1234567890000,
        path: "/page",
        route: null,
        screen: null,
        viewKey: "/page",
        user_agent: "Mozilla/5.0",
        viewport_width: 1920,
        viewport_height: 1080,
        payload: { nudge_id: "nudge-123", template_id: "tooltip" },
      };

      const result = transformBaseEventToBackendFormat(baseEvent, baseOptions);

      expect(result.event_kind).toBe("nudge");
      expect(result.event_type).toBe("nudge_shown");
      expect(result.event_source).toBe("system");
      expect(result.properties).toEqual({ nudge_id: "nudge-123", template_id: "tooltip" });
      expect(result.friction_type).toBeNull();
    });

    it("should transform session event correctly", () => {
      const baseEvent: BaseEvent = {
        kind: "session",
        name: "session_start",
        event_source: "user",
        session_id: "session-123",
        is_treatment: null,
        timestamp: 1234567890000,
        path: "/page",
        route: null,
        screen: null,
        viewKey: "/page",
        user_agent: "Mozilla/5.0",
        viewport_width: 1920,
        viewport_height: 1080,
        payload: {},
      };

      const result = transformBaseEventToBackendFormat(baseEvent, baseOptions);

      expect(result.event_kind).toBe("session");
      expect(result.event_type).toBe("session_start");
      expect(result.properties).toBeNull(); // Empty payload becomes null
    });

    it("should handle empty payload", () => {
      const baseEvent: BaseEvent = {
        kind: "product",
        name: "button_clicked",
        event_source: "user",
        session_id: "session-123",
        is_treatment: null,
        timestamp: 1234567890000,
        path: "/page",
        route: null,
        screen: null,
        viewKey: "/page",
        user_agent: "Mozilla/5.0",
        viewport_width: 1920,
        viewport_height: 1080,
        payload: {},
      };

      const result = transformBaseEventToBackendFormat(baseEvent, baseOptions);

      expect(result.properties).toBeNull();
    });

    it("should extract element_text from payload", () => {
      const baseEvent: BaseEvent = {
        kind: "product",
        name: "button_clicked",
        event_source: "user",
        session_id: "session-123",
        is_treatment: null,
        timestamp: 1234567890000,
        path: "/page",
        route: null,
        screen: null,
        viewKey: "/page",
        user_agent: "Mozilla/5.0",
        viewport_width: 1920,
        viewport_height: 1080,
        payload: { element_text: "Click me", elementText: "Alternative" },
      };

      const result = transformBaseEventToBackendFormat(baseEvent, baseOptions);

      expect(result.element_text).toBe("Click me"); // Prefers element_text over elementText
    });

    it("should handle null page context", () => {
      const options = {
        ...baseOptions,
        getPageContext: () => ({
          url: null,
          title: null,
          referrer: null,
        }),
      };

      const baseEvent: BaseEvent = {
        kind: "product",
        name: "button_clicked",
        event_source: "user",
        session_id: "session-123",
        is_treatment: null,
        timestamp: 1234567890000,
        path: "/page",
        route: null,
        screen: null,
        viewKey: "/page",
        user_agent: "Mozilla/5.0",
        viewport_width: 1920,
        viewport_height: 1080,
        payload: {},
      };

      const result = transformBaseEventToBackendFormat(baseEvent, options);

      expect(result.page_url).toBeNull();
      expect(result.page_title).toBeNull();
      expect(result.referrer).toBeNull();
    });

    it("should generate unique event_id for each event", () => {
      const baseEvent: BaseEvent = {
        kind: "product",
        name: "button_clicked",
        event_source: "user",
        session_id: "session-123",
        is_treatment: null,
        timestamp: 1234567890000,
        path: "/page",
        route: null,
        screen: null,
        viewKey: "/page",
        user_agent: "Mozilla/5.0",
        viewport_width: 1920,
        viewport_height: 1080,
        payload: {},
      };

      const result1 = transformBaseEventToBackendFormat(baseEvent, baseOptions);
      const result2 = transformBaseEventToBackendFormat(baseEvent, baseOptions);

      expect(result1.event_id).not.toBe(result2.event_id);
    });

    it("should handle all friction types", () => {
      const frictionTypes: Array<"stall" | "rageclick" | "backtrack"> = ["stall", "rageclick", "backtrack"];

      frictionTypes.forEach((type) => {
        const baseEvent: BaseEvent = {
          kind: "friction",
          name: `friction_${type}`,
          event_source: "user",
          session_id: "session-123",
          is_treatment: null,
          timestamp: 1234567890000,
          path: "/page",
          route: null,
          screen: null,
          viewKey: "/page",
          user_agent: "Mozilla/5.0",
          viewport_width: 1920,
          viewport_height: 1080,
          payload: {
            selector: "#button",
            pageUrl: "https://example.com",
            type,
          },
        };

        const result = transformBaseEventToBackendFormat(baseEvent, baseOptions);
        expect(result.friction_type).toBe(type);
      });
    });
  });
});


