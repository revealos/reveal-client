# Overlay Positioning Strategy

This document explains how Reveal overlays are positioned in the viewport.

---

## Quadrant-Based Positioning

Reveal overlays use a **quadrant-based positioning strategy** to ensure nudges appear in optimal locations without blocking critical UI elements.

### Quadrant Options

Overlays can be positioned in one of six viewport quadrants:

- **`topLeft`** - Top-left corner of the viewport
- **`topCenter`** - Top center of the viewport (default)
- **`topRight`** - Top-right corner of the viewport
- **`bottomLeft`** - Bottom-left corner of the viewport
- **`bottomCenter`** - Bottom center of the viewport
- **`bottomRight`** - Bottom-right corner of the viewport

### How Quadrants Are Determined

**Backend-Specified:**
- Backend can explicitly specify a quadrant in the `WireNudgeDecision`:
  ```typescript
  {
    nudgeId: "nudge_123",
    templateId: "tooltip",
    title: "Try this feature",
    quadrant: "topCenter"  // Explicit quadrant preference
  }
  ```

**Default Behavior:**
- When `quadrant` is not provided, the overlay defaults to `"topCenter"`.
- The default ensures consistent, predictable placement without requiring backend configuration.

### Benefits of Quadrant-Based Positioning

1. **Prevents UI Blocking**: Overlays positioned in fixed quadrants avoid covering critical UI elements (buttons, forms, navigation)
2. **Consistent Placement**: Users can predict where nudges will appear
3. **Flexible**: Backend can control placement via `quadrant` field
4. **Viewport-Aware**: Automatically adapts to different screen sizes and orientations
5. **No DOM Dependencies**: No need for target elements to exist in the DOM

### Migration from Target Element Positioning

**Previous Approach (Deprecated):**
- Overlays attached to specific DOM elements via `targetId`
- Positioned relative to target element (e.g., above, below, centered)
- Required target elements to exist in DOM

**New Approach (Current):**
- Overlays positioned in viewport quadrants
- No dependency on specific DOM elements
- More flexible and predictable placement

---

## Template-Specific Positioning

Different templates may use quadrants differently:

### Tooltip
- Positions in specified quadrant (defaults to `topCenter`)
- Fixed positioning based on viewport dimensions and tooltip size
- No target element attachment or arrows

### Banner
- Typically uses `topLeft`, `topCenter`, or `topRight` quadrants
- Full-width banners may span across top or bottom of viewport

### Modal
- Centers in viewport (not quadrant-based)
- Uses overlay/backdrop pattern

### Spotlight
- Uses quadrant for positioning callout/annotation
- May highlight elements but positioning is quadrant-based

### Inline Hint
- Positions inline with content (not quadrant-based)
- Uses document flow positioning

---

## Implementation Details

**Position Calculation:**
- Pure function: `computeQuadrantPosition(quadrant, viewport, overlaySize)`
- Returns `{ top: number, left: number }` coordinates
- Accounts for viewport boundaries, padding, and safe zones

**Responsive Behavior:**
- Automatically adjusts on viewport resize
- Recalculates position based on viewport dimensions and tooltip size
- Handles mobile/desktop viewport differences

**No-Go Zones:**
- Future enhancement: Define areas where overlays should never appear
- Examples: Navigation bars, critical action buttons, form inputs

---

## Configuration

Quadrant preference is set via:

1. **Backend Decision**: `WireNudgeDecision.quadrant` field
2. **Default**: If not specified, defaults to `"topCenter"`

---

## Examples

**Backend specifies quadrant:**
```json
{
  "nudgeId": "nudge_123",
  "templateId": "tooltip",
  "title": "New feature available",
  "body": "Check out our latest update",
  "quadrant": "topCenter"
}
```

**Default behavior (no quadrant specified):**
```json
{
  "nudgeId": "nudge_456",
  "templateId": "banner",
  "title": "Welcome back!",
  "body": "Here's what's new"
  // quadrant not specified → defaults to "topCenter"
}
```

---

For technical implementation details, see:
- `packages/overlay-react/src/layout/computeQuadrantPosition.ts`
- `packages/overlay-react/src/components/OverlayManager.tsx`

