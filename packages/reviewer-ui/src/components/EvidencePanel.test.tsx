import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EvidencePanel, { type EvidenceItem } from './EvidencePanel.tsx';

afterEach(cleanup);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    fhirRef: 'Observation/spo2-001',
    extractedBy: 'STRUCTURED',
    assertion: 'AFFIRMED',
    ...overrides,
  };
}

const DEFAULT_PROPS = {
  criterionDescription: 'Recent O2 Saturation < 90%',
  onClose: () => {},
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EvidencePanel', () => {
  it('renders empty state when no evidence is provided', () => {
    render(<EvidencePanel evidence={[]} {...DEFAULT_PROPS} />);

    expect(screen.getByText('No evidence available')).toBeInTheDocument();
    expect(screen.getByText(/0 evidence item/)).toBeInTheDocument();
  });

  it('renders fhirRef as formatted text', () => {
    render(
      <EvidencePanel
        evidence={[makeEvidence({ fhirRef: 'Observation/spo2-001' })]}
        {...DEFAULT_PROPS}
      />,
    );

    expect(screen.getByText('Observation/spo2-001')).toBeInTheDocument();
  });

  it('renders numeric value in monospace', () => {
    render(
      <EvidencePanel
        evidence={[makeEvidence({ valueSeen: 87 })]}
        {...DEFAULT_PROPS}
      />,
    );

    const valueEl = screen.getByText('87');
    expect(valueEl).toBeInTheDocument();
    expect(valueEl).toHaveClass('font-mono');
  });

  it('renders boolean true as green', () => {
    render(
      <EvidencePanel
        evidence={[makeEvidence({ valueSeen: true })]}
        {...DEFAULT_PROPS}
      />,
    );

    const valueEl = screen.getByText('true');
    expect(valueEl).toBeInTheDocument();
    expect(valueEl).toHaveClass('text-green-700');
  });

  it('renders boolean false as red', () => {
    render(
      <EvidencePanel
        evidence={[makeEvidence({ valueSeen: false })]}
        {...DEFAULT_PROPS}
      />,
    );

    const valueEl = screen.getByText('false');
    expect(valueEl).toBeInTheDocument();
    expect(valueEl).toHaveClass('text-red-700');
  });

  it('renders effectiveTime with relative and absolute format', () => {
    const iso = '2026-02-20T08:15:00.000Z';
    render(
      <EvidencePanel
        evidence={[makeEvidence({ effectiveTime: iso })]}
        {...DEFAULT_PROPS}
      />,
    );

    // Should show relative time (e.g., "X hours ago") and absolute (Feb 20, 2026 08:15)
    expect(screen.getByText('Observed:')).toBeInTheDocument();
    expect(screen.getByText(/Feb 20, 2026/)).toBeInTheDocument();
  });

  it('renders sourceDoc excerpt in blockquote with truncated hash', () => {
    render(
      <EvidencePanel
        evidence={[
          makeEvidence({
            sourceDocExcerpt: 'Patient presented with severe dyspnea and hypoxia.',
            sourceDocHash: 'abcdef1234567890abcdef',
          }),
        ]}
        {...DEFAULT_PROPS}
      />,
    );

    expect(screen.getByText('Source Document')).toBeInTheDocument();
    expect(
      screen.getByText('Patient presented with severe dyspnea and hypoxia.'),
    ).toBeInTheDocument();
    // Hash should be truncated to first 8 chars
    expect(screen.getByText('#abcdef12')).toBeInTheDocument();
  });

  it('renders STRUCTURED badge in blue', () => {
    render(
      <EvidencePanel
        evidence={[makeEvidence({ extractedBy: 'STRUCTURED' })]}
        {...DEFAULT_PROPS}
      />,
    );

    const badge = screen.getByText('STRUCTURED');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-blue-700');
  });

  it('renders NLP badge in amber', () => {
    render(
      <EvidencePanel
        evidence={[makeEvidence({ extractedBy: 'NLP' })]}
        {...DEFAULT_PROPS}
      />,
    );

    const badge = screen.getByText('NLP');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-amber-700');
  });

  it('renders AFFIRMED badge in green', () => {
    render(
      <EvidencePanel
        evidence={[makeEvidence({ assertion: 'AFFIRMED' })]}
        {...DEFAULT_PROPS}
      />,
    );

    const badge = screen.getByText('AFFIRMED');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-green-700');
  });

  it('renders NEGATED badge in red', () => {
    render(
      <EvidencePanel
        evidence={[makeEvidence({ assertion: 'NEGATED' })]}
        {...DEFAULT_PROPS}
      />,
    );

    const badge = screen.getByText('NEGATED');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-red-700');
  });

  it('renders UNCERTAIN badge in amber', () => {
    render(
      <EvidencePanel
        evidence={[makeEvidence({ assertion: 'UNCERTAIN' })]}
        {...DEFAULT_PROPS}
      />,
    );

    const badge = screen.getByText('UNCERTAIN');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-amber-700');
  });

  it('renders confidence percentage', () => {
    render(
      <EvidencePanel
        evidence={[makeEvidence({ confidence: 0.87 })]}
        {...DEFAULT_PROPS}
      />,
    );

    expect(screen.getByText('87%')).toBeInTheDocument();
  });

  it('onClose callback fires when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <EvidencePanel
        evidence={[makeEvidence()]}
        criterionDescription="Test"
        onClose={onClose}
      />,
    );

    const closeButton = screen.getByLabelText('Close evidence panel');
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders evidence item count in footer', () => {
    render(
      <EvidencePanel
        evidence={[
          makeEvidence({ fhirRef: 'Obs/1' }),
          makeEvidence({ fhirRef: 'Obs/2' }),
          makeEvidence({ fhirRef: 'Obs/3' }),
        ]}
        {...DEFAULT_PROPS}
      />,
    );

    expect(screen.getByText(/3 evidence items/)).toBeInTheDocument();
  });
});
