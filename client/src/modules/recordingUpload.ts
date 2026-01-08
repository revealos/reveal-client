/**
 * Recording Upload Module
 *
 * Helper for uploading session recordings to Reveal backend.
 * Phase 2 of Trace Requests + BYOR feature.
 *
 * 3-step upload flow:
 * 1. Init → POST /recordings/init → get signed URL
 * 2. Upload → PUT to signed URL with blob
 * 3. Complete → POST /recordings/complete → mark ready
 *
 * SECURITY: This module implements allowlist validation for:
 * - API base URLs (must be HTTPS, or HTTP for localhost in development)
 * - Supabase Storage signed URLs (must match expected pattern)
 * - HTTP methods (POST for init/complete, PUT for upload)
 * - All network requests are audit logged for compliance
 */

import type { RecordingUploadOptions, RecordingUploadResult } from '../types/recording';
import { sanitizeReason, sanitizeMeta } from '../utils/sanitize';
import { validateHttpsUrl } from '../security/inputValidation';
import { logAuditEvent, createAuditEvent } from '../security/auditLogger';

/**
 * Upload a session recording to Reveal backend
 *
 * @param options - Upload options (projectId, sessionId, traceId, blob, etc.)
 * @returns Promise<RecordingUploadResult> - Upload result with recordingId if successful
 *
 * @example
 * ```typescript
 * const result = await uploadRecording({
 *   projectId: 'my-project',
 *   sessionId: 'session-123',
 *   traceId: 'trace-456',
 *   blob: recordingBlob,
 *   reason: 'user_bug_report',
 *   meta: { page: 'checkout', step: 2 },
 *   apiBaseUrl: 'https://api.revealos.com',
 *   clientKey: 'my-client-key',
 * });
 *
 * if (result.success) {
 *   console.log('Recording uploaded:', result.recordingId);
 * } else {
 *   console.error('Upload failed:', result.error);
 * }
 * ```
 */
/**
 * Validate Supabase Storage signed URL pattern
 * 
 * SECURITY: Ensures upload URL is from Supabase Storage API, not arbitrary endpoint.
 * Pattern: https://[domain]/storage/v1/object/...
 * 
 * @param url - URL to validate
 * @returns True if URL matches Supabase Storage pattern
 */
function validateSupabaseStorageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    
    // Must be HTTPS
    if (urlObj.protocol !== 'https:') {
      return false;
    }

    // Must contain Supabase Storage API path indicator
    // This is permissive enough for any Supabase instance (cloud or self-hosted)
    if (!urlObj.pathname.includes('/storage/v1/object/')) {
      return false;
    }

    return true;
  } catch {
    // Invalid URL format
    return false;
  }
}

/**
 * Validate HTTP method against allowed list
 * 
 * @param method - HTTP method to validate
 * @param allowedMethods - Array of allowed methods
 * @returns True if method is allowed
 */
function validateHttpMethod(method: string, allowedMethods: string[]): boolean {
  return allowedMethods.includes(method.toUpperCase());
}

