/**
 * Sanitization utilities for trace request metadata
 *
 * SOC2 Compliance:
 * - Reason: max 64 characters
 * - Meta: primitives only (string, number, boolean, null), max 2KB
 */

const MAX_REASON_LENGTH = 64;
const MAX_META_SIZE_BYTES = 2048;

/**
 * Sanitize reason string
 *
 * @param reason - Optional reason string
 * @returns Sanitized reason (truncated to 64 chars) or null
 */
export function sanitizeReason(reason?: string): string | null {
  if (!reason || typeof reason !== 'string') {
    return null;
  }

  const trimmed = reason.trim();
  if (trimmed === '') {
    return null;
  }

  // Truncate to max length
  return trimmed.length > MAX_REASON_LENGTH
    ? trimmed.substring(0, MAX_REASON_LENGTH)
    : trimmed;
}

/**
 * Sanitize metadata object
 *
 * Enforces:
 * - Primitives only (string, number, boolean, null)
 * - No nested objects or arrays
 * - Max 2KB serialized size
 *
 * @param meta - Optional metadata object
 * @returns Sanitized meta (primitives only) or null
 */
export function sanitizeMeta(
  meta?: any
): Record<string, string | number | boolean | null> | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return null;
  }

  const sanitized: Record<string, string | number | boolean | null> = {};

  // Filter to primitives only
  for (const [key, value] of Object.entries(meta)) {
    const valueType = typeof value;

    if (
      value === null ||
      valueType === 'string' ||
      valueType === 'number' ||
      valueType === 'boolean'
    ) {
      sanitized[key] = value as string | number | boolean | null;
    }
    // Drop nested objects, arrays, functions, etc.
  }

  // Check if we have any valid keys
  if (Object.keys(sanitized).length === 0) {
    return null;
  }

  // Check serialized size
  const serialized = JSON.stringify(sanitized);
  const sizeBytes = new TextEncoder().encode(serialized).length;

  if (sizeBytes > MAX_META_SIZE_BYTES) {
    return null; // Drop if too large
  }

  return sanitized;
}
