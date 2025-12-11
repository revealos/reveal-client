/**
 * Input Validation
 * 
 * Validates and sanitizes all inputs to prevent injection attacks
 * and ensure data integrity.
 * 
 * @module security/inputValidation
 */

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  field?: string;
}

/**
 * Validate event payload structure and content
 * 
 * @param payload - Event payload to validate
 * @returns Validation result
 */
export function validateEventPayload(payload: unknown): ValidationResult {
  // TODO: Validate payload structure
  // TODO: Check for required fields
  // TODO: Validate field types
  // TODO: Check size limits
  return { valid: false };
}

/**
 * Sanitize string input to prevent XSS
 * 
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  // TODO: Implement string sanitization
  // TODO: Remove dangerous characters
  // TODO: Encode HTML entities if needed
  return input;
}

/**
 * Validate client key format
 * 
 * @param key - Client key to validate
 * @returns True if valid
 */
export function validateClientKey(key: string): boolean {
  // TODO: Validate key format
  // TODO: Check length constraints
  // TODO: Validate character set
  return false;
}

/**
 * Validate that a URL uses HTTPS protocol
 * 
 * Security requirement: All backend URLs must use HTTPS to ensure encrypted communication.
 * Exception: localhost and 127.0.0.1 are allowed with HTTP for local development.
 * 
 * @param url - URL to validate
 * @returns Validation result
 */
export function validateHttpsUrl(url: string): ValidationResult {
  if (!url || typeof url !== "string") {
    return {
      valid: false,
      error: "URL must be a non-empty string",
      field: "url",
    };
  }

  // Trim whitespace
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return {
      valid: false,
      error: "URL cannot be empty",
      field: "url",
    };
  }

  try {
    // Parse URL to extract protocol and hostname
    const urlObj = new URL(trimmedUrl);
    const protocol = urlObj.protocol.toLowerCase();
    let hostname = urlObj.hostname.toLowerCase();

    // Handle IPv6 addresses (remove brackets)
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
      hostname = hostname.slice(1, -1);
    }

    // HTTPS is always valid
    if (protocol === "https:") {
      return { valid: true };
    }

    // HTTP is only valid for localhost/127.0.0.1 (development exception)
    if (protocol === "http:") {
      // Check for localhost variants
      const isLocalhost = 
        hostname === "localhost" || 
        hostname === "127.0.0.1" || 
        hostname === "::1" ||
        hostname === "0:0:0:0:0:0:0:1";
      
      if (isLocalhost) {
        return { valid: true };
      }
      
      return {
        valid: false,
        error: `URL must use HTTPS protocol: ${trimmedUrl}. Non-HTTPS URLs are only allowed for localhost in development.`,
        field: "url",
      };
    }

    // Other protocols (ftp:, ws:, etc.) are invalid
    return {
      valid: false,
      error: `URL must use HTTPS protocol: ${trimmedUrl}`,
      field: "url",
    };
  } catch (error) {
    // Invalid URL format
    return {
      valid: false,
      error: `Invalid URL format: ${trimmedUrl}`,
      field: "url",
    };
  }
}

/**
 * Validate all backend URLs are HTTPS (with localhost exception)
 * 
 * Validates ingest endpoint, decision endpoint, and apiBase (if provided).
 * Returns first validation failure or success if all pass.
 * 
 * @param urls - Object containing all backend URLs to validate
 * @returns Validation result
 */
export function validateAllBackendUrls(urls: {
  ingestEndpoint: string;
  decisionEndpoint: string;
  apiBase?: string;
}): ValidationResult {
  // Validate ingest endpoint
  const ingestValidation = validateHttpsUrl(urls.ingestEndpoint);
  if (!ingestValidation.valid) {
    return {
      valid: false,
      error: `Ingest endpoint ${ingestValidation.error}`,
      field: "ingestEndpoint",
    };
  }

  // Validate decision endpoint
  const decisionValidation = validateHttpsUrl(urls.decisionEndpoint);
  if (!decisionValidation.valid) {
    return {
      valid: false,
      error: `Decision endpoint ${decisionValidation.error}`,
      field: "decisionEndpoint",
    };
  }

  // Validate apiBase if provided
  if (urls.apiBase && typeof urls.apiBase === "string") {
    const apiBaseValidation = validateHttpsUrl(urls.apiBase);
    if (!apiBaseValidation.valid) {
      return {
        valid: false,
        error: `API base URL ${apiBaseValidation.error}`,
        field: "apiBase",
      };
    }
  }

  // All URLs valid
  return { valid: true };
}

