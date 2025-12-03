# Public API Documentation

## Reveal.init()

Initialize the Reveal SDK.

```typescript
Reveal.init(clientKey: string, options?: InitOptions): Promise<void>
```

## Reveal.track()

Track an event.

```typescript
Reveal.track(
  eventKind: EventKind,
  eventType: string,
  properties?: Record<string, any>
): void
```

## Reveal.onNudgeDecision()

Subscribe to nudge decisions.

```typescript
Reveal.onNudgeDecision(
  handler: (decision: NudgeDecision) => void
): () => void
```

## Types

See `src/types/` for complete type definitions.

