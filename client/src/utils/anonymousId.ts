/**
 * Anonymous ID Utility
 * 
 * Manages persistent anonymous user identification across sessions.
 * 
 * Responsibilities:
 * - Generate and store anonymous ID in localStorage
 * - Return existing ID if present, generate new if missing
 * - Handle localStorage unavailable (fallback to session-only ID)
 * 
 * @module utils/anonymousId
 */

const STORAGE_KEY = "reveal_anonymous_id";

/**
 * Generate a UUID v4
 * Uses crypto.randomUUID if available, falls back to manual generation
 */
function generateUUID(): string {
  // Try crypto.randomUUID (modern browsers)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: simple UUID v4 generation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create a persistent anonymous ID
 * 
 * - Returns existing ID from localStorage if present
 * - Generates and stores new ID if missing
 * - Falls back to session-only ID if localStorage unavailable
 * 
 * @returns Anonymous ID (UUID v4)
 */
export function getOrCreateAnonymousId(): string {
  // Try to get from localStorage
  try {
    if (typeof localStorage !== "undefined") {
      const existingId = localStorage.getItem(STORAGE_KEY);
      if (existingId && typeof existingId === "string" && existingId.length > 0) {
        return existingId;
      }

      // Generate new ID and store
      const newId = generateUUID();
      localStorage.setItem(STORAGE_KEY, newId);
      return newId;
    }
  } catch (error) {
    // localStorage may be disabled or unavailable (private browsing, etc.)
    // Fall through to session-only ID
  }

  // Fallback: generate session-only ID (not persisted)
  // Note: This means the ID will change on page reload if localStorage is unavailable
  return generateUUID();
}

/**
 * Generate a new anonymous ID (for testing or reset purposes)
 * 
 * @returns New anonymous ID (UUID v4)
 */
export function generateAnonymousId(): string {
  return generateUUID();
}


