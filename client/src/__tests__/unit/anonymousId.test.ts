/**
 * Unit tests for anonymousId utility
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getOrCreateAnonymousId, generateAnonymousId } from "../../utils/anonymousId";

describe("anonymousId", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  describe("getOrCreateAnonymousId", () => {
    it("should generate a UUID v4 format", () => {
      const id = getOrCreateAnonymousId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it("should return the same ID on subsequent calls", () => {
      const id1 = getOrCreateAnonymousId();
      const id2 = getOrCreateAnonymousId();
      expect(id1).toBe(id2);
    });

    it("should persist ID in localStorage", () => {
      const id1 = getOrCreateAnonymousId();
      expect(localStorage.getItem("reveal_anonymous_id")).toBe(id1);
    });

    it("should retrieve existing ID from localStorage", () => {
      const storedId = "12345678-1234-4123-8123-123456789012";
      localStorage.setItem("reveal_anonymous_id", storedId);
      const retrievedId = getOrCreateAnonymousId();
      expect(retrievedId).toBe(storedId);
    });

    it("should handle localStorage unavailable gracefully", () => {
      // Mock localStorage to throw errors
      const originalLocalStorage = global.localStorage;
      Object.defineProperty(global, "localStorage", {
        value: {
          getItem: vi.fn(() => {
            throw new Error("localStorage unavailable");
          }),
          setItem: vi.fn(() => {
            throw new Error("localStorage unavailable");
          }),
        },
        writable: true,
      });

      // Should still generate an ID (session-only)
      const id = getOrCreateAnonymousId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

      // Restore localStorage
      Object.defineProperty(global, "localStorage", {
        value: originalLocalStorage,
        writable: true,
      });
    });

    it("should handle localStorage getItem returning null", () => {
      // Clear localStorage first
      localStorage.removeItem("reveal_anonymous_id");
      
      // Mock getItem to return null (simulating missing key)
      const getItemSpy = vi.spyOn(localStorage, "getItem").mockImplementation((key: string) => {
        if (key === "reveal_anonymous_id") {
          return null;
        }
        return localStorage.getItem(key);
      });
      
      // Call function - should generate new ID when getItem returns null
      const id1 = getOrCreateAnonymousId();
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      
      // Verify ID was stored (second call should return same ID)
      getItemSpy.mockRestore();
      const id2 = getOrCreateAnonymousId();
      expect(id2).toBe(id1); // Should be same ID from storage

      getItemSpy.mockRestore();
    });

    it("should handle localStorage getItem returning empty string", () => {
      // Clear localStorage first
      localStorage.removeItem("reveal_anonymous_id");
      
      // Mock getItem to return empty string (simulating invalid stored value)
      const getItemSpy = vi.spyOn(localStorage, "getItem").mockImplementation((key: string) => {
        if (key === "reveal_anonymous_id") {
          return "";
        }
        return localStorage.getItem(key);
      });

      // Call function - should generate new ID when getItem returns empty string
      const id1 = getOrCreateAnonymousId();
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      
      // Verify ID was stored (second call should return same ID)
      getItemSpy.mockRestore();
      const id2 = getOrCreateAnonymousId();
      expect(id2).toBe(id1); // Should be same ID from storage

      getItemSpy.mockRestore();
    });
  });

  describe("generateAnonymousId", () => {
    it("should generate a UUID v4 format", () => {
      const id = generateAnonymousId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it("should generate unique IDs", () => {
      const id1 = generateAnonymousId();
      const id2 = generateAnonymousId();
      expect(id1).not.toBe(id2);
    });
  });
});


