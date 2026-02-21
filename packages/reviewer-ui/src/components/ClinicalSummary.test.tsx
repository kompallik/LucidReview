import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ClinicalSummary from './ClinicalSummary.tsx';
import type { ClinicalFact } from '../api/client.ts';

afterEach(cleanup);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFact(overrides: Partial<ClinicalFact> = {}): ClinicalFact {
  return {
    category: 'Diagnosis',
    code: 'J96.00',
    codeSystem: 'ICD-10-CM',
    display: 'Acute respiratory failure, unspecified',
    source: 'STRUCTURED',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ClinicalSummary', () => {
  it('renders header when given empty facts array', () => {
    render(<ClinicalSummary facts={[]} />);

    expect(screen.getByText('Clinical Summary')).toBeInTheDocument();
  });

  it('does not render any category sections when facts are empty', () => {
    render(<ClinicalSummary facts={[]} />);

    expect(screen.queryByText('Diagnosis')).not.toBeInTheDocument();
    expect(screen.queryByText('Vital Signs')).not.toBeInTheDocument();
    expect(screen.queryByText('Lab Result')).not.toBeInTheDocument();
  });

  it('renders diagnosis with ICD-10 code and display text', () => {
    render(
      <ClinicalSummary
        facts={[
          makeFact({
            category: 'Diagnosis',
            code: 'J96.00',
            display: 'Acute respiratory failure, unspecified',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Diagnosis')).toBeInTheDocument();
    expect(screen.getByText('J96.00')).toBeInTheDocument();
    expect(screen.getByText('Acute respiratory failure, unspecified')).toBeInTheDocument();
  });

  it('renders vital sign with value and unit', () => {
    render(
      <ClinicalSummary
        facts={[
          makeFact({
            category: 'Vital Signs',
            code: '59408-5',
            display: 'Oxygen saturation (SpO2)',
            value: '87',
            unit: '%',
            source: 'STRUCTURED',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Vital Signs')).toBeInTheDocument();
    expect(screen.getByText('Oxygen saturation (SpO2)')).toBeInTheDocument();
    expect(screen.getByText('87')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('renders lab result with value, unit, and date', () => {
    render(
      <ClinicalSummary
        facts={[
          makeFact({
            category: 'Lab Result',
            code: '2703-7',
            display: 'PaO2 (Arterial Blood Gas)',
            value: '55',
            unit: 'mmHg',
            date: '2026-02-20T08:15:00.000Z',
            source: 'STRUCTURED',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Lab Result')).toBeInTheDocument();
    expect(screen.getByText('PaO2 (Arterial Blood Gas)')).toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('mmHg')).toBeInTheDocument();
    // date-fns format: 'MMM d HH:mm'
    expect(screen.getByText(/Feb 20/)).toBeInTheDocument();
  });

  it('renders STRUCTURED source badge', () => {
    render(
      <ClinicalSummary facts={[makeFact({ source: 'STRUCTURED' })]} />,
    );

    expect(screen.getByText('STRUCTURED')).toBeInTheDocument();
  });

  it('renders NLP source badge', () => {
    render(
      <ClinicalSummary
        facts={[
          makeFact({
            category: 'Diagnosis',
            code: 'J18.9',
            display: 'Pneumonia, unspecified organism',
            source: 'NLP',
          }),
        ]}
      />,
    );

    expect(screen.getByText('NLP')).toBeInTheDocument();
  });

  it('groups facts by category in the correct order', () => {
    render(
      <ClinicalSummary
        facts={[
          makeFact({ category: 'Medication', display: 'Albuterol nebulizer', code: undefined, source: 'NLP' }),
          makeFact({ category: 'Diagnosis', display: 'Acute respiratory failure', code: 'J96.00' }),
          makeFact({ category: 'Vital Signs', display: 'SpO2', code: '59408-5', value: '87', unit: '%' }),
        ]}
      />,
    );

    const categories = screen.getAllByText(/^(Diagnosis|Vital Signs|Medication)$/);
    // Diagnosis should come before Vital Signs, which should come before Medication
    expect(categories[0]).toHaveTextContent('Diagnosis');
    expect(categories[1]).toHaveTextContent('Vital Signs');
    expect(categories[2]).toHaveTextContent('Medication');
  });

  it('renders facts without code (code is optional)', () => {
    render(
      <ClinicalSummary
        facts={[
          makeFact({
            category: 'Medication',
            code: undefined,
            display: 'Albuterol 2.5mg nebulizer Q4H',
            source: 'NLP',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Albuterol 2.5mg nebulizer Q4H')).toBeInTheDocument();
  });

  it('renders provider category', () => {
    render(
      <ClinicalSummary
        facts={[
          makeFact({
            category: 'Provider',
            code: undefined,
            display: 'Dr. Sarah Chen, Pulmonology',
            source: 'STRUCTURED',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('Dr. Sarah Chen, Pulmonology')).toBeInTheDocument();
  });
});
