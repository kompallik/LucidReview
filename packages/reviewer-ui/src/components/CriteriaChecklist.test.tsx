import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CriteriaChecklist from './CriteriaChecklist.tsx';
import type { CriterionResult } from '../api/client.ts';

afterEach(cleanup);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCriterion(overrides: Partial<CriterionResult> = {}): CriterionResult {
  return {
    criterionId: 'crit-001',
    criterionName: 'Has Acute Respiratory Failure Diagnosis',
    result: 'MET',
    evidence: 'ICD-10 J96.00',
    fhirReference: 'Condition/arf-001',
    source: 'STRUCTURED',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CriteriaChecklist', () => {
  it('renders empty state when no criteria are provided', () => {
    render(<CriteriaChecklist criteria={[]} />);

    expect(screen.getByText('Criteria Evaluation')).toBeInTheDocument();
    expect(screen.getByText('0/0 met')).toBeInTheDocument();
  });

  it('renders MET criterion with Met badge', () => {
    render(
      <CriteriaChecklist
        criteria={[makeCriterion({ result: 'MET', criterionName: 'Diagnosis Confirmed' })]}
      />,
    );

    expect(screen.getByText('Met')).toBeInTheDocument();
    expect(screen.getByText('Diagnosis Confirmed')).toBeInTheDocument();
    expect(screen.getByText('1/1 met')).toBeInTheDocument();
  });

  it('renders NOT_MET criterion with Not Met badge', () => {
    render(
      <CriteriaChecklist
        criteria={[
          makeCriterion({
            criterionId: 'crit-002',
            result: 'NOT_MET',
            criterionName: 'O2 Saturation Below Threshold',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Not Met')).toBeInTheDocument();
    expect(screen.getByText('O2 Saturation Below Threshold')).toBeInTheDocument();
    expect(screen.getByText('0/1 met')).toBeInTheDocument();
  });

  it('renders UNKNOWN criterion with Unknown badge', () => {
    render(
      <CriteriaChecklist
        criteria={[
          makeCriterion({
            criterionId: 'crit-003',
            result: 'UNKNOWN',
            criterionName: 'ABG Results Available',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('ABG Results Available')).toBeInTheDocument();
    expect(screen.getByText('0/1 met')).toBeInTheDocument();
  });

  it('expands evidence detail on click showing fhirReference', async () => {
    const user = userEvent.setup();
    render(
      <CriteriaChecklist
        criteria={[
          makeCriterion({
            fhirReference: 'Observation/spo2-001',
            evidence: 'SpO2 87% recorded at 08:15',
          }),
        ]}
      />,
    );

    // Evidence detail should not be visible initially
    expect(screen.queryByText('FHIR Ref:')).not.toBeInTheDocument();

    // Click to expand
    const button = screen.getByText('Has Acute Respiratory Failure Diagnosis').closest('button')!;
    await user.click(button);

    // Evidence detail should now show
    expect(screen.getByText('FHIR Ref:')).toBeInTheDocument();
    expect(screen.getByText('Observation/spo2-001')).toBeInTheDocument();
    expect(screen.getByText('SpO2 87% recorded at 08:15')).toBeInTheDocument();
  });

  it('shows value when expanded', async () => {
    const user = userEvent.setup();
    render(
      <CriteriaChecklist
        criteria={[
          makeCriterion({ value: '87%' }),
        ]}
      />,
    );

    // Value should appear in the row
    expect(screen.getByText('87%')).toBeInTheDocument();

    // Expand to see evidence detail with value
    const button = screen.getByText('Has Acute Respiratory Failure Diagnosis').closest('button')!;
    await user.click(button);

    expect(screen.getByText('Value:')).toBeInTheDocument();
  });

  it('shows observed time when expanded', async () => {
    const user = userEvent.setup();
    render(
      <CriteriaChecklist
        criteria={[
          makeCriterion({ observedAt: '2026-02-20T08:15:00.000Z' }),
        ]}
      />,
    );

    const button = screen.getByText('Has Acute Respiratory Failure Diagnosis').closest('button')!;
    await user.click(button);

    expect(screen.getByText('Observed:')).toBeInTheDocument();
    // date-fns format: 'MMM d, yyyy HH:mm'
    expect(screen.getByText(/Feb 20, 2026/)).toBeInTheDocument();
  });

  it('shows STRUCTURED source tag when expanded', async () => {
    const user = userEvent.setup();
    render(
      <CriteriaChecklist
        criteria={[makeCriterion({ source: 'STRUCTURED' })]}
      />,
    );

    const button = screen.getByText('Has Acute Respiratory Failure Diagnosis').closest('button')!;
    await user.click(button);

    expect(screen.getByText('Source:')).toBeInTheDocument();
    expect(screen.getByText('STRUCTURED')).toBeInTheDocument();
  });

  it('shows NLP source tag when expanded', async () => {
    const user = userEvent.setup();
    render(
      <CriteriaChecklist
        criteria={[makeCriterion({ source: 'NLP' })]}
      />,
    );

    const button = screen.getByText('Has Acute Respiratory Failure Diagnosis').closest('button')!;
    await user.click(button);

    expect(screen.getByText('NLP')).toBeInTheDocument();
  });

  it('renders multiple criteria in order with correct met count', () => {
    render(
      <CriteriaChecklist
        criteria={[
          makeCriterion({ criterionId: 'c1', criterionName: 'First Criterion', result: 'MET' }),
          makeCriterion({ criterionId: 'c2', criterionName: 'Second Criterion', result: 'NOT_MET' }),
          makeCriterion({ criterionId: 'c3', criterionName: 'Third Criterion', result: 'MET' }),
          makeCriterion({ criterionId: 'c4', criterionName: 'Fourth Criterion', result: 'UNKNOWN' }),
        ]}
      />,
    );

    expect(screen.getByText('First Criterion')).toBeInTheDocument();
    expect(screen.getByText('Second Criterion')).toBeInTheDocument();
    expect(screen.getByText('Third Criterion')).toBeInTheDocument();
    expect(screen.getByText('Fourth Criterion')).toBeInTheDocument();
    expect(screen.getByText('2/4 met')).toBeInTheDocument();
  });

  it('collapses evidence detail when clicked again', async () => {
    const user = userEvent.setup();
    render(
      <CriteriaChecklist
        criteria={[makeCriterion({ fhirReference: 'Condition/arf-001' })]}
      />,
    );

    const button = screen.getByText('Has Acute Respiratory Failure Diagnosis').closest('button')!;

    // Expand
    await user.click(button);
    expect(screen.getByText('FHIR Ref:')).toBeInTheDocument();

    // Collapse
    await user.click(button);
    expect(screen.queryByText('FHIR Ref:')).not.toBeInTheDocument();
  });

  it('shows View Evidence button when criterion has evidence and callback provided', () => {
    const onViewEvidence = vi.fn();
    render(
      <CriteriaChecklist
        criteria={[makeCriterion({ evidence: 'ICD-10 J96.00', fhirReference: 'Condition/arf-001' })]}
        onViewEvidence={onViewEvidence}
      />,
    );

    expect(screen.getByText('View Evidence')).toBeInTheDocument();
  });

  it('does not show View Evidence button when no callback is provided', () => {
    render(
      <CriteriaChecklist
        criteria={[makeCriterion({ evidence: 'ICD-10 J96.00' })]}
      />,
    );

    expect(screen.queryByText('View Evidence')).not.toBeInTheDocument();
  });

  it('calls onViewEvidence with criterionId and name when clicked', async () => {
    const user = userEvent.setup();
    const onViewEvidence = vi.fn();
    render(
      <CriteriaChecklist
        criteria={[
          makeCriterion({
            criterionId: 'crit-123',
            criterionName: 'O2 Below Threshold',
            evidence: 'SpO2 87%',
          }),
        ]}
        onViewEvidence={onViewEvidence}
      />,
    );

    const viewBtn = screen.getByText('View Evidence');
    await user.click(viewBtn);

    expect(onViewEvidence).toHaveBeenCalledOnce();
    expect(onViewEvidence).toHaveBeenCalledWith('crit-123', 'O2 Below Threshold');
  });

  it('does not show View Evidence button when criterion has no evidence or fhirReference', () => {
    const onViewEvidence = vi.fn();
    render(
      <CriteriaChecklist
        criteria={[
          makeCriterion({
            evidence: undefined,
            fhirReference: undefined,
          }),
        ]}
        onViewEvidence={onViewEvidence}
      />,
    );

    expect(screen.queryByText('View Evidence')).not.toBeInTheDocument();
  });
});
