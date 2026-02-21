# LucidReview API — curl Examples

Base URL: `http://localhost:3000`

---

## Health Check

```bash
curl -s http://localhost:3000/api/health | jq
```

```json
{
  "status": "ok",
  "version": "0.1.0",
  "services": {
    "mysql": "up",
    "hapiFhir": "up",
    "redis": "up",
    "ctakes": "up"
  }
}
```

---

## Reviews

### List reviews

```bash
curl -s http://localhost:3000/api/reviews | jq
```

Filter by status:

```bash
curl -s 'http://localhost:3000/api/reviews?status=pending' | jq
```

```json
[
  {
    "id": "rev-001",
    "caseNumber": "ARF-2026-001",
    "status": "pending",
    "determination": null,
    "urgency": "URGENT",
    "serviceType": "Inpatient Admission",
    "primaryDiagnosisCode": "J96.00",
    "primaryDiagnosisDisplay": "Acute respiratory failure",
    "latestRunId": null,
    "createdAt": "2026-02-20T08:00:00.000Z",
    "updatedAt": "2026-02-20T08:00:00.000Z"
  }
]
```

### Get review detail

```bash
curl -s http://localhost:3000/api/reviews/ARF-2026-001 | jq
```

```json
{
  "id": "rev-001",
  "caseNumber": "ARF-2026-001",
  "status": "in_review",
  "determination": null,
  "urgency": "URGENT",
  "serviceType": "Inpatient Admission",
  "primaryDiagnosisCode": "J96.00",
  "primaryDiagnosisDisplay": "Acute respiratory failure",
  "latestRunId": "run-abc-123",
  "latestRun": {
    "id": "run-abc-123",
    "caseNumber": "ARF-2026-001",
    "status": "completed",
    "modelId": "us.anthropic.claude-sonnet-4-6",
    "totalTurns": 12,
    "determination": {
      "decision": "AUTO_APPROVE",
      "confidence": 0.95,
      "rationale": "All admission criteria met...",
      "criteriaResults": [
        {
          "criterionId": "has-resp-failure-dx",
          "criterionName": "Has Acute Respiratory Failure Diagnosis",
          "result": "MET",
          "evidence": "ICD-10 J96.00 active on encounter",
          "fhirReference": "Condition/condition-arf-001",
          "source": "STRUCTURED"
        },
        {
          "criterionId": "low-o2-sat",
          "criterionName": "O2 Saturation < 90% Within 6 Hours",
          "result": "MET",
          "value": "87%",
          "evidence": "SpO2 87% recorded at 08:15",
          "fhirReference": "Observation/observation-spo2-001",
          "source": "STRUCTURED"
        }
      ]
    },
    "inputTokensTotal": 8432,
    "outputTokensTotal": 2156,
    "startedAt": "2026-02-20T09:00:00.000Z",
    "completedAt": "2026-02-20T09:01:45.000Z"
  },
  "createdAt": "2026-02-20T08:00:00.000Z",
  "updatedAt": "2026-02-20T09:01:45.000Z"
}
```

---

## Agent Runs

### Trigger an agent run

```bash
curl -s -X POST http://localhost:3000/api/reviews/ARF-2026-001/agent-run | jq
```

```json
{
  "runId": "run-abc-123",
  "status": "pending"
}
```

### Get agent run status

```bash
curl -s http://localhost:3000/api/agent-runs/run-abc-123 | jq
```

