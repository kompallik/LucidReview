export interface UmCaseData {
  caseNumber: string;
  memberId: string;
  status: string;
  urgency: 'STANDARD' | 'URGENT' | 'RETROSPECTIVE';
  serviceType: string;
  requestDate: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'other' | 'unknown';
    mrn?: string;
  };
  requestingProvider: {
    id: string;
    name: string;
    npi?: string;
    specialty?: string;
  };
  facility: {
    id: string;
    name: string;
    npi?: string;
    address?: string;
  };
}

export interface UmClinicalData {
  caseNumber: string;
  diagnoses: Array<{
    code: string;
    codeSystem: 'ICD-10-CM' | 'ICD-10-PCS';
    description: string;
    type: 'PRIMARY' | 'SECONDARY' | 'ADMITTING';
  }>;
  procedures: Array<{
    code: string;
    codeSystem: 'CPT' | 'HCPCS' | 'ICD-10-PCS';
    description: string;
  }>;
  vitals?: Array<{
    type: string;
    value: number;
    unit: string;
    observedAt: string;
  }>;
  labs?: Array<{
    name: string;
    loincCode?: string;
    value: number | string;
    unit?: string;
    referenceRange?: string;
    collectedAt: string;
  }>;
}

export interface UmAttachment {
  attachmentId: string;
  fileName: string;
  mimeType: string;
  uploadDate: string;
  category: 'CLINICAL_NOTE' | 'LAB_RESULT' | 'IMAGING' | 'DISCHARGE_SUMMARY' | 'OTHER';
  fileSizeBytes?: number;
}

export interface UmCoverageData {
  memberId: string;
  planId: string;
  planName: string;
  planType: string;
  groupNumber?: string;
  effectiveDate: string;
  terminationDate?: string;
  coverageActive: boolean;
  benefits: Array<{
    benefitType: string;
    covered: boolean;
    requiresAuth: boolean;
    authCriteria?: string;
  }>;
}

export interface UmHistoryEntry {
  timestamp: string;
  action: string;
  actor: string;
  actorRole?: string;
  notes?: string;
  previousStatus?: string;
  newStatus?: string;
}

export interface UmCaseNote {
  noteId: string;
  author: string;
  authorRole?: string;
  timestamp: string;
  text: string;
  noteType: 'CLINICAL' | 'ADMINISTRATIVE' | 'REVIEWER' | 'DENIAL_REASON';
}
