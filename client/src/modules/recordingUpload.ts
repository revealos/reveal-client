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
 */

import type { RecordingUploadOptions, RecordingUploadResult } from '../types/recording';
import { sanitizeReason, sanitizeMeta } from '../utils/sanitize';

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
export async function uploadRecording(options: RecordingUploadOptions): Promise<RecordingUploadResult> {
  try {
    // Step 1: Initialize upload and get signed URL
    const initUrl = `${options.apiBaseUrl}/recordings/init`;

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
      return {
        success: false,
        error: `Init failed (${initResponse.status}): ${errorData.error || 'Unknown error'}`,
      };
    }

    const initData = await initResponse.json();
    const { recordingId, uploadUrl, uploadMethod } = initData;

    if (!uploadUrl || !recordingId) {
      return {
        success: false,
        error: 'Init response missing uploadUrl or recordingId',
      };
    }

    // Step 2: Upload blob to signed URL
    const uploadResponse = await fetch(uploadUrl, {
      method: uploadMethod || 'PUT', // Use uploadMethod from backend (typically PUT)
      body: options.blob,
      headers: {
        'Content-Type': 'application/json', // rrweb events are JSON
      },
    });

    if (!uploadResponse.ok) {
      return {
        success: false,
        error: `Upload failed (${uploadResponse.status}): ${uploadResponse.statusText}`,
      };
    }

    // Step 3: Complete upload (mark as ready)
    const completeUrl = `${options.apiBaseUrl}/recordings/complete`;
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
      return {
        success: false,
        error: `Complete failed (${completeResponse.status}): ${errorData.error || 'Unknown error'}`,
      };
    }

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
