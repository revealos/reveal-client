# @reveal/overlay-react

React wrapper for @reveal/overlay-wc Web Components.

**Note**: This package is a thin adapter layer. The actual UI logic lives in `@reveal/overlay-wc`.

## Overview

This package provides React components for rendering Reveal nudges in React applications. It wraps the `@reveal/overlay-wc` Web Components package and provides a React-friendly props API.

For complete documentation, installation instructions, and quick start guide, see the [main README](../README.md).

## Installation

```bash
npm install @reveal/overlay-react
```

## Usage

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

## Architecture

This package renders `<reveal-overlay-manager>` and `<reveal-tooltip-nudge>` Web Components from `@reveal/overlay-wc` and maps React props to Web Component properties/attributes.

**All UI logic, styling, and positioning happens in the Web Components (source of truth).**

This package is a thin adapter that:
- Creates React portals for DOM isolation
- Maps React props → Web Component properties (complex objects) and attributes (simple values)
- Maps Web Component CustomEvents → React callbacks
- Contains NO duplicated UI logic

## Components

### `<OverlayManager>`

Main component that routes to the appropriate nudge template based on the decision.

**Props**:
- `decision` (NudgeDecision | null) - Nudge decision from backend
- `onDismiss` ((id: string) => void) - Called when nudge is dismissed
- `onActionClick` ((id: string) => void) - Called when CTA is clicked
- `onTrack` ((kind, name, payload) => void) - Optional tracking callback
- `showQuadrants` (boolean) - Show debug quadrant overlays (default: false)

### `<TooltipNudge>`

Direct wrapper for `<reveal-tooltip-nudge>` Web Component (optional - OverlayManager handles this automatically).

**Props**:
- `decision` (NudgeDecision) - Tooltip configuration
- `onDismiss` ((id: string) => void) - Called when dismissed
- `onActionClick` ((id: string) => void) - Called when CTA clicked
- `onTrack` ((kind, name, payload) => void) - Optional tracking callback

## Migration from Previous Version

**No breaking changes** - the public API remains identical. Components are now backed by Web Components instead of pure React.

If you were using the internal utilities or hooks, they have been moved to `@reveal/overlay-wc`:
- `computeQuadrantPosition` → Now in `@reveal/overlay-wc`
- `useKeyboardDismiss`, `useNudgeVisibility`, etc. → Logic now in Web Component lifecycle

## TypeScript Support

This package includes JSX type declarations for Web Components. TypeScript will properly type-check the custom elements when used in React.

## Documentation

- **Main README** → [../../README.md](../../README.md)
- **overlay-wc README** → [../overlay-wc/README.md](../overlay-wc/README.md)
- **API Reference** → [../docs/API.md](../docs/API.md)

## License

MIT
