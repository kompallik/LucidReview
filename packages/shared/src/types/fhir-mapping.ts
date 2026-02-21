import type { UmCaseData, UmClinicalData, UmCoverageData } from './um-system.js';

export interface NlpEntity {
  text: string;
  type: 'problem' | 'medication' | 'procedure' | 'lab' | 'anatomy' | 'sign_symptom';
  code?: string;
  codeSystem?: string;
  codeDisplay?: string;
  assertion: 'affirmed' | 'negated' | 'uncertain' | 'hypothetical' | 'historical';
  temporality?: 'recent' | 'historical' | 'future' | 'unknown';
  spans: Array<{ start: number; end: number }>;
  confidence?: number;
}

export interface FhirNormalizationResult {
  patientId: string;
  encounterId?: string;
  resourceIds: Array<{ type: string; id: string; ref: string }>;
}

export interface UmToFhirAdapter {
  mapCaseToBundle(caseData: UmCaseData, clinicalData: UmClinicalData): fhir4.Bundle;
  mapNlpEntitiesToResources(
    entities: NlpEntity[],
    patientRef: string,
    encounterId: string,
    documentRef: string
  ): fhir4.BundleEntry[];
  mapCoverageToCoverage(coverage: UmCoverageData, patientRef: string): fhir4.Coverage;
}
