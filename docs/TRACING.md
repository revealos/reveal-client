# Trace Requests + BYOR (Bring Your Own Recorder)

## Overview

Reveal SDK provides a **BYOR (Bring Your Own Recorder)** pattern for session recording. Instead of bundling a recorder, the SDK provides hooks that let you integrate your own recording solution (rrweb, LogRocket, FullStory, etc.).

**Key Features:**
- Manual trace requests via `Reveal.requestTrace()`
- Automatic trace_id correlation with friction events
- SOC2-compliant metadata (primitives only, size limits)
- 60-second TTL for trace correlation
- Subscriber pattern for starting/stopping recorders

## Architecture

```
┌─────────────────────┐
│  User Action        │
│  (Bug Report Button)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│  Reveal.requestTrace({ reason, meta })          │
│  - Generates trace_id (UUID)                    │
│  - Stores in pendingTraceId with 60s TTL        │
│  - Notifies subscribers                         │
│  - Emits trace_requested event                  │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│  Subscriber (Your Recorder)                     │
│  - Receives TraceRequestContext                 │
│  - Starts recording (rrweb, LogRocket, etc.)    │
│  - Can auto-stop after X seconds                │
└─────────────────────────────────────────────────┘
           │
           │  User triggers friction (rage click, stall, etc.)
           ▼
┌─────────────────────────────────────────────────┐
│  SDK → POST /decide                             │
│  - consumePendingTraceId() → attach to payload  │
│  - trace_id consumed (cleared immediately)      │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│  Backend receives trace_id                      │
│  - Correlation established                      │
│  - Can query decisions by trace_id              │
└─────────────────────────────────────────────────┘
```

## API Reference

### `Reveal.requestTrace(options?)`

Request a trace for the current session. Generates a UUID, notifies subscribers, and correlates with the next `/decide` request within 60 seconds.

**Parameters:**
- `options.reason` (string, optional): Human-readable reason for trace request (max 64 chars)
- `options.meta` (object, optional): Metadata with **primitives only** (max 2KB)

**Returns:** `string | null`
- UUID trace_id if recording feature enabled
- `null` if disabled or SDK not initialized

**Example:**
```typescript
// Manual trace request (e.g., user clicks "Report a bug")
const traceId = Reveal.requestTrace({
  reason: 'user_bug_report',
  meta: {
    page: 'checkout',
    step: 2,
    cartValue: 149.99,
    isHighPriority: true
  }
});

if (traceId) {
  console.log('Trace requested:', traceId);
  // Show "Bug report submitted" toast
}
```

**Important Constraints:**
- **Primitives only**: `meta` must contain ONLY `string`, `number`, `boolean`, or `null` values
- **No nested objects**: `{ user: { name: 'Alice' } }` → nested object dropped
- **No arrays**: `{ tags: ['a', 'b'] }` → array dropped
- **Size limit**: Serialized meta must be ≤ 2KB
- **Reason length**: Max 64 characters (truncated if longer)

### `Reveal.onTraceRequested(handler)`

Subscribe to trace requests. Your callback receives context whenever `requestTrace()` is called.

**Parameters:**
- `handler` (function): Callback receiving `TraceRequestContext`

**Returns:** `() => void` (unsubscribe function)

**Example:**
```typescript
const unsubscribe = Reveal.onTraceRequested((context) => {
  console.log('Trace requested:', {
    traceId: context.traceId,
    reason: context.reason,
    meta: context.meta,
    sessionId: context.sessionId,
    projectId: context.projectId,
  });

  // Start your recorder here
  startRecording(context.traceId);
});

// Later: unsubscribe
unsubscribe();
```

### `TraceRequestContext`

Context provided to trace request subscribers.

**Properties:**
- `traceId` (string): UUID generated for this trace
- `reason` (string | null): Sanitized reason (max 64 chars)
- `meta` (object): Sanitized metadata (primitives only, max 2KB)
- `sessionId` (string): Current session ID
- `anonymousId` (string): Anonymous user ID
- `projectId` (string): Project ID

## Integration Examples

### Example 1: rrweb Integration

