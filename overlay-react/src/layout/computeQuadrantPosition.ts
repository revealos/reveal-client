/**
 * computeQuadrantPosition
 * 
 * Pure function that calculates the position for a tooltip based on viewport quadrant.
 * Positions the tooltip in one of 6 viewport quadrants with appropriate padding.
 * 
 * @param quadrant - The viewport quadrant to position the tooltip in
 * @param tooltipElement - The tooltip DOM element (for size calculations), or null
 * @returns Position object with top and left coordinates
 */

import type { NudgeQuadrant } from "../types/NudgeDecision";

const PADDING = 16; // Padding from viewport edges in pixels

export function computeQuadrantPosition(
  quadrant: NudgeQuadrant,
  tooltipElement: HTMLElement | null
): { top: number; left: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Get tooltip dimensions (use actual if available, otherwise estimate)
  const tooltipWidth = tooltipElement?.offsetWidth || 200; // Default estimate: 200px
  const tooltipHeight = tooltipElement?.offsetHeight || 100; // Default estimate: 100px

  // Each quadrant is 1/3 of viewport width
  const quadrantWidth = viewportWidth / 3;
  const quadrantHeight = viewportHeight / 2;

  switch (quadrant) {
    case "topLeft": {
      // Center tooltip within top-left quadrant
      const quadrantLeft = 0;
      const quadrantTop = 0;
      return {
        top: quadrantTop + (quadrantHeight - tooltipHeight) / 2,
        left: quadrantLeft + (quadrantWidth - tooltipWidth) / 2,
      };
    }

    case "topCenter": {
      // Center tooltip within top-center quadrant
      const quadrantLeft = quadrantWidth;
      const quadrantTop = 0;
      return {
        top: quadrantTop + (quadrantHeight - tooltipHeight) / 2,
        left: quadrantLeft + (quadrantWidth - tooltipWidth) / 2,
      };
    }

    case "topRight": {
      // Center tooltip within top-right quadrant
      const quadrantLeft = quadrantWidth * 2;
      const quadrantTop = 0;
      return {
        top: quadrantTop + (quadrantHeight - tooltipHeight) / 2,
        left: quadrantLeft + (quadrantWidth - tooltipWidth) / 2,
      };
    }

    case "bottomLeft": {
      // Center tooltip within bottom-left quadrant
      const quadrantLeft = 0;
      const quadrantTop = quadrantHeight;
      return {
        top: quadrantTop + (quadrantHeight - tooltipHeight) / 2,
        left: quadrantLeft + (quadrantWidth - tooltipWidth) / 2,
      };
    }

    case "bottomCenter": {
      // Center tooltip within bottom-center quadrant
      const quadrantLeft = quadrantWidth;
      const quadrantTop = quadrantHeight;
      return {
        top: quadrantTop + (quadrantHeight - tooltipHeight) / 2,
        left: quadrantLeft + (quadrantWidth - tooltipWidth) / 2,
      };
    }

    case "bottomRight": {
      // Center tooltip within bottom-right quadrant
      const quadrantLeft = quadrantWidth * 2;
      const quadrantTop = quadrantHeight;
      return {
        top: quadrantTop + (quadrantHeight - tooltipHeight) / 2,
        left: quadrantLeft + (quadrantWidth - tooltipWidth) / 2,
      };
    }

    default:
      // Fallback to topCenter
      const quadrantLeft = quadrantWidth;
      const quadrantTop = 0;
      return {
        top: quadrantTop + (quadrantHeight - tooltipHeight) / 2,
        left: quadrantLeft + (quadrantWidth - tooltipWidth) / 2,
      };
  }
}

