import type fhir4 from 'fhir/r4';
import { randomUUID } from 'node:crypto';
import type { UmToFhirAdapter } from './fhir-mapper.js';
import type {
  UmCaseData,
  UmClinicalData,
  UmCoverageData,
  NlpEntity,
} from '@lucidreview/shared';
import { CODE_SYSTEMS } from '@lucidreview/shared';

const VITAL_LOINC: Record<string, string> = {
  spo2: '59408-5',
  'o2 sat': '59408-5',
  'oxygen saturation': '59408-5',
  rr: '9279-1',
  'respiratory rate': '9279-1',
  'resp rate': '9279-1',
  hr: '8867-4',
  'heart rate': '8867-4',
  pulse: '8867-4',
  sbp: '8480-6',
  dbp: '8462-4',
  'blood pressure': '55284-4',
  bp: '55284-4',
  temp: '8310-5',
  temperature: '8310-5',
  pao2: '2703-7',
  po2: '2703-7',
  paco2: '2019-8',
  pco2: '2019-8',
  ph: '2744-1',
};

function loincForVital(name: string): string | undefined {
  return VITAL_LOINC[name.toLowerCase()];
}

function uuid(): string {
  return randomUUID();
}

export class DefaultUmToFhirAdapter implements UmToFhirAdapter {
  mapCaseToBundle(
    caseData: UmCaseData,
    clinicalData: UmClinicalData,
  ): fhir4.Bundle {
    const entries: fhir4.BundleEntry[] = [];
    const patient = caseData.patient;
    const patientId = uuid();
    const encounterId = uuid();
    const practitionerId = uuid();
    const organizationId = uuid();

    // --- Patient ---
    const patientResource: fhir4.Patient = {
      resourceType: 'Patient',
      id: patientId,
      identifier: [
        ...(patient.mrn
          ? [
              {
                type: {
                  coding: [
                    {
                      system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                      code: 'MR',
                    },
                  ],
                },
                value: patient.mrn,
              },
            ]
          : []),
        {
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'MB',
              },
            ],
          },
          value: caseData.memberId,
        },
      ],
      name: [
        {
          family: patient.lastName,
          given: [patient.firstName],
        },
      ],
      gender: patient.gender,
      birthDate: patient.dateOfBirth,
    };
    entries.push({
      fullUrl: `urn:uuid:${patientId}`,
      resource: patientResource,
      request: { method: 'PUT', url: `Patient/${patientId}` },
    });

    // --- Encounter ---
    const encounter: fhir4.Encounter = {
      resourceType: 'Encounter',
      id: encounterId,
      status: 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'IMP',
        display: 'inpatient encounter',
      },
      subject: { reference: `Patient/${patientId}` },
      participant: [
        {
          individual: { reference: `Practitioner/${practitionerId}` },
        },
      ],
      serviceProvider: { reference: `Organization/${organizationId}` },
    };
    entries.push({
      fullUrl: `urn:uuid:${encounterId}`,
      resource: encounter,
      request: { method: 'PUT', url: `Encounter/${encounterId}` },
    });

    // --- Practitioner ---
    const provider = caseData.requestingProvider;
    const practitioner: fhir4.Practitioner = {
      resourceType: 'Practitioner',
      id: practitionerId,
      identifier: provider.npi
        ? [{ system: 'http://hl7.org/fhir/sid/us-npi', value: provider.npi }]
        : undefined,
      name: [{ text: provider.name }],
    };
    entries.push({
      fullUrl: `urn:uuid:${practitionerId}`,
      resource: practitioner,
      request: { method: 'PUT', url: `Practitioner/${practitionerId}` },
    });

    // --- Organization (facility) ---
    const facility = caseData.facility;
    const organization: fhir4.Organization = {
      resourceType: 'Organization',
      id: organizationId,
      identifier: facility.npi
        ? [{ system: 'http://hl7.org/fhir/sid/us-npi', value: facility.npi }]
        : undefined,
      name: facility.name,
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/organization-type',
              code: 'prov',
            },
          ],
        },
      ],
    };
    entries.push({
      fullUrl: `urn:uuid:${organizationId}`,
      resource: organization,
      request: { method: 'PUT', url: `Organization/${organizationId}` },
    });

    // --- Conditions (diagnoses) ---
    for (const dx of clinicalData.diagnoses) {
      const condId = uuid();
      const condition: fhir4.Condition = {
        resourceType: 'Condition',
        id: condId,
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'active',
            },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
              code: 'confirmed',
            },
          ],
        },
        code: {
          coding: [
            {
              system: CODE_SYSTEMS.ICD10CM,
              code: dx.code,
              display: dx.description,
            },
          ],
          text: dx.description,
        },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
      };
      entries.push({
        fullUrl: `urn:uuid:${condId}`,
        resource: condition,
        request: { method: 'PUT', url: `Condition/${condId}` },
      });
    }

    // --- Observations (vitals) ---
    for (const vital of clinicalData.vitals ?? []) {
      const obsId = uuid();
      const loincCode = loincForVital(vital.type);
      const observation: fhir4.Observation = {
        resourceType: 'Observation',
        id: obsId,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs',
              },
            ],
          },
        ],
        code: {
          coding: loincCode
            ? [
                {
                  system: CODE_SYSTEMS.LOINC,
                  code: loincCode,
                  display: vital.type,
                },
              ]
            : [],
          text: vital.type,
        },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: vital.observedAt,
        valueQuantity: {
          value: vital.value,
          unit: vital.unit,
          system: 'http://unitsofmeasure.org',
        },
      };
      entries.push({
        fullUrl: `urn:uuid:${obsId}`,
        resource: observation,
        request: { method: 'PUT', url: `Observation/${obsId}` },
      });
    }

    // --- Observations (labs) ---
    for (const lab of clinicalData.labs ?? []) {
      const obsId = uuid();
      const loincCode = lab.loincCode ?? loincForVital(lab.name);
      const observation: fhir4.Observation = {
        resourceType: 'Observation',
        id: obsId,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'laboratory',
                display: 'Laboratory',
              },
            ],
          },
        ],
        code: {
          coding: loincCode
            ? [
                {
                  system: CODE_SYSTEMS.LOINC,
                  code: loincCode,
                  display: lab.name,
                },
              ]
            : [],
          text: lab.name,
        },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: lab.collectedAt,
      };
      if (typeof lab.value === 'number') {
        observation.valueQuantity = {
          value: lab.value,
          unit: lab.unit ?? '',
          system: 'http://unitsofmeasure.org',
        };
      } else {
        observation.valueString = String(lab.value);
      }
      entries.push({
        fullUrl: `urn:uuid:${obsId}`,
        resource: observation,
        request: { method: 'PUT', url: `Observation/${obsId}` },
      });
    }

    // --- ServiceRequest ---
    const srId = uuid();
    const serviceRequest: fhir4.ServiceRequest = {
      resourceType: 'ServiceRequest',
      id: srId,
      status: 'active',
      intent: 'order',
      code: {
        coding: [
          {
            system: CODE_SYSTEMS.SNOMED,
            code: '32485007',
            display: 'Hospital admission',
          },
        ],
        text: caseData.serviceType,
      },
      subject: { reference: `Patient/${patientId}` },
      encounter: { reference: `Encounter/${encounterId}` },
      requester: { reference: `Practitioner/${practitionerId}` },
    };
    entries.push({
      fullUrl: `urn:uuid:${srId}`,
      resource: serviceRequest,
      request: { method: 'PUT', url: `ServiceRequest/${srId}` },
    });

    return {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: entries,
    };
  }

  mapNlpEntitiesToResources(
    entities: NlpEntity[],
    patientRef: string,
    encounterId: string,
    documentRef: string,
  ): fhir4.BundleEntry[] {
    const entries: fhir4.BundleEntry[] = [];

    for (const entity of entities) {
      const id = uuid();

      // Track whether a FHIR resource was created for this entity
      let resourceCreated = false;

      if (entity.type === 'problem') {
        let verificationCode: string;
        if (entity.assertion === 'affirmed') {
          verificationCode = 'confirmed';
        } else if (entity.assertion === 'negated') {
          verificationCode = 'refuted';
        } else {
          verificationCode = 'unconfirmed';
        }
        const condition: fhir4.Condition = {
          resourceType: 'Condition',
          id,
          verificationStatus: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
                code: verificationCode,
              },
            ],
          },
          code: {
            coding: entity.code
              ? [
                  {
                    system: entity.codeSystem ?? CODE_SYSTEMS.SNOMED,
                    code: entity.code,
                    display: entity.text,
                  },
                ]
              : [],
            text: entity.text,
          },
          subject: { reference: patientRef },
          encounter: { reference: `Encounter/${encounterId}` },
        };
        entries.push({
          fullUrl: `urn:uuid:${id}`,
          resource: condition,
          request: { method: 'PUT', url: `Condition/${id}` },
        });
        resourceCreated = true;
      } else if (entity.type === 'medication') {
        const medStatement: fhir4.MedicationStatement = {
          resourceType: 'MedicationStatement',
          id,
          status: entity.assertion === 'negated' ? 'not-taken' : 'active',
          medicationCodeableConcept: {
            coding: entity.code
              ? [
                  {
                    system: entity.codeSystem ?? CODE_SYSTEMS.RXNORM,
                    code: entity.code,
                    display: entity.text,
                  },
                ]
              : [],
            text: entity.text,
          },
          subject: { reference: patientRef },
          context: { reference: `Encounter/${encounterId}` },
        };
        entries.push({
          fullUrl: `urn:uuid:${id}`,
          resource: medStatement,
          request: { method: 'PUT', url: `MedicationStatement/${id}` },
        });
        resourceCreated = true;
      } else if (entity.type === 'lab') {
        const observation: fhir4.Observation = {
          resourceType: 'Observation',
          id,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'laboratory',
                },
              ],
            },
          ],
          code: {
            coding: entity.code
              ? [
                  {
                    system: entity.codeSystem ?? CODE_SYSTEMS.LOINC,
                    code: entity.code,
                    display: entity.text,
                  },
                ]
              : [],
            text: entity.text,
          },
          subject: { reference: patientRef },
          encounter: { reference: `Encounter/${encounterId}` },
        };
        entries.push({
          fullUrl: `urn:uuid:${id}`,
          resource: observation,
          request: { method: 'PUT', url: `Observation/${id}` },
        });
        resourceCreated = true;
      }

      // Only add Provenance when a resource was actually created —
      // avoids HAPI-0541 "unable to satisfy placeholder ID" when
      // entity types like 'other'/'sign_symptom' produce no FHIR resource
      if (resourceCreated) {
        const provenanceId = uuid();
        const provenance: fhir4.Provenance = {
          resourceType: 'Provenance',
          id: provenanceId,
          target: [{ reference: `urn:uuid:${id}` }],
          recorded: new Date().toISOString(),
          agent: [
            {
              type: {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
                    code: 'assembler',
                  },
                ],
              },
              who: { display: 'NLP Extraction (cTAKES)' },
            },
          ],
          entity: [
            {
              role: 'source',
              // Display-only ref — avoids HAPI-1094 external reference validation
              what: { display: documentRef },
            },
          ],
        };
        entries.push({
          fullUrl: `urn:uuid:${provenanceId}`,
          resource: provenance,
          request: { method: 'PUT', url: `Provenance/${provenanceId}` },
        });
      }
    }

    return entries;
  }

  mapCoverageToCoverage(
    coverage: UmCoverageData,
    patientRef: string,
  ): fhir4.Coverage {
    const id = uuid();
    return {
      resourceType: 'Coverage',
      id,
      status: coverage.coverageActive ? 'active' : 'cancelled',
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'MEDICARE',
            display: coverage.planName,
          },
        ],
      },
      subscriber: { reference: patientRef },
      beneficiary: { reference: patientRef },
      period: {
        start: coverage.effectiveDate,
        ...(coverage.terminationDate
          ? { end: coverage.terminationDate }
          : {}),
      },
      payor: [{ display: coverage.planName }],
    };
  }
}
