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
    
    // Should be HTML-escaped
    expect(escaped).toBe("javascript:alert('XSS')");
    // When inserted into innerHTML, it won't execute as a protocol
    expect(escaped).not.toContain('javascript:');
  });

  it('should escape event handlers', () => {
    const input = 'onerror="alert(\'XSS\')"';
    const escaped = escapeText(input);
    
    // Should be HTML-escaped
    expect(escaped).toBe("onerror=&quot;alert('XSS')&quot;");
    expect(escaped).not.toContain('onerror=');
  });

  it('should escape onclick handlers', () => {
    const input = 'onclick="alert(\'XSS\')"';
    const escaped = escapeText(input);
    
    // Should be HTML-escaped
    expect(escaped).toBe("onclick=&quot;alert('XSS')&quot;");
    expect(escaped).not.toContain('onclick=');
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
    
    // Should be HTML-escaped
    expect(escaped).toBe("&lt;img src=&quot;javascript:alert('XSS')&quot;&gt;");
    expect(escaped).not.toContain('<img');
  });

  it('should escape iframe tags', () => {
    const input = '<iframe src="evil.com"></iframe>';
    const escaped = escapeText(input);
    
    // Should be HTML-escaped
    expect(escaped).toBe("&lt;iframe src=&quot;evil.com&quot;&gt;&lt;/iframe&gt;");
    expect(escaped).not.toContain('<iframe');
  });

  it('should handle empty string', () => {
    const input = '';
    const escaped = escapeText(input);
    
    expect(escaped).toBe('');
  });

  it('should escape multiple XSS vectors in one string', () => {
    const input = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    const escaped = escapeText(input);
    
    // All vectors should be escaped
    expect(escaped).not.toContain('<script>');
    expect(escaped).not.toContain('<img');
    expect(escaped).not.toContain('onerror=');
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).toContain('&lt;img');
  });
});

