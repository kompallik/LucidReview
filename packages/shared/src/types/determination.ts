export type DeterminationOutcome = 'AUTO_APPROVE' | 'MD_REVIEW' | 'DENY' | 'MORE_INFO';
export type CriteriaStatus = 'MET' | 'NOT_MET' | 'UNKNOWN';

export interface EvidenceItem {
  fhirRef: string;
  path: string;
  valueSeen: string | number | boolean;
  effectiveTime?: string;
  sourceDoc?: {
    documentReference: string;
    offsetStart?: number;
    offsetEnd?: number;
    quoteHash?: string;
    excerpt?: string;
  };
  assertion?: 'AFFIRMED' | 'NEGATED' | 'UNCERTAIN';
  extractedBy?: 'STRUCTURED' | 'NLP' | 'MANUAL';
  confidence?: number;
}

export interface CriteriaResult {
  criterionId: string;
  description: string;
  status: CriteriaStatus;
  evidence: EvidenceItem[];
  evaluatedBy: 'CQL' | 'NLP' | 'LLM' | 'MANUAL';
  confidence?: number;
}

export interface PolicyBasis {
  policyType: 'NCD' | 'LCD' | 'ARTICLE' | 'INTERNAL';
  policyId: string;
  policyTitle?: string;
  policyVersion?: string;
}

export interface MissingInfoRequest {
  questionId: string;
  question: string;
  dataElement: string;
  reason: string;
}

export interface DeterminationResult {
  determination: DeterminationOutcome;
  confidence: number;
  policyBasis: PolicyBasis[];
  criteriaResults: CriteriaResult[];
  denialOrEscalationRationale?: {
    summary: string;
    missingInfoRequests?: MissingInfoRequest[];
  };
  rationaleNarrative?: string;
  audit: {
    cqlLibraryVersion?: string;
    artifactBundleId?: string;
    llm?: {
      model: string;
      promptVersion: string;
      inputHash: string;
      outputHash: string;
    };
  };
}
