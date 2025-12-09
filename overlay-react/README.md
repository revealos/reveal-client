# @reveal/overlay-react

React components for rendering contextual nudges.

## Overview

This package provides React components for rendering nudges based on decisions from the Reveal SDK. For complete documentation, installation instructions, and quick start guide, see the [main README](../README.md).

## Package-Specific Details

### Installation

```bash
npm install @reveal/overlay-react
```

### Core Exports

- `OverlayManager` - Main component that renders nudge templates
- `OverlayManagerProps` - Props interface for OverlayManager

### Usage

```tsx
import { OverlayManager } from '@reveal/overlay-react';
import { useNudgeDecision } from '@reveal/client';

function App() {
  const { decision, handlers } = useNudgeDecision();

  return (
    <>
      {/* Your app */}
      <OverlayManager 
        decision={decision} 
        onDismiss={handlers.onDismiss}
        onActionClick={handlers.onActionClick}
        onTrack={handlers.onTrack}
      />
    </>
  );
}
```

### Templates

The `OverlayManager` automatically renders the appropriate template based on the decision:
- `tooltip` - TooltipNudge
- `banner` - BannerNudge
- `modal` - ModalNudge
- `spotlight` - SpotlightNudge
- `inline_hint` - InlineHint

## Documentation

- **Main README** → [../README.md](../README.md)
- **API Reference** → [../docs/API.md](../docs/API.md)

## License

MIT
