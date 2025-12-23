# @reveal/overlay-wc

Framework-agnostic Web Components for rendering contextual nudges in Reveal.

## Overview

This package provides vanilla Web Components for rendering nudge overlays. These components are the **source of truth** for all nudge UI logic, styling, positioning, and animations.

For React applications, use the `@reveal/overlay-react` package, which wraps these Web Components in a React-friendly API.

## Installation

```bash
npm install @reveal/overlay-wc
```

## Quick Start

### Vanilla JavaScript

```javascript
import '@reveal/overlay-wc';

// Create overlay manager
const manager = document.createElement('reveal-overlay-manager');

// Set decision (from backend)
manager.decision = {
  nudgeId: 'nudge-123',
  templateId: 'tooltip',
  title: 'Try this feature',
  body: 'Click here to get started',
  ctaText: 'Get Started',
  quadrant: 'topCenter'
};

// Listen for user interactions
manager.addEventListener('reveal:dismiss', (e) => {
  console.log('User dismissed:', e.detail.id);
});

manager.addEventListener('reveal:action-click', (e) => {
  console.log('User clicked CTA:', e.detail.id);
});

manager.addEventListener('reveal:shown', (e) => {
  console.log('Nudge shown:', e.detail.id);
});

// Add to page
document.body.appendChild(manager);
```

### Vue 3

```vue
<template>
  <reveal-overlay-manager
    ref="managerRef"
    :show-quadrants="showDebug"
  />
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import '@reveal/overlay-wc';

const managerRef = ref(null);
const decision = ref(null);
const showDebug = ref(false);

// Sync decision to Web Component property
watch(decision, (newDecision) => {
  if (managerRef.value) {
    managerRef.value.decision = newDecision;
  }
});

onMounted(() => {
  // Attach event listeners
  managerRef.value?.addEventListener('reveal:dismiss', (e) => {
    console.log('Dismissed:', e.detail.id);
  });

  managerRef.value?.addEventListener('reveal:action-click', (e) => {
    console.log('Clicked:', e.detail.id);
  });
});
</script>
```

### Svelte

```svelte
<script>
  import { onMount } from 'svelte';
  import '@reveal/overlay-wc';

  export let decision = null;
  let managerElement;

  // Sync decision to Web Component
  $: if (managerElement) {
    managerElement.decision = decision;
  }

  onMount(() => {
    managerElement.addEventListener('reveal:dismiss', (e) => {
      console.log('Dismissed:', e.detail.id);
    });

    managerElement.addEventListener('reveal:action-click', (e) => {
      console.log('Clicked:', e.detail.id);
    });
  });
</script>

<reveal-overlay-manager bind:this={managerElement} />
```

## Components

### `<reveal-overlay-manager>`

Main routing component that displays the appropriate nudge template based on the decision.

**Properties**:
- `decision` (NudgeDecision | null) - Nudge decision object from backend

**Attributes**:
- `show-quadrants` (boolean) - Enable debug mode showing quadrant boundaries

**Events**:
- `reveal:dismiss` - Fired when user dismisses nudge (detail: `{ id: string }`)
- `reveal:action-click` - Fired when user clicks CTA button (detail: `{ id: string }`)
- `reveal:shown` - Fired when nudge becomes visible (detail: `{ id: string }`)

**Example**:
```javascript
const manager = document.createElement('reveal-overlay-manager');
manager.decision = {
  nudgeId: 'onboarding-tip-1',
  templateId: 'tooltip',
  title: 'Welcome!',
  body: 'Here's how to get started',
  ctaText: 'Show me',
  quadrant: 'topCenter',
  debugCode: 'X4368DGE'
};

// Enable debug mode
manager.setAttribute('show-quadrants', '');
```

### `<reveal-tooltip-nudge>`

Glassmorphic tooltip nudge with arrow indicator and quadrant-based positioning.

**Properties**:
- `decision` (NudgeDecision) - Tooltip configuration

**Events**:
- `reveal:dismiss` - Tooltip dismissed by user
- `reveal:action-click` - CTA button clicked
- `reveal:shown` - Tooltip displayed to user

**Features**:
- Shadow DOM encapsulation (styles won't leak)
- Quadrant-based positioning (6 viewport zones)
- Auto-dismiss support
- ESC key dismissal
- Glassmorphic design with backdrop blur
- Floating arrow animation (respects `prefers-reduced-motion`)
- Responsive positioning with ResizeObserver

**Example**:
```javascript
const tooltip = document.createElement('reveal-tooltip-nudge');
tooltip.decision = {
  nudgeId: 'feature-123',
  templateId: 'tooltip',
  body: 'Click here to see your stats',
  quadrant: 'bottomRight',
  autoDismissMs: 5000
};

tooltip.addEventListener('reveal:dismiss', () => {
  tooltip.remove();
});
```

## Type Definitions

### `NudgeDecision`

```typescript
interface NudgeDecision {
  nudgeId: string;
  templateId: "tooltip" | "modal" | "banner" | "spotlight" | "inline_hint";
  title?: string;
  body?: string;
  ctaText?: string;
  quadrant?: NudgeQuadrant;
  debugCode?: string;
  dismissible?: boolean;
  autoDismissMs?: number | null;
}
```

### `NudgeQuadrant`

```typescript
type NudgeQuadrant =
  | "topLeft"
  | "topCenter"
  | "topRight"
  | "bottomLeft"
  | "bottomCenter"
  | "bottomRight";
```

## Positioning System

Nudges use a **quadrant-based positioning** system that divides the viewport into 6 zones:

```
┌──────────┬──────────┬──────────┐
│ topLeft  │topCenter │ topRight │
│          │          │          │
├──────────┼──────────┼──────────┤
│          │          │          │
│bottomLeft│bottomCtr │bottomRght│
└──────────┴──────────┴──────────┘
```

Nudges are centered within their assigned quadrant with 16px padding from viewport edges.

## Utilities

### `computeQuadrantPosition(quadrant, element)`

Calculates absolute pixel position for an element within a viewport quadrant.

**Parameters**:
- `quadrant` (NudgeQuadrant) - Target quadrant
- `element` (HTMLElement | null) - Element to position

**Returns**: `{ top: number, left: number }`

**Example**:
```javascript
import { computeQuadrantPosition } from '@reveal/overlay-wc';

const position = computeQuadrantPosition('topCenter', myElement);
myElement.style.top = `${position.top}px`;
myElement.style.left = `${position.left}px`;
```

## Templates

### Currently Implemented
- ✅ **Tooltip** - Glassmorphic tooltip with arrow

### Coming Soon
- ⏳ **Banner** - Full-width banner (top/bottom)
- ⏳ **Modal** - Centered modal with backdrop
- ⏳ **Spotlight** - Highlight with callout
- ⏳ **InlineHint** - Inline content hint

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Modern browsers with Custom Elements v1 and Shadow DOM support

## Architecture

This package is the **source of truth** for all nudge UI:
- All rendering logic lives here
- All styling (inline in Shadow DOM)
- All positioning algorithms
- All animations and interactions

The `@reveal/overlay-react` package is a thin adapter that:
- Maps React props → Web Component properties/attributes
- Maps Web Component events → React callbacks
- Contains NO duplicated UI logic

## License

MIT