```json
{
  "id": "run-abc-123",
  "caseNumber": "ARF-2026-001",
  "status": "completed",
  "modelId": "us.anthropic.claude-sonnet-4-6",
  "totalTurns": 12,
  "determination": {
    "decision": "AUTO_APPROVE",
    "confidence": 0.95,
    "rationale": "Patient John Doe (68M) presents with acute respiratory failure (J96.00). SpO2 87% recorded at 08:15 (within 6h lookback). Arterial pO2 55 mmHg confirms hypoxia. All inpatient admission criteria met per policy INTERNAL-ARF-001.",
    "criteriaResults": [
      {
        "criterionId": "has-resp-failure-dx",
        "criterionName": "Has Acute Respiratory Failure Diagnosis",
        "result": "MET"
      },
      {
        "criterionId": "low-o2-sat",
        "criterionName": "O2 Saturation < 90% Within 6 Hours",
        "result": "MET",
        "value": "87%"
      }
    ],
    "policyBasis": [
      {
        "policyId": "pol-001",
        "title": "Acute Respiratory Failure - Inpatient Admission Criteria",
        "version": "1.0"
      }
    ],
    "missingData": []
  },
  "inputTokensTotal": 8432,
  "outputTokensTotal": 2156,
  "startedAt": "2026-02-20T09:00:00.000Z",
  "completedAt": "2026-02-20T09:01:45.000Z"
}
```

### Get agent run trace (turn-by-turn)

```bash
curl -s http://localhost:3000/api/agent-runs/run-abc-123/trace | jq
```

```json
{
  "turns": [
    {
      "turn": {
        "id": "turn-001",
        "runId": "run-abc-123",
        "turnNumber": 1,
        "role": "assistant",
        "content": "I'll review case ARF-2026-001...",
        "stopReason": "tool_use",
        "inputTokens": 1200,
        "outputTokens": 350,
        "latencyMs": 1800,
        "createdAt": "2026-02-20T09:00:01.000Z"
      },
      "toolCalls": [
        {
          "id": "tc-001",
          "runId": "run-abc-123",
          "turnNumber": 1,
          "toolName": "um_get_case",
          "input": { "caseNumber": "ARF-2026-001" },
          "output": { "caseNumber": "ARF-2026-001", "patient": { "firstName": "John", "lastName": "Doe" } },
          "latencyMs": 45,
          "createdAt": "2026-02-20T09:00:02.000Z"
        }
      ]
    }
  ]
}
```

### Cancel a running agent

```bash
curl -s -X DELETE http://localhost:3000/api/agent-runs/run-abc-123 | jq
```

```json
{
  "status": "cancelled"
}
```

---

## Determinations

### Record a reviewer determination

Approve (matching AI recommendation):

```bash
curl -s -X POST http://localhost:3000/api/reviews/ARF-2026-001/determination \
  -H 'Content-Type: application/json' \
  -d '{
    "decision": "AUTO_APPROVE",
    "reviewerNotes": "Criteria met, approved per policy."
  }' | jq
```

Override (different from AI recommendation):

```bash
curl -s -X POST http://localhost:3000/api/reviews/ARF-2026-001/determination \
  -H 'Content-Type: application/json' \
  -d '{
    "decision": "MD_REVIEW",
    "overrideReason": "SpO2 reading may be unreliable due to poor perfusion, requesting MD evaluation.",
    "reviewerNotes": "Patient has peripheral vascular disease."
  }' | jq
```

```json
{
  "caseNumber": "ARF-2026-001",
  "status": "decided",
  "determination": "AUTO_APPROVE",
  "decidedAt": "2026-02-20T09:05:00.000Z"
}
```

---

## Policies

### List policies

```bash
curl -s http://localhost:3000/api/policies | jq
```

```json
[
  {
    "id": "pol-001",
    "policyType": "INTERNAL",
    "cmsId": "INTERNAL-ARF-001",
    "title": "Acute Respiratory Failure - Inpatient Admission Criteria",
    "status": "ACTIVE",
    "effectiveDate": null
  }
]
```

---

## Dashboard Metrics

```bash
curl -s http://localhost:3000/api/dashboard/metrics | jq
```

```json
{
  "totalReviews": 42,
  "pendingReviews": 5,
  "autoApproveRate": 0.68,
  "avgTurnsPerRun": 11.3,
  "avgRunTimeMs": 95000,
  "determinationBreakdown": {
    "AUTO_APPROVE": 28,
    "MD_REVIEW": 10,
    "MORE_INFO": 3,
    "DENY": 1
  }
}
```