```typescript
import rrweb from 'rrweb';

let stopRecording: (() => void) | null = null;

Reveal.onTraceRequested((context) => {
  console.log('[rrweb] Starting recording for trace:', context.traceId);

  // Start recording
  stopRecording = rrweb.record({
    emit(event) {
      // Store events (Phase 2: upload to backend)
      console.log('[rrweb] Event:', event);
    },
    // IMPORTANT: Use blockSelector (NOT blockClass) to redact sensitive elements
    blockSelector: '[data-private]',
    maskAllInputs: true,
    maskInputOptions: {
      password: true,
      email: true,
      tel: true,
    },
  });

  // Auto-stop after 10 seconds
  setTimeout(() => {
    if (stopRecording) {
      stopRecording();
      console.log('[rrweb] Recording stopped');
    }
  }, 10000);
});
```

**Privacy Best Practices:**
- Mark sensitive elements: `<div data-private>Secret content</div>`
- Use `maskAllInputs: true` to redact input values
- Use `blockSelector` to completely remove elements from recording

### Example 2: LogRocket Integration

```typescript
import LogRocket from 'logrocket';

Reveal.onTraceRequested((context) => {
  LogRocket.identify(context.anonymousId, {
    traceId: context.traceId,
    sessionId: context.sessionId,
  });

  LogRocket.track('trace_requested', {
    reason: context.reason,
    meta: context.meta,
  });

  console.log('[LogRocket] Trace correlated:', context.traceId);
});
```

### Example 3: Custom Recorder

```typescript
class CustomRecorder {
  private events: any[] = [];

  start(traceId: string) {
    console.log('[CustomRecorder] Starting:', traceId);
    this.events = [];

    // Capture user interactions
    document.addEventListener('click', this.handleClick);
    document.addEventListener('input', this.handleInput);
  }

  stop() {
    document.removeEventListener('click', this.handleClick);
    document.removeEventListener('input', this.handleInput);

    console.log('[CustomRecorder] Stopped. Events:', this.events.length);
  }

  handleClick = (e: MouseEvent) => {
    this.events.push({ type: 'click', x: e.clientX, y: e.clientY });
  };

  handleInput = (e: Event) => {
    // NEVER record actual input values (PII risk)
    this.events.push({ type: 'input', target: (e.target as HTMLElement).tagName });
  };
}

const recorder = new CustomRecorder();

Reveal.onTraceRequested((context) => {
  recorder.start(context.traceId);

  // Auto-stop after 10s
  setTimeout(() => recorder.stop(), 10000);
});
```

## Production Use Cases

### 1. User-Initiated Bug Reports

```typescript
// "Report a Bug" button
<button onClick={() => {
  const traceId = Reveal.requestTrace({
    reason: 'user_bug_report',
    meta: {
      page: window.location.pathname,
      userAgent: navigator.userAgent.substring(0, 50),
    }
  });

  if (traceId) {
    showToast('Bug report submitted. Trace ID: ' + traceId.substring(0, 8));
  }
}}>
  Report a Bug
</button>
```

### 2. Critical Error Handler

```typescript
window.addEventListener('error', (event) => {
  if (isCriticalError(event.error)) {
    Reveal.requestTrace({
      reason: 'critical_error',
      meta: {
        message: event.error.message.substring(0, 100),
        filename: event.filename,
        lineno: event.lineno,
      }
    });
  }
});
```

### 3. Failed Checkout Flow

```typescript
async function handleCheckout() {
  try {
    await processPayment();
  } catch (error) {
    // Request trace on payment failure
    Reveal.requestTrace({
      reason: 'checkout_failure',
      meta: {
        errorCode: error.code,
        paymentMethod: 'credit_card',
        cartValue: cart.total,
      }
    });
  }
}
```

## Trace Correlation

### How It Works

1. **Request Trace**: `Reveal.requestTrace()` generates UUID and stores with 60s TTL
2. **Friction Detected**: User triggers friction (rage click, stall, backtrack)
3. **Decision Request**: SDK calls `/decide` and consumes pending trace_id
4. **Backend Correlation**: Backend receives and stores trace_id for correlation

### Consume Semantics

- **One-time use**: trace_id attached to **at most one** `/decide` call
- **Immediate clear**: After consumption, trace_id is cleared (cannot be reused)
- **Overwrite behavior**: Calling `requestTrace()` multiple times overwrites previous trace_id

