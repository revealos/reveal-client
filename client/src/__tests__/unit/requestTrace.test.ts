/**
 * Tests for requestTrace and trace correlation
 */

import { storePendingTraceId, consumePendingTraceId, __TEST_ONLY__resetTraceState } from '../../internal/traceCorrelation';

describe('traceCorrelation', () => {
  beforeEach(() => {
    __TEST_ONLY__resetTraceState();
  });

  describe('storePendingTraceId', () => {
    it('should store trace_id with TTL', () => {
      const traceId = 'test-trace-123';
      storePendingTraceId(traceId, 60000);

      const consumed = consumePendingTraceId();
      expect(consumed).toBe(traceId);
    });

    it('should overwrite previous trace_id', () => {
      storePendingTraceId('trace-A', 60000);
      storePendingTraceId('trace-B', 60000);

      const consumed = consumePendingTraceId();
      expect(consumed).toBe('trace-B');
    });
  });

  describe('consumePendingTraceId', () => {
    it('should return null when no trace_id stored', () => {
      const result = consumePendingTraceId();
      expect(result).toBeNull();
    });

    it('should return trace_id if within TTL', () => {
      const traceId = 'test-trace-123';
      storePendingTraceId(traceId, 60000);

      const consumed = consumePendingTraceId();
      expect(consumed).toBe(traceId);
    });

    it('should clear trace_id after consuming (consume semantics)', () => {
      const traceId = 'test-trace-123';
      storePendingTraceId(traceId, 60000);

      // First consume
      const first = consumePendingTraceId();
      expect(first).toBe(traceId);

      // Second consume should return null
      const second = consumePendingTraceId();
      expect(second).toBeNull();
    });

    it('should return null if TTL expired', () => {
      const traceId = 'test-trace-123';
      storePendingTraceId(traceId, 10); // 10ms TTL

      // Wait for expiry
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const consumed = consumePendingTraceId();
          expect(consumed).toBeNull();
          resolve();
        }, 50);
      });
    });

    it('should handle multiple store-consume cycles', () => {
      // First cycle
      storePendingTraceId('trace-1', 60000);
      expect(consumePendingTraceId()).toBe('trace-1');

      // Second cycle
      storePendingTraceId('trace-2', 60000);
      expect(consumePendingTraceId()).toBe('trace-2');

      // Third cycle
      storePendingTraceId('trace-3', 60000);
      expect(consumePendingTraceId()).toBe('trace-3');

      // Should be null after all consumed
      expect(consumePendingTraceId()).toBeNull();
    });
  });

  describe('TTL behavior', () => {
    it('should respect TTL window', () => {
      const traceId = 'test-trace-123';
      storePendingTraceId(traceId, 100); // 100ms TTL

      // Consume immediately (should succeed)
      const immediate = consumePendingTraceId();
      expect(immediate).toBe(traceId);
    });

    it('should not allow consumption after TTL expires', () => {
      const traceId = 'test-trace-123';
      storePendingTraceId(traceId, 10); // 10ms TTL

      // Wait for expiry
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const consumed = consumePendingTraceId();
          expect(consumed).toBeNull();
          resolve();
        }, 50);
      });
    });
  });

  describe('resetTraceState', () => {
    it('should clear all trace state', () => {
      storePendingTraceId('test-trace-123', 60000);
      __TEST_ONLY__resetTraceState();

      const consumed = consumePendingTraceId();
      expect(consumed).toBeNull();
    });
  });
});
