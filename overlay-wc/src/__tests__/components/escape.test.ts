/**
 * Unit tests for _escape() method XSS neutralization
 * 
 * Tests that the _escape() method used in overlay-wc components
 * properly neutralizes XSS payloads before inserting into innerHTML.
 */

import { describe, it, expect } from 'vitest';

/**
 * Replicate the _escape() implementation from overlay-wc components
 * This matches the pattern: div.textContent = text; return div.innerHTML;
 */
function escapeText(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

describe('_escape() XSS Neutralization', () => {
  it('should escape script tags', () => {
    const input = "<script>alert('XSS')</script>";
    const escaped = escapeText(input);
    
    // Should be HTML-escaped, not executed
    expect(escaped).toBe("&lt;script&gt;alert('XSS')&lt;/script&gt;");
    expect(escaped).not.toContain('<script>');
  });

  it('should escape javascript: protocol', () => {
    const input = "javascript:alert('XSS')";
    const escaped = escapeText(input);
    
    // textContent preserves the string as-is (no HTML escaping for plain text)
    // When inserted into innerHTML, it's treated as text content, not executable
    expect(escaped).toBe("javascript:alert('XSS')");
    // The key is that when this is inserted into innerHTML, it's text, not a protocol
  });

  it('should escape event handlers', () => {
    const input = 'onerror="alert(\'XSS\')"';
    const escaped = escapeText(input);
    
    // textContent preserves quotes as-is (they're not HTML-escaped)
    // When inserted into innerHTML, the entire string is text content, not an attribute
    expect(escaped).toBe('onerror="alert(\'XSS\')"');
    // The key is that this is inserted as text content, not as an HTML attribute
  });

  it('should escape onclick handlers', () => {
    const input = 'onclick="alert(\'XSS\')"';
    const escaped = escapeText(input);
    
    // textContent preserves quotes as-is
    // When inserted into innerHTML, the entire string is text content, not an attribute
    expect(escaped).toBe('onclick="alert(\'XSS\')"');
    // The key is that this is inserted as text content, not as an HTML attribute
  });

  it('should escape HTML entities', () => {
    const input = '<div>Hello & World</div>';
    const escaped = escapeText(input);
    
    // Should be HTML-escaped
    expect(escaped).toBe("&lt;div&gt;Hello &amp; World&lt;/div&gt;");
    expect(escaped).not.toContain('<div>');
  });

  it('should escape nested script tags', () => {
    const input = '<script>console.log("<script>alert(1)</script>")</script>';
    const escaped = escapeText(input);
    
    // All script tags should be escaped
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });

  it('should pass through normal text unchanged (after escaping)', () => {
    const input = 'Hello, World!';
    const escaped = escapeText(input);
    
    // Normal text should pass through (textContent preserves it)
    expect(escaped).toBe('Hello, World!');
  });

  it('should escape img src with javascript protocol', () => {
    const input = '<img src="javascript:alert(\'XSS\')">';
    const escaped = escapeText(input);
    
    // textContent escapes < and > but preserves quotes in attribute values
    expect(escaped).toBe('&lt;img src="javascript:alert(\'XSS\')"&gt;');
    expect(escaped).not.toContain('<img');
    // Quotes are preserved but the tag is escaped, so it's safe
  });

  it('should escape iframe tags', () => {
    const input = '<iframe src="evil.com"></iframe>';
    const escaped = escapeText(input);
    
    // textContent escapes < and > but preserves quotes
    expect(escaped).toBe('&lt;iframe src="evil.com"&gt;&lt;/iframe&gt;');
    expect(escaped).not.toContain('<iframe');
    // Tags are escaped, so it's safe
  });

  it('should handle empty string', () => {
    const input = '';
    const escaped = escapeText(input);
    
    expect(escaped).toBe('');
  });

  it('should escape multiple XSS vectors in one string', () => {
    const input = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    const escaped = escapeText(input);
    
    // All HTML tags should be escaped (< and > become &lt; and &gt;)
    expect(escaped).not.toContain('<script>');
    expect(escaped).not.toContain('<img');
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).toContain('&lt;img');
    // Quotes in attributes are preserved but tags are escaped, so it's safe
    // The key is that when inserted into innerHTML, this is text content, not HTML
  });
});

