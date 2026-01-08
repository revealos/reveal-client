/**
 * Unit tests for recordingUpload allowlist validation
 * 
 * Tests that recordingUpload.ts properly validates:
 * - API base URLs (HTTPS required, or HTTP for localhost)
 * - Supabase Storage signed URLs (must match pattern)
 * - HTTP methods (POST for init/complete, PUT for upload)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadRecording } from '../../modules/recordingUpload';
import type { RecordingUploadOptions } from '../../types/recording';

// Mock fetch globally
global.fetch = vi.fn();

// Mock audit logger to avoid console noise
vi.mock('../../security/auditLogger', () => ({
  logAuditEvent: vi.fn(),
  createAuditEvent: vi.fn((type, severity, message, metadata) => ({
    type,
    severity,
    message,
    metadata,
    timestamp: Date.now(),
  })),
}));

describe('recordingUpload allowlist validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createValidOptions = (overrides?: Partial<RecordingUploadOptions>): RecordingUploadOptions => ({
    projectId: 'test-project',
    sessionId: 'test-session',
    traceId: 'test-trace',
    blob: new Blob(['test data'], { type: 'application/json' }),
    apiBaseUrl: 'https://api.revealos.com',
    clientKey: 'test-key',
    ...overrides,
  });

  describe('API base URL validation', () => {
    it('should accept valid HTTPS URL', async () => {
      const options = createValidOptions({
        apiBaseUrl: 'https://api.revealos.com',
      });

      // Mock init response with valid Supabase URL
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          recordingId: 'rec-123',
          uploadUrl: 'https://project.supabase.co/storage/v1/object/sign/bucket/path?token=xyz',
          uploadMethod: 'PUT',
        }),
      });

      // Mock upload response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      // Mock complete response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await uploadRecording(options);
      
      // Should proceed (validation passes)
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should accept HTTP localhost URL (development)', async () => {
      const options = createValidOptions({
        apiBaseUrl: 'http://localhost:3000',
      });

      // Mock init response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          recordingId: 'rec-123',
          uploadUrl: 'https://project.supabase.co/storage/v1/object/sign/bucket/path?token=xyz',
          uploadMethod: 'PUT',
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: true });
      (global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const result = await uploadRecording(options);
      
      // Should proceed (localhost HTTP is allowed)
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should reject non-HTTPS URL (non-localhost)', async () => {
      const options = createValidOptions({
        apiBaseUrl: 'http://api.revealos.com', // HTTP without localhost
      });

      const result = await uploadRecording(options);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid API base URL');
      expect(result.error).toContain('HTTPS');
      
      // Should not make any network calls
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should reject invalid URL format', async () => {
      const options = createValidOptions({
        apiBaseUrl: 'not-a-valid-url',
      });

      const result = await uploadRecording(options);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid API base URL');
      
      // Should not make any network calls
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Supabase Storage URL validation', () => {
    it('should accept valid Supabase Storage signed URL', async () => {
      const options = createValidOptions();

      // Mock init response with valid Supabase Storage URL
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          recordingId: 'rec-123',
          uploadUrl: 'https://project.supabase.co/storage/v1/object/sign/bucket/path?token=xyz',
          uploadMethod: 'PUT',
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: true });
      (global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const result = await uploadRecording(options);
      
      // Should proceed to upload step
      expect(global.fetch).toHaveBeenCalledTimes(3); // init, upload, complete
    });

    it('should reject non-Supabase Storage URL', async () => {
      const options = createValidOptions();

      // Mock init response with invalid upload URL
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          recordingId: 'rec-123',
          uploadUrl: 'https://evil.com/upload', // Not Supabase Storage
          uploadMethod: 'PUT',
        }),
      });

      const result = await uploadRecording(options);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid upload URL');
      expect(result.error).toContain('Supabase Storage');
      
      // Should not proceed to upload step
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only init
    });

    it('should reject HTTP upload URL', async () => {
      const options = createValidOptions();

      // Mock init response with HTTP upload URL
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          recordingId: 'rec-123',
          uploadUrl: 'http://project.supabase.co/storage/v1/object/sign/bucket/path', // HTTP not HTTPS
          uploadMethod: 'PUT',
        }),
      });

      const result = await uploadRecording(options);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid upload URL');
      
      // Should not proceed to upload step
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only init
    });

    it('should accept Supabase Storage URL with different domain (self-hosted)', async () => {
      const options = createValidOptions();

      // Mock init response with self-hosted Supabase URL
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          recordingId: 'rec-123',
          uploadUrl: 'https://custom-supabase.example.com/storage/v1/object/sign/bucket/path?token=xyz',
          uploadMethod: 'PUT',
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: true });
      (global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const result = await uploadRecording(options);
      
      // Should accept (pattern matches even if domain is different)
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('HTTP method validation', () => {
    it('should enforce POST for init step', async () => {
      const options = createValidOptions();

      // The validation happens before fetch, so we test the error path
      // In practice, the method is hardcoded to POST, so this is defensive
      const result = await uploadRecording(options);
      
      // Should use POST (hardcoded in implementation)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/recordings/init'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should enforce PUT for upload step', async () => {
      const options = createValidOptions();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          recordingId: 'rec-123',
          uploadUrl: 'https://project.supabase.co/storage/v1/object/sign/bucket/path?token=xyz',
          uploadMethod: 'PUT', // Valid method
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: true });
      (global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await uploadRecording(options);
      
      // Should use PUT for upload
      const uploadCall = (global.fetch as any).mock.calls[1];
      expect(uploadCall[1].method).toBe('PUT');
    });

    it('should reject non-PUT method for upload step', async () => {
      const options = createValidOptions();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          recordingId: 'rec-123',
          uploadUrl: 'https://project.supabase.co/storage/v1/object/sign/bucket/path?token=xyz',
          uploadMethod: 'POST', // Invalid method for upload
        }),
      });

      const result = await uploadRecording(options);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid HTTP method');
      expect(result.error).toContain('PUT');
      
      // Should not proceed to upload
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only init
    });

    it('should enforce POST for complete step', async () => {
      const options = createValidOptions();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          recordingId: 'rec-123',
          uploadUrl: 'https://project.supabase.co/storage/v1/object/sign/bucket/path?token=xyz',
          uploadMethod: 'PUT',
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: true });
      (global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await uploadRecording(options);
      
      // Should use POST for complete
      const completeCall = (global.fetch as any).mock.calls[2];
      expect(completeCall[1].method).toBe('POST');
    });
  });
});

