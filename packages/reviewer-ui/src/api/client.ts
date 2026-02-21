// ─── Types ────────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  caseNumber: string;
  status: string;
  determination?: string;
  urgency: string;
  serviceType?: string;
  primaryDiagnosisCode?: string;
  primaryDiagnosisDisplay?: string;
  latestRunId?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewDetail extends Review {
  latestRun?: AgentRun;
}

export interface AgentRun {
  id: string;
  caseNumber: string;
  status: string;
  modelId: string;
  totalTurns: number;
  determination?: DeterminationResult;
  error?: string;
  inputTokensTotal: number;
  outputTokensTotal: number;
  startedAt: string;
  completedAt?: string;
}

export interface DeterminationResult {
  decision: string;
  confidence: number;
  rationale?: string;
  policyBasis?: { policyId: string; title: string; version?: string }[];
  criteriaResults?: CriterionResult[];
  clinicalSummary?: ClinicalFact[];
  missingData?: string[];
}

export interface CriterionResult {
  criterionId: string;
  criterionName: string;
  result: 'MET' | 'NOT_MET' | 'UNKNOWN';
  evidence?: string;
  fhirReference?: string;
  value?: string;
  observedAt?: string;
  source?: 'STRUCTURED' | 'NLP';
}

export interface ClinicalFact {
  category: string;
  code?: string;
  codeSystem?: string;
  display: string;
  value?: string;
  unit?: string;
  date?: string;
  source: 'STRUCTURED' | 'NLP';
  fhirReference?: string;
}

export interface AgentToolCall {
  id: string;
  runId: string;
  turnNumber: number;
  toolName: string;
  input: unknown;
  output: unknown;
  latencyMs?: number;
  error?: string;
  createdAt: string;
}

export interface AgentTurn {
  id: string;
  runId: string;
  turnNumber: number;
  role: 'user' | 'assistant';
  content: unknown;
  stopReason?: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs?: number;
  createdAt: string;
}

export interface AgentTrace {
  turns: Array<{ turn: AgentTurn; toolCalls: AgentToolCall[] }>;
}

export interface DeterminationRequest {
  decision: string;
  overrideReason?: string;
  reviewerNotes?: string;
}

export interface Policy {
  id: string;
  policyType: string;
  cmsId?: string;
  title: string;
  status: string;
  effectiveDate?: string;
}

export interface HealthStatus {
  status: string;
  services: Record<string, string>;
}

// ─── API Client ───────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('lucidreview_token');
  const headers: Record<string, string> = {
    // Only set Content-Type when there is a body — Fastify rejects
    // Content-Type: application/json with an empty body (400 FST_ERR_CTP_EMPTY_JSON_BODY)
    ...(options?.body != null ? { 'Content-Type': 'application/json' } : {}),
    ...options?.headers as Record<string, string>,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('lucidreview_token');
      localStorage.removeItem('lucidreview_user');
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message ?? 'API error');
  }
  return response.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiFetch<{ token: string; user: { id: string; email: string; name: string; role: string } }>(
        '/api/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) }
      ),
    me: () => apiFetch<{ userId: string; email: string; role: string }>('/api/auth/me'),
  },
  reviews: {
    list: (params?: { status?: string }) =>
      apiFetch<Review[]>(`/api/reviews?${new URLSearchParams(params ?? {})}`),
    get: (caseNumber: string) =>
      apiFetch<ReviewDetail>(`/api/reviews/${caseNumber}`),
    runAgent: (caseNumber: string) =>
      apiFetch<{ runId: string }>(`/api/reviews/${caseNumber}/agent-run`, { method: 'POST' }),
    decide: (caseNumber: string, body: DeterminationRequest) =>
      apiFetch(`/api/reviews/${caseNumber}/determination`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
  agentRuns: {
    get: (runId: string) => apiFetch<AgentRun>(`/api/agent-runs/${runId}`),
    getTrace: (runId: string) => apiFetch<AgentTrace>(`/api/agent-runs/${runId}/trace`),
    cancel: (runId: string) => apiFetch(`/api/agent-runs/${runId}`, { method: 'DELETE' }),
  },
  policies: {
    list: () => apiFetch<Policy[]>('/api/policies'),
  },
  health: {
    check: () => apiFetch<HealthStatus>('/api/health'),
  },
};

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const queryKeys = {
  reviews: {
    all: ['reviews'] as const,
    list: (params?: { status?: string }) => ['reviews', params] as const,
    detail: (caseNumber: string) => ['reviews', caseNumber] as const,
  },
  agentRuns: {
    detail: (runId: string) => ['agent-runs', runId] as const,
    trace: (runId: string) => ['agent-runs', runId, 'trace'] as const,
  },
  policies: {
    all: ['policies'] as const,
  },
};
