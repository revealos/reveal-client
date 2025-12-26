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

### `<reveal-spotlight>`

Full-screen dark scrim with a circular cutout that highlights a specific target element. Used for hard-intrusion onboarding flows where you need to direct user attention to a specific UI element.

**Properties**:
- `decision` (NudgeDecision) - Spotlight configuration

**Events**:
- `reveal:dismiss` - Spotlight dismissed (reasons: `click_outside`, `focus`, `scroll`, `esc`, `target_not_found`)
- `reveal:action-click` - Target element clicked (tracked as `nudge_clicked` in backend)
- `reveal:shown` - Spotlight displayed to user

**Features**:
- Full-screen scrim (opacity 0.60) with circular cutout
- Target element detection via CSS selector
- Auto-reposition on window resize (100ms debounce)
- Smart dismissal: clicking/focusing target = success action (NOT dismissal)
- Click-through support: clicks on target pass through to underlying element
- Caption positioned using quadrant system
- Target-not-found handling (auto-dismiss if selector doesn't match)

**Target Element Marking**:

To spotlight a specific element, add a `data-reveal` attribute to it:

```html
<!-- Mark the target element -->
<button data-reveal="spotlight-target" class="cta-button">
  Create Project
</button>
```

Then configure the backend nudge with the corresponding CSS selector:

```javascript
// Backend nudge configuration
{
  "nudgeId": "onboarding-1",
  "templateId": "spotlight",
  "body": "Click here to create your first project",
  "selectorPattern": "[data-reveal='spotlight-target']",
  "quadrant": "bottomCenter"
}
```

**Example**:

```javascript
const spotlight = document.createElement('reveal-spotlight');
spotlight.decision = {
  nudgeId: 'onboarding-create-project',
  templateId: 'spotlight',
  body: 'Click here to create your first project',
  selectorPattern: "[data-reveal='spotlight-target']",
  quadrant: 'bottomCenter',
  debugCode: 'X4368DGE'
};

// Track when user clicks the target (success!)
spotlight.addEventListener('reveal:action-click', (e) => {
  console.log('User clicked target:', e.detail.id);
  // Backend receives this as 'nudge_clicked' event
  spotlight.remove();
});

// Track dismissal (user clicked outside or pressed ESC)
spotlight.addEventListener('reveal:dismiss', (e) => {
  console.log('Dismissed:', e.detail.reason);
  spotlight.remove();
});

document.body.appendChild(spotlight);
```

**Dismissal Behavior**:

| User Action | Result | Backend Event |
|-------------|--------|---------------|
| Click target element | `reveal:action-click` | `nudge_clicked` |
| Click outside target | `reveal:dismiss` (reason: `click_outside`) | `nudge_dismissed` |
| Focus outside target | `reveal:dismiss` (reason: `focus`) | `nudge_dismissed` |
| Press ESC key | `reveal:dismiss` (reason: `esc`) | `nudge_dismissed` |
| Scroll >16px | `reveal:dismiss` (reason: `scroll`) | `nudge_dismissed` |
| Target not found | `reveal:dismiss` (reason: `target_not_found`) | `nudge_dismissed` |

**Important**: Clicking or focusing the target element is treated as a **success action** (not a dismissal), since spotlight explicitly guides users to interact with that element.

## Type Definitions

### `NudgeDecision`

```typescript
interface NudgeDecision {
  nudgeId: string;
  templateId: "tooltip" | "modal" | "banner" | "spotlight" | "inline_hint";
  title?: string;
  body?: string;
  ctaText?: string;
  selectorPattern?: string;  // CSS selector for target element (used by spotlight)
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
- ✅ **Spotlight** - Full-screen scrim with circular cutout highlighting a target element
- ✅ **InlineHint** - Inline content hint

### Coming Soon
- ⏳ **Banner** - Full-width banner (top/bottom)
- ⏳ **Modal** - Centered modal with backdrop

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
