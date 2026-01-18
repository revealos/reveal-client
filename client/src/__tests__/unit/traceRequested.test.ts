/**
 * Tests for traceRequested module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emitTraceRequested, onTraceRequested, setTraceEventPipeline, __TEST_ONLY__resetTraceSubscribers } from '../../internal/traceRequested';
import type { TraceRequestContext } from '../../types/recording';

describe('traceRequested', () => {
  beforeEach(() => {
    __TEST_ONLY__resetTraceSubscribers();
  });

  describe('emitTraceRequested', () => {
    it('should handle missing EventPipeline gracefully', () => {
      const mockContext: TraceRequestContext = {
        traceId: 'test-trace-123',
        reason: 'test_reason',
        meta: { page: 'test' },
        sessionId: 'test-session',
        anonymousId: 'test-anon',
        projectId: 'test-project',
      };

      const handler = vi.fn();
      onTraceRequested(handler);

      // Should not throw when EventPipeline is null
      expect(() => {
        emitTraceRequested(mockContext);
      }).not.toThrow();

      // Subscribers should still be notified
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(mockContext);
    });

    it('should call captureEvent with correct args when EventPipeline is available', () => {
      const mockCaptureEvent = vi.fn();
      const mockEventPipeline = {
        captureEvent: mockCaptureEvent,
      };

      setTraceEventPipeline(mockEventPipeline as any);

      const mockContext: TraceRequestContext = {
        traceId: 'test-trace-456',
        reason: 'backend_requested',
        meta: { frictionType: 'stall', autoTriggered: true },
        sessionId: 'test-session-2',
        anonymousId: 'test-anon-2',
        projectId: 'test-project-2',
      };

      emitTraceRequested(mockContext);

      // Should call captureEvent with correct signature
      expect(mockCaptureEvent).toHaveBeenCalledOnce();
      expect(mockCaptureEvent).toHaveBeenCalledWith(
        'session',
        'trace_requested',
        {
          trace_id: 'test-trace-456',
          reason: 'backend_requested',
          frictionType: 'stall',
          autoTriggered: true,
        },
        false
      );
    });

    it('should handle captureEvent errors gracefully', () => {
      const mockCaptureEvent = vi.fn(() => {
        throw new Error('test error');
      });
      const mockEventPipeline = {
        captureEvent: mockCaptureEvent,
      };

      setTraceEventPipeline(mockEventPipeline as any);

      const mockContext: TraceRequestContext = {
        traceId: 'test-trace-789',
        reason: null,
        meta: {},
        sessionId: 'test-session-3',
        anonymousId: 'test-anon-3',
        projectId: 'test-project-3',
      };

      const handler = vi.fn();
      onTraceRequested(handler);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw
      expect(() => {
        emitTraceRequested(mockContext);
      }).not.toThrow();

      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Reveal] EventPipeline.captureEvent error:'),
        expect.any(Error)
      );

      // Subscribers should still be notified despite error
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(mockContext);

      consoleErrorSpy.mockRestore();
    });

    it('should handle EventPipeline without captureEvent method gracefully', () => {
      const mockEventPipeline = {
        // Missing captureEvent method
        flush: vi.fn(),
      };

      setTraceEventPipeline(mockEventPipeline as any);

      const mockContext: TraceRequestContext = {
        traceId: 'test-trace-invalid',
        reason: 'test',
        meta: {},
        sessionId: 'test-session',
        anonymousId: 'test-anon',
        projectId: 'test-project',
      };

      const handler = vi.fn();
      onTraceRequested(handler);

      // Should not throw
      expect(() => {
        emitTraceRequested(mockContext);
      }).not.toThrow();

      // Subscribers should still be notified
      expect(handler).toHaveBeenCalledOnce();
    });
  });
});



