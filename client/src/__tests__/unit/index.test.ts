/**
 * Unit Tests - SDK Index
 * 
 * Basic tests to verify SDK exports and core functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Reveal, type EventKind, type FrictionSignal, type WireNudgeDecision } from '../../index';

describe('Reveal SDK', () => {
  // Reset SDK state before each test
  beforeEach(() => {
    // Destroy any existing SDK instance (synchronous)
    Reveal.destroy();
    // Wait a bit to ensure cleanup completes
    return new Promise(resolve => setTimeout(resolve, 10));
  });

  afterEach(() => {
    // Clean up after each test
    Reveal.destroy();
  });

  describe('Exports', () => {
    it('should export Reveal object', () => {
      expect(Reveal).toBeDefined();
      expect(typeof Reveal).toBe('object');
    });

    it('should export Reveal.init function', () => {
      expect(Reveal.init).toBeDefined();
      expect(typeof Reveal.init).toBe('function');
    });

    it('should export Reveal.track function', () => {
      expect(Reveal.track).toBeDefined();
      expect(typeof Reveal.track).toBe('function');
    });

    it('should export Reveal.onNudgeDecision function', () => {
      expect(Reveal.onNudgeDecision).toBeDefined();
      expect(typeof Reveal.onNudgeDecision).toBe('function');
    });
  });

  describe('Type Exports', () => {
    it('should export EventKind type', () => {
      // Type check - this will fail at compile time if type doesn't exist
      const kind: EventKind = 'product';
      expect(kind).toBe('product');
    });

    it('should export FrictionSignal interface', () => {
      const signal: FrictionSignal = {
        type: 'stall',
        pageUrl: 'https://example.com',
        selector: '#button',
        timestamp: Date.now(),
      };
      expect(signal.type).toBe('stall');
      expect(signal.pageUrl).toBe('https://example.com');
    });

    it('should export WireNudgeDecision type', () => {
      const decision: WireNudgeDecision = {
        nudgeId: 'nudge_123',
        templateId: 'tooltip',
        title: 'Test',
      };
      expect(decision.nudgeId).toBe('nudge_123');
      expect(decision.templateId).toBe('tooltip');
    });
  });

  describe('Reveal.init', () => {
    it('should accept clientKey and options', () => {
      expect(() => {
        Reveal.init('test-key', { debug: true });
      }).not.toThrow();
    });

    it('should accept clientKey without options', () => {
      expect(() => {
        Reveal.init('test-key');
      }).not.toThrow();
    });

    describe('HTTPS URL validation', () => {

      it('should initialize successfully with HTTPS URLs', async () => {
        await Reveal.init('test-key', {
          ingestEndpoint: 'https://api.reveal.io/ingest',
          decisionEndpoint: 'https://api.reveal.io/decide',
        });
        // Should not throw and SDK should be initialized
        expect(() => {
          Reveal.track('product', 'test');
        }).not.toThrow();
      });

      it('should initialize successfully with localhost HTTP URLs (development exception)', async () => {
        await Reveal.init('test-key', {
          ingestEndpoint: 'http://localhost:3000/ingest',
          decisionEndpoint: 'http://localhost:3000/decide',
        });
        // Should not throw and SDK should be initialized
        expect(() => {
          Reveal.track('product', 'test');
        }).not.toThrow();
      });

      it('should initialize successfully with 127.0.0.1 HTTP URLs (development exception)', async () => {
        await Reveal.init('test-key', {
          ingestEndpoint: 'http://127.0.0.1:3000/ingest',
          decisionEndpoint: 'http://127.0.0.1:3000/decide',
        });
        // Should not throw and SDK should be initialized
        expect(() => {
          Reveal.track('product', 'test');
        }).not.toThrow();
      });

      it('should disable SDK and log error for non-HTTPS ingest endpoint', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        await Reveal.init('test-key-https-validation-1', {
          ingestEndpoint: 'http://api.reveal.io/ingest', // Invalid: non-localhost HTTP
          decisionEndpoint: 'https://api.reveal.io/decide',
        });

        // SDK should be disabled
        expect(consoleErrorSpy).toHaveBeenCalled();
        const errorCall = consoleErrorSpy.mock.calls[0][0];
        expect(errorCall).toContain('SECURITY');
        expect(errorCall).toContain('HTTPS');
        expect(errorCall).toContain('Ingest endpoint');

        // SDK should not function (disabled)
        Reveal.track('product', 'test'); // Should be no-op when disabled

        consoleErrorSpy.mockRestore();
      });

      it('should disable SDK and log error for non-HTTPS decision endpoint', async () => {
        const errorCalls: any[] = [];
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
          errorCalls.push(args);
        });
        
        await Reveal.init('test-key-https-validation-2', {
          ingestEndpoint: 'https://api.reveal.io/ingest',
          decisionEndpoint: 'http://api.reveal.io/decide', // Invalid: non-localhost HTTP
        });

        // Wait for async validation to complete
        await new Promise(resolve => setTimeout(resolve, 200));

        // SDK should be disabled and error logged
        expect(errorCalls.length).toBeGreaterThan(0);
        const errorCall = errorCalls[0][0];
        expect(errorCall).toContain('SECURITY');
        expect(errorCall).toContain('HTTPS');
        expect(errorCall).toContain('Decision endpoint');

        consoleErrorSpy.mockRestore();
      });

      it('should disable SDK and log error for non-HTTPS apiBase', async () => {
        const errorCalls: any[] = [];
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
          errorCalls.push(args);
        });
        
        await Reveal.init('test-key-https-validation-3', {
          apiBase: 'http://api.reveal.io', // Invalid: non-localhost HTTP
        });

        // Wait for async validation to complete (apiBase is validated synchronously, but wait for any async cleanup)
        await new Promise(resolve => setTimeout(resolve, 50));

        // SDK should be disabled and error logged
        // apiBase is validated first, before it's used to construct URLs
        expect(errorCalls.length).toBeGreaterThan(0);
        const errorCall = errorCalls[0][0];
        expect(errorCall).toContain('SECURITY');
        expect(errorCall).toContain('HTTPS');
        expect(errorCall).toContain('API base URL');

        consoleErrorSpy.mockRestore();
      });

      it('should disable SDK for invalid URL format', async () => {
        const errorCalls: any[] = [];
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
          errorCalls.push(args);
        });
        
        await Reveal.init('test-key-https-validation-4', {
          ingestEndpoint: 'not-a-valid-url',
          decisionEndpoint: 'https://api.reveal.io/decide',
        });

        // Wait for async validation to complete
        await new Promise(resolve => setTimeout(resolve, 200));

        // SDK should be disabled and error logged
        expect(errorCalls.length).toBeGreaterThan(0);
        const errorCall = errorCalls[0][0];
        expect(errorCall).toContain('SECURITY');

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('Reveal.track', () => {
    it('should accept eventKind, eventType, and properties', () => {
      expect(() => {
        Reveal.track('product', 'test_event', { key: 'value' });
      }).not.toThrow();
    });

    it('should accept eventKind and eventType without properties', () => {
      expect(() => {
        Reveal.track('product', 'test_event');
      }).not.toThrow();
    });

    it('should accept all event kinds', () => {
      const kinds: EventKind[] = ['product', 'friction', 'nudge', 'session'];
      kinds.forEach((kind) => {
        expect(() => {
          Reveal.track(kind, 'test_event');
        }).not.toThrow();
      });
    });
  });

  describe('Reveal.onNudgeDecision', () => {
    it('should accept a handler function', () => {
      const handler = (decision: WireNudgeDecision) => {
        // Handler implementation
      };
      expect(() => {
        Reveal.onNudgeDecision(handler);
      }).not.toThrow();
    });

    it('should return an unsubscribe function', () => {
      const handler = () => {};
      const unsubscribe = Reveal.onNudgeDecision(handler);
      expect(typeof unsubscribe).toBe('function');
    });
  });
});

