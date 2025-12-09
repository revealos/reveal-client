# @reveal/client

Lightweight SDK for detecting user friction and displaying contextual nudges.

## Overview

This is the core SDK package. For complete documentation, installation instructions, and quick start guide, see the [main README](../README.md).

## Package-Specific Details

### Installation

```bash
npm install @reveal/client
```

### Core Exports

- `Reveal.init()` - Initialize the SDK
- `Reveal.track()` - Track events
- `Reveal.onNudgeDecision()` - Subscribe to nudge decisions
- `useNudgeDecision()` - React hook for nudge decisions
- `mapWireToUI()` - Convert wire decisions to UI format

### Type Exports

```typescript
import type {
  EventKind,
  EventPayload,
  FrictionSignal,
  WireNudgeDecision,
  UINudgeDecision,
  NudgeDecision,
} from '@reveal/client';
```

## Documentation

- **Main README** → [../README.md](../README.md)
- **API Reference** → [../docs/API.md](../docs/API.md)
- **Event Types** → [../docs/EVENTS.md](../docs/EVENTS.md)
- **Data Flow** → [../docs/DATAFLOW.md](../docs/DATAFLOW.md)
- **Security** → [../docs/SECURITY.md](../docs/SECURITY.md)

## License

MIT