**Example Timeline:**
```
t=0s:   Reveal.requestTrace() → stores "trace-A" (60s TTL)
t=10s:  Reveal.requestTrace() → stores "trace-B" (OVERWRITES trace-A)
t=15s:  User triggers rage click → /decide called
        → consumePendingTraceId() returns "trace-B" AND clears it
t=16s:  User triggers another rage click → /decide called
        → consumePendingTraceId() returns null (already consumed)
```

### Backend Query Support

The backend supports querying decisions by trace_id, allowing you to correlate recordings with specific friction events and nudge decisions.

## Security & Compliance

### SOC2 Compliance

**Primitives-Only Metadata:**
- ✅ Allowed: `string`, `number`, `boolean`, `null`
- ❌ Rejected: nested objects, arrays, functions

**Size Limits:**
- Reason: Max 64 characters
- Meta: Max 2KB serialized

**Example:**
```typescript
// ✅ GOOD: Primitives only
Reveal.requestTrace({
  reason: 'user_bug_report',
  meta: {
    page: '/checkout',
    step: 2,
    cartValue: 149.99,
    isHighPriority: true,
    errorCode: null,
  }
});

// ❌ BAD: Nested object (will be dropped)
Reveal.requestTrace({
  meta: {
    user: { name: 'Alice', email: 'alice@example.com' }, // DROPPED
    cart: { items: [1, 2, 3] }, // DROPPED
  }
});
```

### PII Protection

**Never record:**
- Passwords
- Credit card numbers
- Social security numbers
- Email addresses (unless explicitly consented)
- Phone numbers
- Full names

**rrweb Best Practices:**
```typescript
rrweb.record({
  blockSelector: '[data-private]', // Use this (NOT blockClass)
  maskAllInputs: true,
  maskInputOptions: {
    password: true,
    email: true,
    tel: true,
  },
});
```

**Mark sensitive elements:**
```html
<div data-private>
  Credit Card: **** **** **** 1234
</div>
```

## Troubleshooting

### Trace ID Not Appearing in /decide Payload

**Symptoms:** `/decide` payload missing `trace_id` field

**Possible causes:**
1. Recording feature not enabled
2. Trace consumed by previous /decide call
3. TTL expired (>60s between requestTrace and friction)

**Debug steps:**
```typescript
// 1. Check if recording feature enabled
console.log('Recording enabled:', Reveal.requestTrace({ reason: 'test' }) !== null);

// 2. Enable debug logging
// Set debug: true in Reveal.init()

// 3. Check console for:
// [TraceCorrelation] Stored trace_id: { traceId: "...", ttlMs: 60000 }
// [TraceCorrelation] Consumed trace_id: { traceId: "..." }
```

### Subscriber Not Called

**Symptoms:** `onTraceRequested()` callback never fires

**Possible causes:**
1. Subscriber registered after `requestTrace()` called
2. Recording feature disabled
3. Subscriber function has syntax error

**Fix:**
```typescript
// WRONG: Subscribe after calling requestTrace
const traceId = Reveal.requestTrace();
Reveal.onTraceRequested(() => { /* never called */ });

// CORRECT: Subscribe before calling requestTrace
Reveal.onTraceRequested(() => { /* will be called */ });
const traceId = Reveal.requestTrace();
```

### Meta Values Dropped

**Symptoms:** `meta` contains fewer fields than expected

**Cause:** Non-primitive values are dropped

**Fix:**
```typescript
// WRONG: Nested object
meta: { user: { name: 'Alice' } } // user.name dropped

// CORRECT: Flatten to primitives
meta: { userName: 'Alice' }
```

## Phase 2: Upload Infrastructure

**Status:** Not implemented in Phase 1

**Planned features:**
- `uploadRecording()` helper
- `recordings` table in backend
- Supabase Storage integration
- 30-day retention policy

**Example (Phase 2):**
```typescript
// Will be available in Phase 2
const result = await Reveal.uploadRecording({
  traceId: context.traceId,
  blob: recordingBlob,
  reason: 'user_bug_report',
});
```

## Summary

- ✅ Use `Reveal.requestTrace()` for manual trace requests
- ✅ Use `Reveal.onTraceRequested()` to start your recorder
- ✅ Primitives-only metadata (no nested objects, max 2KB)
- ✅ 60-second TTL for trace correlation
- ✅ One-time consume semantics
- ✅ SOC2-compliant (size limits, sanitization)
- ❌ Upload infrastructure not in Phase 1 (planned for Phase 2)
