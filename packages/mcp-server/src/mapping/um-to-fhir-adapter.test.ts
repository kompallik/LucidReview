import { describe, it, expect } from 'vitest';
import type fhir4 from 'fhir/r4';
import type { UmCaseData, UmClinicalData, NlpEntity } from '@lucidreview/shared';
import { DefaultUmToFhirAdapter } from './um-to-fhir-adapter.js';

const CASE_DATA: UmCaseData = {
  caseNumber: 'ARF-2026-001',
  memberId: 'MBR-123456',
  status: 'PENDING_REVIEW',
  urgency: 'URGENT',
  serviceType: 'Inpatient Admission',
  requestDate: '2026-02-20T10:00:00Z',
  patient: {
    id: 'PAT-001',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1958-03-15',
    gender: 'male',
    mrn: 'MRN-789012',
  },
  requestingProvider: {
    id: 'PROV-001',
    name: 'Dr. Sarah Chen',
    npi: '1234567890',
    specialty: 'Emergency Medicine',
  },
  facility: {
    id: 'FAC-001',
    name: 'City General Hospital',
    npi: '9876543210',
  },
};

const CLINICAL_DATA: UmClinicalData = {
  caseNumber: 'ARF-2026-001',
  diagnoses: [
    {
      code: 'J96.00',
      codeSystem: 'ICD-10-CM',
      description: 'Acute respiratory failure',
      type: 'PRIMARY',
    },
    {
      code: 'J44.1',
      codeSystem: 'ICD-10-CM',
      description: 'COPD with acute exacerbation',
      type: 'SECONDARY',
    },
  ],
  procedures: [],
  vitals: [
    { type: 'SpO2', value: 87, unit: '%', observedAt: '2026-02-20T08:00:00Z' },
    { type: 'Respiratory Rate', value: 28, unit: 'breaths/min', observedAt: '2026-02-20T08:00:00Z' },
    { type: 'Heart Rate', value: 110, unit: 'bpm', observedAt: '2026-02-20T08:00:00Z' },
  ],
  labs: [
    { name: 'pO2', value: 55, unit: 'mmHg', loincCode: '2703-7', collectedAt: '2026-02-20T08:00:00Z' },
    { name: 'pH', value: 7.31, unit: '', loincCode: '2744-1', collectedAt: '2026-02-20T08:00:00Z' },
  ],
};

function findResources<T extends fhir4.Resource>(
  bundle: fhir4.Bundle,
  resourceType: string,
): T[] {
  return (bundle.entry ?? [])
    .map((e) => e.resource)
    .filter((r): r is fhir4.FhirResource => r?.resourceType === resourceType) as unknown as T[];
}

