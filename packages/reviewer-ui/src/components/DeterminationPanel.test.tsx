import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeterminationPanel from './DeterminationPanel.tsx';
import type { DeterminationResult, DeterminationRequest } from '../api/client.ts';

afterEach(cleanup);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDetermination(overrides: Partial<DeterminationResult> = {}): DeterminationResult {
  return {
    decision: 'AUTO_APPROVE',
    confidence: 0.95,
    rationale: 'All criteria met with strong structured evidence.',
    policyBasis: [
      { policyId: 'pol-001', title: 'NCD 240.0 — Acute Respiratory Failure', version: '2025-01' },
    ],
    criteriaResults: [],
    clinicalSummary: [],
    missingData: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DeterminationPanel', () => {
  it('renders empty state when no determination is provided', () => {
    render(<DeterminationPanel />);

    expect(screen.getByText('No determination yet')).toBeInTheDocument();
    expect(screen.getByText('Run AI Review to generate a determination')).toBeInTheDocument();
  });

  it('renders AUTO_APPROVE badge correctly', () => {
    render(<DeterminationPanel determination={makeDetermination()} onDecide={() => {}} />);

    expect(screen.getByText('Auto-Approved')).toBeInTheDocument();
    expect(screen.getByText('AI Determination')).toBeInTheDocument();
  });

  it('renders MD_REVIEW badge correctly', () => {
    render(
      <DeterminationPanel
        determination={makeDetermination({ decision: 'MD_REVIEW' })}
        onDecide={() => {}}
      />,
    );

    expect(screen.getByText('MD Review')).toBeInTheDocument();
  });

  it('renders DENY badge correctly', () => {
    render(
      <DeterminationPanel
        determination={makeDetermination({ decision: 'DENY' })}
        onDecide={() => {}}
      />,
    );

    expect(screen.getByText('Denied')).toBeInTheDocument();
  });

  it('renders confidence as percentage', () => {
    render(
      <DeterminationPanel determination={makeDetermination({ confidence: 0.95 })} onDecide={() => {}} />,
    );

    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('Confidence')).toBeInTheDocument();
  });

  it('renders low confidence correctly', () => {
    render(
      <DeterminationPanel determination={makeDetermination({ confidence: 0.42 })} onDecide={() => {}} />,
    );

    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('renders policy basis', () => {
    render(<DeterminationPanel determination={makeDetermination()} onDecide={() => {}} />);

    expect(screen.getByText('Policy Basis')).toBeInTheDocument();
    expect(screen.getByText(/NCD 240\.0/)).toBeInTheDocument();
  });

  it('renders rationale text', () => {
    render(<DeterminationPanel determination={makeDetermination()} onDecide={() => {}} />);

    expect(screen.getByText('Rationale')).toBeInTheDocument();
    expect(screen.getByText('All criteria met with strong structured evidence.')).toBeInTheDocument();
  });

  it('renders missing data warnings', () => {
    const det = makeDetermination({
      decision: 'MD_REVIEW',
      missingData: ['No SpO2 value found in structured data', 'ABG results not available'],
    });
    render(<DeterminationPanel determination={det} onDecide={() => {}} />);

    expect(screen.getByText('Missing Data')).toBeInTheDocument();
    expect(screen.getByText('No SpO2 value found in structured data')).toBeInTheDocument();
    expect(screen.getByText('ABG results not available')).toBeInTheDocument();
  });

  it('shows action buttons when not decided and onDecide is provided', () => {
    render(<DeterminationPanel determination={makeDetermination()} onDecide={() => {}} />);

    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Send to MD')).toBeInTheDocument();
    expect(screen.getByText('More Info')).toBeInTheDocument();
    expect(screen.getByText('Deny')).toBeInTheDocument();
  });

  it('does not show action buttons when isDecided is true', () => {
    render(<DeterminationPanel determination={makeDetermination()} isDecided onDecide={() => {}} />);

    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.getByText('Decision Recorded')).toBeInTheDocument();
  });

  it('calls onDecide callback when Approve is clicked then confirmed', async () => {
    const user = userEvent.setup();
    const onDecide = vi.fn();
    render(<DeterminationPanel determination={makeDetermination()} onDecide={onDecide} />);

    // Click Approve
    await user.click(screen.getByText('Approve'));

    // Confirm Decision button should appear
    const confirmBtn = screen.getByText('Confirm Decision');
    expect(confirmBtn).toBeInTheDocument();

    await user.click(confirmBtn);

    expect(onDecide).toHaveBeenCalledOnce();
    expect(onDecide).toHaveBeenCalledWith({
      decision: 'AUTO_APPROVE',
      overrideReason: undefined,
      reviewerNotes: undefined,
    });
  });

  it('shows override reason textarea when determination differs from agent proposal', async () => {
    const user = userEvent.setup();
    // Agent proposed AUTO_APPROVE
    const det = makeDetermination({ decision: 'AUTO_APPROVE' });
    render(<DeterminationPanel determination={det} onDecide={() => {}} />);

    // Clicking "Deny" is an override (differs from AUTO_APPROVE)
    await user.click(screen.getByText('Deny'));

    // Override reason textarea should appear
    expect(screen.getByText('Override Reason (required)')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Explain why you're overriding the AI determination..."),
    ).toBeInTheDocument();
  });

  it('does not show override reason when selecting the same decision as agent', async () => {
    const user = userEvent.setup();
    const det = makeDetermination({ decision: 'AUTO_APPROVE' });
    render(<DeterminationPanel determination={det} onDecide={() => {}} />);

    // Click Approve (same as agent's AUTO_APPROVE decision)
    await user.click(screen.getByText('Approve'));

    // Override reason should NOT appear
    expect(screen.queryByText('Override Reason (required)')).not.toBeInTheDocument();
  });

  it('disables confirm button when override reason is empty', async () => {
    const user = userEvent.setup();
    const onDecide = vi.fn();
    const det = makeDetermination({ decision: 'AUTO_APPROVE' });
    render(<DeterminationPanel determination={det} onDecide={onDecide} />);

    // Select Deny (override)
    await user.click(screen.getByText('Deny'));

    // Confirm button should be disabled (override reason empty)
    const confirmBtn = screen.getByText('Confirm Decision');
    expect(confirmBtn).toBeDisabled();

    // Click should not call onDecide
    await user.click(confirmBtn);
    expect(onDecide).not.toHaveBeenCalled();
  });

  it('enables confirm and submits when override reason is filled', async () => {
    const user = userEvent.setup();
    const onDecide = vi.fn();
    const det = makeDetermination({ decision: 'AUTO_APPROVE' });
    render(<DeterminationPanel determination={det} onDecide={onDecide} />);

    // Select Deny (override)
    await user.click(screen.getByText('Deny'));

    // Fill in override reason
    const textarea = screen.getByPlaceholderText(
      "Explain why you're overriding the AI determination...",
    );
    await user.type(textarea, 'Missing recent imaging data');

    // Confirm should now be enabled
    const confirmBtn = screen.getByText('Confirm Decision');
    expect(confirmBtn).not.toBeDisabled();

    await user.click(confirmBtn);

    expect(onDecide).toHaveBeenCalledOnce();
    expect(onDecide).toHaveBeenCalledWith({
      decision: 'DENY',
      overrideReason: 'Missing recent imaging data',
      reviewerNotes: undefined,
    });
  });

  it('shows reviewer notes textarea when any action is selected', async () => {
    const user = userEvent.setup();
    render(<DeterminationPanel determination={makeDetermination()} onDecide={() => {}} />);

    // No notes textarea initially
    expect(screen.queryByText('Reviewer Notes (optional)')).not.toBeInTheDocument();

    await user.click(screen.getByText('Approve'));

    expect(screen.getByText('Reviewer Notes (optional)')).toBeInTheDocument();
  });
});
