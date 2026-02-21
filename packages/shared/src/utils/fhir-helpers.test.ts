import { describe, it, expect } from 'vitest';
import { buildTransactionEntry, buildProvenance, getCodeDisplay, findCoding } from './fhir-helpers.js';

describe('buildTransactionEntry', () => {
  it('creates a POST entry with resourceType as URL', () => {
    const resource = { resourceType: 'Patient' } as fhir4.Resource;
    const entry = buildTransactionEntry(resource);
    expect(entry.request?.method).toBe('POST');
    expect(entry.request?.url).toBe('Patient');
    expect(entry.resource).toBe(resource);
  });

  it('creates a PUT entry with resourceType/id as URL', () => {
    const resource = { resourceType: 'Patient', id: '123' } as fhir4.Resource;
    const entry = buildTransactionEntry(resource, 'PUT');
    expect(entry.request?.method).toBe('PUT');
    expect(entry.request?.url).toBe('Patient/123');
  });

  it('uses resourceType as URL for PUT when id is missing', () => {
    const resource = { resourceType: 'Observation' } as fhir4.Resource;
    const entry = buildTransactionEntry(resource, 'PUT');
    expect(entry.request?.url).toBe('Observation');
  });
});

describe('buildProvenance', () => {
  it('creates a Provenance with target and agent', () => {
    const prov = buildProvenance('Patient/123', 'LucidReview Agent');
    expect(prov.resourceType).toBe('Provenance');
    expect(prov.target).toEqual([{ reference: 'Patient/123' }]);
    expect(prov.agent?.[0]?.who?.display).toBe('LucidReview Agent');
    expect(prov.recorded).toBeDefined();
  });

  it('includes reason when provided', () => {
    const prov = buildProvenance('Observation/456', 'Agent', 'NLP extraction');
    expect(prov.reason).toEqual([{ text: 'NLP extraction' }]);
  });

  it('omits reason when not provided', () => {
    const prov = buildProvenance('Patient/123', 'Agent');
    expect(prov.reason).toBeUndefined();
  });
});

describe('getCodeDisplay', () => {
  it('returns text when present', () => {
    const concept: fhir4.CodeableConcept = {
      text: 'Acute respiratory failure',
      coding: [{ display: 'Different display', code: 'J96.00' }],
    };
    expect(getCodeDisplay(concept)).toBe('Acute respiratory failure');
  });

  it('returns coding display when text is absent', () => {
    const concept: fhir4.CodeableConcept = {
      coding: [{ display: 'Oxygen saturation', code: '59408-5' }],
    };
    expect(getCodeDisplay(concept)).toBe('Oxygen saturation');
  });

  it('returns coding code when both text and display are absent', () => {
    const concept: fhir4.CodeableConcept = {
      coding: [{ code: 'J96.00' }],
    };
    expect(getCodeDisplay(concept)).toBe('J96.00');
  });

  it('returns empty string when no coding or text', () => {
    expect(getCodeDisplay({})).toBe('');
  });
});

describe('findCoding', () => {
  const concept: fhir4.CodeableConcept = {
    coding: [
      { system: 'http://loinc.org', code: '59408-5', display: 'SpO2' },
      { system: 'http://snomed.info/sct', code: '431314004', display: 'SpO2 monitoring' },
    ],
  };

  it('finds coding by matching system', () => {
    const coding = findCoding(concept, 'http://loinc.org');
    expect(coding).toBeDefined();
    expect(coding?.code).toBe('59408-5');
  });

  it('returns undefined for non-matching system', () => {
    const coding = findCoding(concept, 'http://www.ama-assn.org/go/cpt');
    expect(coding).toBeUndefined();
  });

  it('returns undefined when coding array is empty', () => {
    const coding = findCoding({}, 'http://loinc.org');
    expect(coding).toBeUndefined();
  });
});