describe('DefaultUmToFhirAdapter', () => {
  const adapter = new DefaultUmToFhirAdapter();

  describe('mapCaseToBundle', () => {
    it('produces a FHIR transaction Bundle', () => {
      const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
      expect(bundle.resourceType).toBe('Bundle');
      expect(bundle.type).toBe('transaction');
      expect(bundle.entry).toBeDefined();
      expect(bundle.entry!.length).toBeGreaterThan(0);
    });

    it('all entries have request with method PUT', () => {
      const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
      for (const entry of bundle.entry!) {
        expect(entry.request).toBeDefined();
        expect(entry.request!.method).toBe('PUT');
      }
    });

    describe('Patient resource', () => {
      it('maps patient name correctly', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const patients = findResources<fhir4.Patient>(bundle, 'Patient');
        expect(patients).toHaveLength(1);
        const patient = patients[0];
        expect(patient.name?.[0]?.family).toBe('Doe');
        expect(patient.name?.[0]?.given).toEqual(['John']);
      });

      it('maps birthDate correctly', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const patient = findResources<fhir4.Patient>(bundle, 'Patient')[0];
        expect(patient.birthDate).toBe('1958-03-15');
      });

      it('maps gender correctly', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const patient = findResources<fhir4.Patient>(bundle, 'Patient')[0];
        expect(patient.gender).toBe('male');
      });

      it('includes MRN and member ID identifiers', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const patient = findResources<fhir4.Patient>(bundle, 'Patient')[0];
        const identifiers = patient.identifier ?? [];
        const mrn = identifiers.find((id) =>
          id.type?.coding?.some((c) => c.code === 'MR'),
        );
        const memberId = identifiers.find((id) =>
          id.type?.coding?.some((c) => c.code === 'MB'),
        );
        expect(mrn?.value).toBe('MRN-789012');
        expect(memberId?.value).toBe('MBR-123456');
      });
    });

    describe('Condition resources (diagnoses)', () => {
      it('creates a Condition for each diagnosis', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const conditions = findResources<fhir4.Condition>(bundle, 'Condition');
        expect(conditions).toHaveLength(2);
      });

      it('maps ICD-10-CM code J96.00 correctly', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const conditions = findResources<fhir4.Condition>(bundle, 'Condition');
        const arf = conditions.find((c) =>
          c.code?.coding?.some((cd) => cd.code === 'J96.00'),
        );
        expect(arf).toBeDefined();
        expect(arf!.code?.coding?.[0]?.system).toBe(
          'http://hl7.org/fhir/sid/icd-10-cm',
        );
        expect(arf!.code?.coding?.[0]?.display).toBe('Acute respiratory failure');
      });

      it('sets clinicalStatus to active', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const conditions = findResources<fhir4.Condition>(bundle, 'Condition');
        for (const cond of conditions) {
          expect(cond.clinicalStatus?.coding?.[0]?.code).toBe('active');
        }
      });

      it('sets verificationStatus to confirmed', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const conditions = findResources<fhir4.Condition>(bundle, 'Condition');
        for (const cond of conditions) {
          expect(cond.verificationStatus?.coding?.[0]?.code).toBe('confirmed');
        }
      });
    });

    describe('Observation resources (vitals)', () => {
      it('creates Observations for vitals with LOINC codes', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const observations = findResources<fhir4.Observation>(bundle, 'Observation');
        const vitalObs = observations.filter((o) =>
          o.category?.some((c) =>
            c.coding?.some((cd) => cd.code === 'vital-signs'),
          ),
        );
        expect(vitalObs).toHaveLength(3); // SpO2, RR, HR
      });

      it('maps SpO2 with correct LOINC code 59408-5', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const observations = findResources<fhir4.Observation>(bundle, 'Observation');
        const spo2 = observations.find((o) =>
          o.code?.coding?.some((c) => c.code === '59408-5'),
        );
        expect(spo2).toBeDefined();
        expect(spo2!.code?.coding?.[0]?.system).toBe('http://loinc.org');
      });

      it('maps SpO2 valueQuantity correctly', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const observations = findResources<fhir4.Observation>(bundle, 'Observation');
        const spo2 = observations.find((o) =>
          o.code?.coding?.some((c) => c.code === '59408-5'),
        );
        expect(spo2!.valueQuantity?.value).toBe(87);
        expect(spo2!.valueQuantity?.unit).toBe('%');
      });

      it('maps Respiratory Rate with LOINC code 9279-1', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const observations = findResources<fhir4.Observation>(bundle, 'Observation');
        const rr = observations.find((o) =>
          o.code?.coding?.some((c) => c.code === '9279-1'),
        );
        expect(rr).toBeDefined();
        expect(rr!.valueQuantity?.value).toBe(28);
      });
    });

    describe('Observation resources (labs)', () => {
      it('creates lab Observations with correct LOINC codes', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const observations = findResources<fhir4.Observation>(bundle, 'Observation');
        const labObs = observations.filter((o) =>
          o.category?.some((c) =>
            c.coding?.some((cd) => cd.code === 'laboratory'),
          ),
        );
        expect(labObs).toHaveLength(2); // pO2, pH
      });

      it('maps pO2 with LOINC code 2703-7 and value 55', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const observations = findResources<fhir4.Observation>(bundle, 'Observation');
        const po2 = observations.find((o) =>
          o.code?.coding?.some((c) => c.code === '2703-7'),
        );
        expect(po2).toBeDefined();
        expect(po2!.valueQuantity?.value).toBe(55);
        expect(po2!.valueQuantity?.unit).toBe('mmHg');
      });
    });

    describe('Other resources', () => {
      it('creates an Encounter with IMP class', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const encounters = findResources<fhir4.Encounter>(bundle, 'Encounter');
        expect(encounters).toHaveLength(1);
        expect(encounters[0].class.code).toBe('IMP');
      });

      it('creates a ServiceRequest', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        const srs = findResources<fhir4.ServiceRequest>(bundle, 'ServiceRequest');
        expect(srs).toHaveLength(1);
        expect(srs[0].intent).toBe('order');
        expect(srs[0].code?.text).toBe('Inpatient Admission');
      });

      it('creates Practitioner and Organization', () => {
        const bundle = adapter.mapCaseToBundle(CASE_DATA, CLINICAL_DATA);
        expect(findResources(bundle, 'Practitioner')).toHaveLength(1);
        expect(findResources(bundle, 'Organization')).toHaveLength(1);
      });
    });
  });

  describe('mapNlpEntitiesToResources', () => {
    const patientRef = 'Patient/test-patient-id';
    const encounterId = 'test-encounter-id';
    const documentRef = 'DocumentReference/doc-1';

    it('maps affirmed problem entity to a confirmed Condition', () => {
      const entities: NlpEntity[] = [
        {
          text: 'acute respiratory failure',
          type: 'problem',
          code: 'J96.00',
          codeSystem: 'http://hl7.org/fhir/sid/icd-10-cm',
          assertion: 'affirmed',
          spans: [{ start: 0, end: 27 }],
        },
      ];
      const entries = adapter.mapNlpEntitiesToResources(
        entities,
        patientRef,
        encounterId,
        documentRef,
      );
      // Should produce: Condition + Provenance
      expect(entries).toHaveLength(2);
      const condition = entries[0].resource as fhir4.Condition;
      expect(condition.resourceType).toBe('Condition');
      expect(condition.verificationStatus?.coding?.[0]?.code).toBe('confirmed');
      expect(condition.code?.coding?.[0]?.code).toBe('J96.00');
      expect(condition.subject?.reference).toBe(patientRef);
    });

    it('maps negated problem entity to a refuted Condition', () => {
      const entities: NlpEntity[] = [
        {
          text: 'pneumonia',
          type: 'problem',
          code: 'J18.9',
          codeSystem: 'http://hl7.org/fhir/sid/icd-10-cm',
          assertion: 'negated',
          spans: [{ start: 10, end: 19 }],
        },
      ];
      const entries = adapter.mapNlpEntitiesToResources(
        entities,
        patientRef,
        encounterId,
        documentRef,
      );
      const condition = entries[0].resource as fhir4.Condition;
      expect(condition.verificationStatus?.coding?.[0]?.code).toBe('refuted');
    });

    it('maps uncertain problem entity to an unconfirmed Condition', () => {
      const entities: NlpEntity[] = [
        {
          text: 'possible PE',
          type: 'problem',
          assertion: 'uncertain',
          spans: [{ start: 0, end: 11 }],
        },
      ];
      const entries = adapter.mapNlpEntitiesToResources(
        entities,
        patientRef,
        encounterId,
        documentRef,
      );
      const condition = entries[0].resource as fhir4.Condition;
      expect(condition.verificationStatus?.coding?.[0]?.code).toBe('unconfirmed');
    });

    it('creates Provenance for each NLP-derived resource', () => {
      const entities: NlpEntity[] = [
        {
          text: 'acute respiratory failure',
          type: 'problem',
          code: 'J96.00',
          codeSystem: 'http://hl7.org/fhir/sid/icd-10-cm',
          assertion: 'affirmed',
          spans: [{ start: 0, end: 27 }],
        },
      ];
      const entries = adapter.mapNlpEntitiesToResources(
        entities,
        patientRef,
        encounterId,
        documentRef,
      );
      const provenance = entries.find(
        (e) => e.resource?.resourceType === 'Provenance',
      )?.resource as fhir4.Provenance;
      expect(provenance).toBeDefined();
      expect(provenance.agent?.[0]?.who?.display).toContain('NLP');
      expect(provenance.entity?.[0]?.what?.reference).toBe(documentRef);
    });

    it('maps medication entity to MedicationStatement', () => {
      const entities: NlpEntity[] = [
        {
          text: 'albuterol',
          type: 'medication',
          code: '435',
          codeSystem: 'http://www.nlm.nih.gov/research/umls/rxnorm',
          assertion: 'affirmed',
          spans: [{ start: 50, end: 59 }],
        },
      ];
      const entries = adapter.mapNlpEntitiesToResources(
        entities,
        patientRef,
        encounterId,
        documentRef,
      );
      const med = entries[0].resource as fhir4.MedicationStatement;
      expect(med.resourceType).toBe('MedicationStatement');
      expect(med.status).toBe('active');
      expect(med.medicationCodeableConcept?.text).toBe('albuterol');
    });

    it('maps negated medication to not-taken status', () => {
      const entities: NlpEntity[] = [
        {
          text: 'aspirin',
          type: 'medication',
          assertion: 'negated',
          spans: [{ start: 0, end: 7 }],
        },
      ];
      const entries = adapter.mapNlpEntitiesToResources(
        entities,
        patientRef,
        encounterId,
        documentRef,
      );
      const med = entries[0].resource as fhir4.MedicationStatement;
      expect(med.status).toBe('not-taken');
    });

    it('maps lab entity to Observation with laboratory category', () => {
      const entities: NlpEntity[] = [
        {
          text: 'WBC 14.2',
          type: 'lab',
          code: '6690-2',
          codeSystem: 'http://loinc.org',
          assertion: 'affirmed',
          spans: [{ start: 100, end: 108 }],
        },
      ];
      const entries = adapter.mapNlpEntitiesToResources(
        entities,
        patientRef,
        encounterId,
        documentRef,
      );
      const obs = entries[0].resource as fhir4.Observation;
      expect(obs.resourceType).toBe('Observation');
      expect(obs.category?.[0]?.coding?.[0]?.code).toBe('laboratory');
    });

    it('produces 2 entries per entity (resource + provenance)', () => {
      const entities: NlpEntity[] = [
        {
          text: 'COPD',
          type: 'problem',
          code: 'J44.1',
          codeSystem: 'http://hl7.org/fhir/sid/icd-10-cm',
          assertion: 'affirmed',
          spans: [{ start: 0, end: 4 }],
        },
        {
          text: 'albuterol',
          type: 'medication',
          code: '435',
          codeSystem: 'http://www.nlm.nih.gov/research/umls/rxnorm',
          assertion: 'affirmed',
          spans: [{ start: 10, end: 19 }],
        },
      ];
      const entries = adapter.mapNlpEntitiesToResources(
        entities,
        patientRef,
        encounterId,
        documentRef,
      );
      // 2 entities × 2 entries each = 4
      expect(entries).toHaveLength(4);
    });
  });

  describe('mapCoverageToCoverage', () => {
    it('maps active coverage correctly', () => {
      const coverage = adapter.mapCoverageToCoverage(
        {
          memberId: 'MBR-123456',
          planId: 'PLAN-1',
          planName: 'Medicare Part A',
          planType: 'Medicare',
          effectiveDate: '2023-01-01',
          coverageActive: true,
          benefits: [],
        },
        'Patient/test',
      );
      expect(coverage.resourceType).toBe('Coverage');
      expect(coverage.status).toBe('active');
      expect(coverage.beneficiary?.reference).toBe('Patient/test');
      expect(coverage.period?.start).toBe('2023-01-01');
    });

    it('maps inactive coverage to cancelled status', () => {
      const coverage = adapter.mapCoverageToCoverage(
        {
          memberId: 'MBR-999',
          planId: 'PLAN-2',
          planName: 'Old Plan',
          planType: 'Commercial',
          effectiveDate: '2020-01-01',
          terminationDate: '2022-12-31',
          coverageActive: false,
          benefits: [],
        },
        'Patient/test',
      );
      expect(coverage.status).toBe('cancelled');
      expect(coverage.period?.end).toBe('2022-12-31');
    });
  });
});