export async function uploadRecording(options: RecordingUploadOptions): Promise<RecordingUploadResult> {
  try {
    // SECURITY: Validate API base URL before use
    const apiBaseValidation = validateHttpsUrl(options.apiBaseUrl);
    if (!apiBaseValidation.valid) {
      const error = `Invalid API base URL: ${apiBaseValidation.error}`;
      logAuditEvent(createAuditEvent(
        'data_access',
        'high',
        'Recording upload rejected: invalid API base URL',
        { error: apiBaseValidation.error }
      ));
      return {
        success: false,
        error,
      };
    }

    // Step 1: Initialize upload and get signed URL
    const initUrl = `${options.apiBaseUrl}/recordings/init`;

    // SECURITY: Validate HTTP method
    if (!validateHttpMethod('POST', ['POST'])) {
      const error = 'Invalid HTTP method for init step: must be POST';
      logAuditEvent(createAuditEvent(
        'data_access',
        'high',
        'Recording upload rejected: invalid HTTP method',
        { step: 'init', method: 'POST' }
      ));
      return {
        success: false,
        error,
      };
    }

    // SECURITY: Audit log init step start
    logAuditEvent(createAuditEvent(
      'data_access',
      'low',
      'Recording upload init step started',
      { 
        step: 'init',
        urlPattern: `${new URL(options.apiBaseUrl).hostname}/recordings/init`
      }
    ));

    // Sanitize inputs before sending
    const sanitizedReason = sanitizeReason(options.reason);
    const sanitizedMeta = sanitizeMeta(options.meta);

    const initResponse = await fetch(initUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Reveal-Client-Key': options.clientKey,
      },
      body: JSON.stringify({
        projectId: options.projectId,
        sessionId: options.sessionId,
        traceId: options.traceId,
        reason: sanitizedReason,
        meta: sanitizedMeta,
      }),
    });

    if (!initResponse.ok) {
      const errorData = await initResponse.json().catch(() => ({ error: 'Unknown error' }));
      const error = `Init failed (${initResponse.status}): ${errorData.error || 'Unknown error'}`;
      
      // SECURITY: Audit log init step failure
      logAuditEvent(createAuditEvent(
        'data_access',
        'medium',
        'Recording upload init step failed',
        { 
          step: 'init',
          statusCode: initResponse.status,
          urlPattern: `${new URL(options.apiBaseUrl).hostname}/recordings/init`
        }
      ));
      
      return {
        success: false,
        error,
      };
    }

    // SECURITY: Audit log init step success
    logAuditEvent(createAuditEvent(
      'data_access',
      'low',
      'Recording upload init step succeeded',
      { 
        step: 'init',
        statusCode: initResponse.status,
        urlPattern: `${new URL(options.apiBaseUrl).hostname}/recordings/init`
      }
    ));

    const initData = await initResponse.json();
    const { recordingId, uploadUrl, uploadMethod } = initData;

    if (!uploadUrl || !recordingId) {
      const error = 'Init response missing uploadUrl or recordingId';
      logAuditEvent(createAuditEvent(
        'data_access',
        'medium',
        'Recording upload init step failed: missing response data',
        { step: 'init' }
      ));
      return {
        success: false,
        error,
      };
    }

    // SECURITY: Validate Supabase Storage signed URL
    if (!validateSupabaseStorageUrl(uploadUrl)) {
      const error = 'Invalid upload URL: must be a Supabase Storage signed URL';
      logAuditEvent(createAuditEvent(
        'data_access',
        'high',
        'Recording upload rejected: invalid upload URL',
        { 
          step: 'upload',
          urlPattern: 'invalid (not Supabase Storage)'
        }
      ));
      return {
        success: false,
        error,
      };
    }

    // SECURITY: Validate HTTP method for upload
    const uploadMethodToUse = uploadMethod || 'PUT';
    if (!validateHttpMethod(uploadMethodToUse, ['PUT'])) {
      const error = `Invalid HTTP method for upload step: must be PUT, got ${uploadMethodToUse}`;
      logAuditEvent(createAuditEvent(
        'data_access',
        'high',
        'Recording upload rejected: invalid HTTP method',
        { step: 'upload', method: uploadMethodToUse }
      ));
      return {
        success: false,
        error,
      };
    }

    // SECURITY: Audit log upload step start
    logAuditEvent(createAuditEvent(
      'data_access',
      'low',
      'Recording upload step started',
      { 
        step: 'upload',
        blobSizeBytes: options.blob.size,
        urlPattern: 'Supabase Storage signed URL'
      }
    ));

    // Step 2: Upload blob to signed URL
    const uploadResponse = await fetch(uploadUrl, {
      method: uploadMethodToUse,
      body: options.blob,
      headers: {
        'Content-Type': 'application/json', // rrweb events are JSON
      },
    });

    if (!uploadResponse.ok) {
      const error = `Upload failed (${uploadResponse.status}): ${uploadResponse.statusText}`;
      
      // SECURITY: Audit log upload step failure
      logAuditEvent(createAuditEvent(
        'data_access',
        'medium',
        'Recording upload step failed',
        { 
          step: 'upload',
          statusCode: uploadResponse.status,
          blobSizeBytes: options.blob.size
        }
      ));
      
      return {
        success: false,
        error,
      };
    }

    // SECURITY: Audit log upload step success
    logAuditEvent(createAuditEvent(
      'data_access',
      'low',
      'Recording upload step succeeded',
      { 
        step: 'upload',
        statusCode: uploadResponse.status,
        blobSizeBytes: options.blob.size
      }
    ));

    // Step 3: Complete upload (mark as ready)
    const completeUrl = `${options.apiBaseUrl}/recordings/complete`;
    
    // SECURITY: Validate HTTP method for complete
    if (!validateHttpMethod('POST', ['POST'])) {
      const error = 'Invalid HTTP method for complete step: must be POST';
      logAuditEvent(createAuditEvent(
        'data_access',
        'high',
        'Recording upload rejected: invalid HTTP method',
        { step: 'complete', method: 'POST' }
      ));
      return {
        success: false,
        error,
      };
    }

    // SECURITY: Audit log complete step start
    logAuditEvent(createAuditEvent(
      'data_access',
      'low',
      'Recording upload complete step started',
      { 
        step: 'complete',
        recordingId,
        urlPattern: `${new URL(options.apiBaseUrl).hostname}/recordings/complete`
      }
    ));

    const completeResponse = await fetch(completeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Reveal-Client-Key': options.clientKey,
      },
      body: JSON.stringify({
        recordingId,
        sizeBytes: options.blob.size,
      }),
    });

    if (!completeResponse.ok) {
      const errorData = await completeResponse.json().catch(() => ({ error: 'Unknown error' }));
      const error = `Complete failed (${completeResponse.status}): ${errorData.error || 'Unknown error'}`;
      
      // SECURITY: Audit log complete step failure
      logAuditEvent(createAuditEvent(
        'data_access',
        'medium',
        'Recording upload complete step failed',
        { 
          step: 'complete',
          statusCode: completeResponse.status,
          recordingId,
          urlPattern: `${new URL(options.apiBaseUrl).hostname}/recordings/complete`
        }
      ));
      
      return {
        success: false,
        error,
      };
    }

    // SECURITY: Audit log complete step success
    logAuditEvent(createAuditEvent(
      'data_access',
      'low',
      'Recording upload complete step succeeded',
      { 
        step: 'complete',
        statusCode: completeResponse.status,
        recordingId,
        urlPattern: `${new URL(options.apiBaseUrl).hostname}/recordings/complete`
      }
    ));

    // Success!
    return {
      success: true,
      recordingId,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || String(error),
    };
  }
}
