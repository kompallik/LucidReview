import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type fhir4 from 'fhir/r4';
import type { HapiFhirClient } from '../../adapters/hapi-fhir-client.js';

interface PatientSummary {
  patient: {
    id: string;
    name: string;
    birthDate: string;
    gender: string;
  };
  conditions: Array<{ id: string; code: string; display: string; status: string }>;
  observations: Array<{
    id: string;
    code: string;
    display: string;
    value: string;
    effectiveDateTime: string;
    category: string;
  }>;
  medications: Array<{ id: string; display: string; status: string }>;
  serviceRequests: Array<{ id: string; display: string; status: string }>;
}

function extractName(patient: fhir4.Patient): string {
  const name = patient.name?.[0];
  if (!name) return 'Unknown';
  const given = name.given?.join(' ') ?? '';
  return `${given} ${name.family ?? ''}`.trim();
}

function extractValue(obs: fhir4.Observation): string {
  if (obs.valueQuantity) {
    return `${obs.valueQuantity.value} ${obs.valueQuantity.unit ?? ''}`.trim();
  }
  if (obs.valueString) return obs.valueString;
  if (obs.valueCodeableConcept) {
    return obs.valueCodeableConcept.text ?? obs.valueCodeableConcept.coding?.[0]?.display ?? '';
  }
  return '';
}

export function registerGetPatientSummary(
  server: McpServer,
  fhirClient: HapiFhirClient,
) {
  server.tool(
    'fhir_get_patient_summary',
    'Get a structured summary of all FHIR data for a patient including conditions, observations, medications, and service requests.',
    {
      patientId: z.string().describe('The FHIR Patient resource ID'),
    },
    async ({ patientId }) => {
      // Use $everything to fetch all patient-related resources
      const bundle = (await fhirClient.operation(
        'Patient',
        patientId,
        '$everything',
      )) as fhir4.Bundle;

      const resources = bundle.entry?.map((e) => e.resource) ?? [];

      const patient = resources.find(
        (r): r is fhir4.Patient => r?.resourceType === 'Patient',
      );

      const conditions = resources
        .filter((r): r is fhir4.Condition => r?.resourceType === 'Condition')
        .map((c) => ({
          id: c.id ?? '',
          code: c.code?.coding?.[0]?.code ?? '',
          display: c.code?.text ?? c.code?.coding?.[0]?.display ?? '',
          status: c.clinicalStatus?.coding?.[0]?.code ?? 'unknown',
        }));

      const observations = resources
        .filter((r): r is fhir4.Observation => r?.resourceType === 'Observation')
        .map((o) => ({
          id: o.id ?? '',
          code: o.code?.coding?.[0]?.code ?? '',
          display: o.code?.text ?? o.code?.coding?.[0]?.display ?? '',
          value: extractValue(o),
          effectiveDateTime: o.effectiveDateTime ?? '',
          category: o.category?.[0]?.coding?.[0]?.code ?? '',
        }));

      const medications = resources
        .filter(
          (r): r is fhir4.MedicationStatement =>
            r?.resourceType === 'MedicationStatement',
        )
        .map((m) => ({
          id: m.id ?? '',
          display:
            m.medicationCodeableConcept?.text ??
            m.medicationCodeableConcept?.coding?.[0]?.display ??
            '',
          status: m.status,
        }));

      const serviceRequests = resources
        .filter(
          (r): r is fhir4.ServiceRequest =>
            r?.resourceType === 'ServiceRequest',
        )
        .map((s) => ({
          id: s.id ?? '',
          display: s.code?.text ?? s.code?.coding?.[0]?.display ?? '',
          status: s.status,
        }));

      const summary: PatientSummary = {
        patient: {
          id: patientId,
          name: patient ? extractName(patient) : 'Unknown',
          birthDate: patient?.birthDate ?? '',
          gender: patient?.gender ?? '',
        },
        conditions,
        observations,
        medications,
        serviceRequests,
      };

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(summary, null, 2) },
        ],
      };
    },
  );
}
