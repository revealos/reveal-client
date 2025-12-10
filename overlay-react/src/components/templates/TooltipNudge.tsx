/**
 * TooltipNudge Component
 * 
 * Renders a tooltip nudge based on a UINudgeDecision.
 * Positions itself in a viewport quadrant (defaults to topCenter).
 * Supports title, body, CTA button, and dismiss functionality.
 */

"use client"

import { useEffect, useState, useRef } from "react"
import type { UINudgeDecision } from "../../types/NudgeDecision"
import { computeQuadrantPosition } from "../../layout/computeQuadrantPosition"
import { useKeyboardDismiss } from "../../hooks/useKeyboardDismiss"
import { Z_INDEX } from "../../utils/constants"

/**
 * Get quadrant-specific border color for visual debugging
 */
function getQuadrantBorderColor(quadrant: string): string {
  switch (quadrant) {
    case "topLeft":
      return "border-blue-300"
    case "topCenter":
      return "border-green-300"
    case "topRight":
      return "border-purple-300"
    case "bottomLeft":
      return "border-orange-300"
    case "bottomCenter":
      return "border-pink-300"
    case "bottomRight":
      return "border-cyan-300"
    default:
      return "border-border"
  }
}

interface TooltipNudgeProps {
  /** The nudge decision containing content and configuration */
  decision: UINudgeDecision
  /** Callback when nudge is dismissed */
  onDismiss: (id: string) => void
  /** Optional callback when CTA button is clicked */
  onActionClick?: (id: string) => void
  /** Optional callback for tracking events (e.g., Reveal.track) */
  onTrack?: (kind: string, name: string, payload?: Record<string, any>) => void
}

/**
 * TooltipNudge
 * 
 * A tooltip that displays nudge content in a viewport quadrant.
 * Defaults to topCenter positioning.
 */
export function TooltipNudge({
  decision,
  onDismiss,
  onActionClick,
  onTrack,
}: TooltipNudgeProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Handle ESC key dismiss
  useKeyboardDismiss(() => {
    onDismiss(decision.id)
  }, true)

  // Compute and update position based on quadrant
  useEffect(() => {
    const quadrant = decision.quadrant ?? "topCenter"

    // Compute position using quadrant helper
    const newPosition = computeQuadrantPosition(quadrant, tooltipRef.current)
    setPosition(newPosition)

    // Update position on window resize only
    const updatePosition = () => {
      const updatedPosition = computeQuadrantPosition(quadrant, tooltipRef.current)
      setPosition(updatedPosition)
    }

    window.addEventListener("resize", updatePosition)

    return () => {
      window.removeEventListener("resize", updatePosition)
    }
  }, [decision.quadrant])

  // Determine content to display
  const displayBody = decision.body || decision.title || ""
  const hasTitle = decision.title && decision.title !== decision.body

  // Handle dismiss
  const handleDismiss = () => {
    onDismiss(decision.id)
  }

  // Handle action click
  const handleActionClick = () => {
    if (onActionClick) {
      onActionClick(decision.id)
    }
  }

  // If no position, don't render
  if (!position) {
    return null
  }

  return (
    <>
      {/* Tooltip - non-blocking, no backdrop overlay */}
      <div
        ref={tooltipRef}
        className={`fixed max-w-xs bg-popover ${getQuadrantBorderColor(decision.quadrant ?? "topCenter")} border rounded-lg shadow-lg p-3 pointer-events-auto`}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          zIndex: Z_INDEX.TOOLTIP,
        }}
        role="tooltip"
        aria-labelledby={hasTitle ? `tooltip-title-${decision.id}` : undefined}
      >

        {/* Title (if present and different from body) */}
        {hasTitle && (
          <h3
            id={`tooltip-title-${decision.id}`}
            className="text-sm font-semibold text-popover-foreground mb-2"
          >
            {decision.title}
          </h3>
        )}

        {/* Body/Message */}
        {displayBody && (
          <p className="text-sm text-popover-foreground mb-2">{displayBody}</p>
        )}

        {/* CTA Button (if present) - primary action */}
        {decision.ctaText && (
          <button
            onClick={handleActionClick}
            className="text-xs font-medium text-primary hover:text-primary/80 underline mb-2"
            aria-label={decision.ctaText}
          >
            {decision.ctaText}
          </button>
        )}

        {/* Got it button (only if dismissible AND no CTA) */}
        {/* If CTA exists, user can dismiss via ESC */}
        {/* If no CTA, show subtle "Got it" option */}
        {decision.dismissible !== false && !decision.ctaText && (
          <button
            onClick={handleDismiss}
            className="text-xs text-muted-foreground hover:text-foreground underline"
            aria-label="Got it"
          >
            Got it
          </button>
        )}
      </div>
    </>
  )
}

