/**
 * Tests for sanitization utilities
 */

import { sanitizeReason, sanitizeMeta } from '../../utils/sanitize';

describe('sanitizeReason', () => {
  it('should return null for undefined input', () => {
    expect(sanitizeReason(undefined)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(sanitizeReason('')).toBeNull();
    expect(sanitizeReason('   ')).toBeNull();
  });

  it('should return null for non-string input', () => {
    expect(sanitizeReason(123 as any)).toBeNull();
    expect(sanitizeReason({} as any)).toBeNull();
    expect(sanitizeReason([] as any)).toBeNull();
  });

  it('should return trimmed string for valid input', () => {
    expect(sanitizeReason('  test reason  ')).toBe('test reason');
    expect(sanitizeReason('valid')).toBe('valid');
  });

  it('should truncate strings longer than 64 characters', () => {
    const longString = 'a'.repeat(100);
    const result = sanitizeReason(longString);
    expect(result).toBe('a'.repeat(64));
    expect(result?.length).toBe(64);
  });

  it('should preserve strings exactly 64 characters', () => {
    const exactString = 'a'.repeat(64);
    expect(sanitizeReason(exactString)).toBe(exactString);
  });
});

describe('sanitizeMeta', () => {
  it('should return null for undefined input', () => {
    expect(sanitizeMeta(undefined)).toBeNull();
  });

  it('should return null for null input', () => {
    expect(sanitizeMeta(null)).toBeNull();
  });

  it('should return null for non-object input', () => {
    expect(sanitizeMeta('string' as any)).toBeNull();
    expect(sanitizeMeta(123 as any)).toBeNull();
    expect(sanitizeMeta(true as any)).toBeNull();
  });

  it('should return null for array input', () => {
    expect(sanitizeMeta([1, 2, 3] as any)).toBeNull();
  });

  it('should return null for empty object', () => {
    expect(sanitizeMeta({})).toBeNull();
  });

  it('should preserve primitives (string, number, boolean, null)', () => {
    const input = {
      str: 'test',
      num: 42,
      bool: true,
      nullVal: null,
    };
    const result = sanitizeMeta(input);
    expect(result).toEqual(input);
  });

  it('should drop nested objects', () => {
    const input = {
      valid: 'string',
      nested: { foo: 'bar' },
      alsoValid: 123,
    };
    const result = sanitizeMeta(input);
    expect(result).toEqual({
      valid: 'string',
      alsoValid: 123,
    });
  });

  it('should drop arrays', () => {
    const input = {
      valid: 'string',
      arr: [1, 2, 3],
      num: 42,
    };
    const result = sanitizeMeta(input);
    expect(result).toEqual({
      valid: 'string',
      num: 42,
    });
  });

  it('should drop functions', () => {
    const input = {
      valid: 'string',
      fn: () => {},
      num: 42,
    };
    const result = sanitizeMeta(input);
    expect(result).toEqual({
      valid: 'string',
      num: 42,
    });
  });

  it('should drop undefined values', () => {
    const input = {
      valid: 'string',
      undef: undefined,
      num: 42,
    };
    const result = sanitizeMeta(input);
    expect(result).toEqual({
      valid: 'string',
      num: 42,
    });
  });

  it('should return null if all values are dropped', () => {
    const input = {
      nested: { foo: 'bar' },
      arr: [1, 2, 3],
      fn: () => {},
    };
    const result = sanitizeMeta(input);
    expect(result).toBeNull();
  });

  it('should return null if serialized size exceeds 2KB', () => {
    // Create object that exceeds 2KB when serialized
    const largeValue = 'x'.repeat(3000);
    const input = {
      large: largeValue,
    };
    const result = sanitizeMeta(input);
    expect(result).toBeNull();
  });

  it('should preserve object under 2KB', () => {
    const input = {
      str: 'test',
      num: 42,
      bool: true,
    };
    const result = sanitizeMeta(input);
    expect(result).toEqual(input);

    // Verify size is under 2KB
    const serialized = JSON.stringify(input);
    const sizeBytes = new TextEncoder().encode(serialized).length;
    expect(sizeBytes).toBeLessThan(2048);
  });

  it('should handle mixed primitives and complex types', () => {
    const input = {
      validStr: 'test',
      validNum: 42,
      validBool: true,
      validNull: null,
      invalidObj: { nested: 'value' },
      invalidArr: [1, 2, 3],
      invalidFn: () => {},
      invalidUndef: undefined,
    };
    const result = sanitizeMeta(input);
    expect(result).toEqual({
      validStr: 'test',
      validNum: 42,
      validBool: true,
      validNull: null,
    });
  });
});
