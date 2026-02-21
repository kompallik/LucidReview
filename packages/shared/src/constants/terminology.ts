export const CODE_SYSTEMS = {
  ICD10CM: 'http://hl7.org/fhir/sid/icd-10-cm',
  SNOMED: 'http://snomed.info/sct',
  LOINC: 'http://loinc.org',
  RXNORM: 'http://www.nlm.nih.gov/research/umls/rxnorm',
  CPT: 'http://www.ama-assn.org/go/cpt',
  HCPCS: 'https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets',
} as const;

export const LOINC_CODES = {
  SPO2: '59408-5', // Oxygen saturation by pulse oximetry
  PO2_ARTERIAL: '2703-7', // pO2 Arterial
  RESPIRATORY_RATE: '9279-1',
} as const;

export const ICD10_CODES = {
  ACUTE_RESP_FAILURE_UNSPEC: 'J96.00',
  ACUTE_RESP_FAILURE_HYPOXIA: 'J96.01',
  ACUTE_RESP_FAILURE_HYPERCARBIA: 'J96.02',
} as const;
