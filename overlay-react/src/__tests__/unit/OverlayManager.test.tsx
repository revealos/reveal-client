/**
 * OverlayManager Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverlayManager } from '../../components/OverlayManager';
import type { NudgeDecision } from '../../types/NudgeDecision';

// Mock the hooks
const mockUseNudgeVisibility = vi.fn((args: any) => {
  const handleManualDismiss = vi.fn(() => {
    if (args.onDismiss) {
      args.onDismiss(args.decision.id);
    }
  });
  return {
    isVisible: true,
    handleManualDismiss,
  };
});

const mockUseTrackNudgeShown = vi.fn();

vi.mock('../../hooks/useNudgeVisibility', () => ({
  useNudgeVisibility: (...args: any[]) => mockUseNudgeVisibility(...args),
}));

vi.mock('../../hooks/useTrackNudgeShown', () => ({
  useTrackNudgeShown: (...args: any[]) => mockUseTrackNudgeShown(...args),
}));

// Mock TooltipNudge
vi.mock('../../components/templates/TooltipNudge', () => ({
  TooltipNudge: ({ decision, onDismiss, onActionClick }: any) => (
    <div data-testid="tooltip-nudge">
      <div>{decision.body}</div>
      <button onClick={() => onDismiss(decision.id)}>Got it</button>
      {decision.ctaText && (
        <button onClick={() => onActionClick?.(decision.id)}>{decision.ctaText}</button>
      )}
    </div>
  ),
}));

describe('OverlayManager', () => {
  const mockOnDismiss = vi.fn();
  const mockOnActionClick = vi.fn();
  const mockOnTrack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockUseNudgeVisibility.mockImplementation((args: any) => {
      const handleManualDismiss = vi.fn(() => {
        if (args.onDismiss) {
          args.onDismiss(args.decision.id);
        }
      });
      return {
        isVisible: true,
        handleManualDismiss,
      };
    });
    mockUseTrackNudgeShown.mockClear();
  });

  const createMockDecision = (overrides?: Partial<NudgeDecision>): NudgeDecision => ({
    id: 'test-nudge-1',
    templateId: 'tooltip',
    body: 'Test body',
    ...overrides,
  });

  it('renders nothing when decision is null', () => {
    const { container } = render(
      <OverlayManager decision={null} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders TooltipNudge when decision.templateId is "tooltip"', () => {
    const decision = createMockDecision({
      templateId: 'tooltip',
      body: 'Test tooltip body',
    });

    render(
      <OverlayManager
        decision={decision}
        onDismiss={mockOnDismiss}
      />
    );

    expect(screen.getByTestId('tooltip-nudge')).toBeInTheDocument();
    expect(screen.getByText('Test tooltip body')).toBeInTheDocument();
  });

  it('returns null for unimplemented templateIds', () => {
    mockUseNudgeVisibility.mockReturnValue({
      isVisible: true,
      handleManualDismiss: vi.fn(),
    });

    const decision = createMockDecision({
      templateId: 'modal',
    });

    const { container } = render(
      <OverlayManager decision={decision} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('logs warning for unknown templateId in dev mode', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockUseNudgeVisibility.mockReturnValue({
      isVisible: true,
      handleManualDismiss: vi.fn(),
    });

    const decision = createMockDecision({
      templateId: 'unknown-template' as any,
    });

    render(
      <OverlayManager decision={decision} />
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[OverlayManager] Unknown templateId:'),
      'unknown-template'
    );

    consoleSpy.mockRestore();
  });

  it('calls onDismiss with decision.id when nudge is dismissed', () => {
    const decision = createMockDecision();

    render(
      <OverlayManager
        decision={decision}
        onDismiss={mockOnDismiss}
      />
    );

    const gotItButton = screen.getByText('Got it');
    gotItButton.click();

    expect(mockOnDismiss).toHaveBeenCalledWith('test-nudge-1');
  });

  it('calls onActionClick with decision.id when action is clicked', () => {
    const decision = createMockDecision({
      ctaText: 'Click me',
    });

    render(
      <OverlayManager
        decision={decision}
        onActionClick={mockOnActionClick}
      />
    );

    const actionButton = screen.getByText('Click me');
    actionButton.click();

    expect(mockOnActionClick).toHaveBeenCalledWith('test-nudge-1');
  });

  it('uses useNudgeVisibility to manage visibility', () => {
    const mockHandleManualDismiss = vi.fn();
    mockUseNudgeVisibility.mockReturnValue({
      isVisible: false, // Not visible
      handleManualDismiss: mockHandleManualDismiss,
    });

    const decision = createMockDecision();

    const { container } = render(
      <OverlayManager decision={decision} />
    );

    // Should not render when not visible
    expect(container.firstChild).toBeNull();
    expect(mockUseNudgeVisibility).toHaveBeenCalledWith({
      decision,
      onDismiss: undefined,
    });
  });

  it('renders tooltip with quadrant positioning (no target element needed)', () => {
    const decision = createMockDecision({
      quadrant: 'topCenter',
    });

    render(
      <OverlayManager decision={decision} />
    );

    // Should render tooltip regardless of targetId
    expect(screen.getByTestId('tooltip-nudge')).toBeInTheDocument();
  });

  it('passes correct props to TooltipNudge', () => {
    const decision = createMockDecision({
      body: 'Test body',
      title: 'Test title',
      ctaText: 'Test CTA',
    });

    render(
      <OverlayManager
        decision={decision}
        onDismiss={mockOnDismiss}
        onActionClick={mockOnActionClick}
        onTrack={mockOnTrack}
      />
    );

    // Verify TooltipNudge received the decision
    expect(screen.getByText('Test body')).toBeInTheDocument();
  });

  it('defaults to topCenter quadrant when quadrant not specified', () => {
    const decision = createMockDecision({
      // quadrant not specified
    });

    render(
      <OverlayManager decision={decision} />
    );

    // Should still render with default topCenter positioning
    expect(screen.getByTestId('tooltip-nudge')).toBeInTheDocument();
  });

  it('calls useTrackNudgeShown with decision.id and onTrack', () => {
    const decision = createMockDecision();

    render(
      <OverlayManager
        decision={decision}
        onTrack={mockOnTrack}
      />
    );

    expect(mockUseTrackNudgeShown).toHaveBeenCalledWith('test-nudge-1', mockOnTrack);
  });
});

