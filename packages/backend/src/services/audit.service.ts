/**
 * Audit Log Service
 *
 * Writes structured audit events to the audit_log table.
 * All clinical decisions and agent actions should be logged here
 * to support compliance, explainability, and FHIR AuditEvent export.
 *
 * audit_log columns: id, case_number, event_type, actor_type, actor_id, detail_json, created_at
 */
import { randomUUID } from 'crypto';
import { db } from '../db/connection.js';

export type ActorType = 'SYSTEM' | 'USER' | 'LLM' | 'CQL_ENGINE' | 'NLP';

export interface AuditEventInput {
  caseNumber?: string;
  eventType: string;
  actorType: ActorType;
  actorId?: string;
  detail: Record<string, unknown>;
}

export async function logAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    await db('audit_log').insert({
      id: randomUUID(),
      case_number: event.caseNumber ?? null,
      event_type: event.eventType,
      actor_type: event.actorType,
      actor_id: event.actorId ?? null,
      detail_json: JSON.stringify(event.detail),
      created_at: new Date(),
    });
  } catch {
    // Audit logging is best-effort — never throw to caller
  }
}

// Convenience wrappers for common events

export async function logDetermination(
  caseNumber: string,
  determination: string,
  reviewerId: string,
  runId?: string,
): Promise<void> {
  return logAuditEvent({
    caseNumber,
    eventType: 'DETERMINATION_RECORDED',
    actorType: 'USER',
    actorId: reviewerId,
    detail: { determination, runId },
  });
}

export async function logAgentRunStarted(caseNumber: string, runId: string): Promise<void> {
  return logAuditEvent({
    caseNumber,
    eventType: 'AGENT_RUN_STARTED',
    actorType: 'SYSTEM',
    actorId: 'lucidreview-agent',
    detail: { runId },
  });
}

export async function logAgentRunCompleted(
  caseNumber: string,
  runId: string,
  determination: unknown,
): Promise<void> {
  return logAuditEvent({
    caseNumber,
    eventType: 'AGENT_RUN_COMPLETED',
    actorType: 'LLM',
    actorId: 'lucidreview-agent',
    detail: { runId, determination },
  });
}

export async function logPasSubmission(caseNumber: string, claimId: string): Promise<void> {
  return logAuditEvent({
    caseNumber,
    eventType: 'PAS_SUBMISSION',
    actorType: 'SYSTEM',
    detail: { claimId },
  });
}

/**
 * Query audit events for a case (for UI display / FHIR AuditEvent export).
 */
export async function getAuditTrail(caseNumber: string): Promise<Array<Record<string, unknown>>> {
  return db('audit_log')
    .where({ case_number: caseNumber })
    .orderBy('created_at', 'asc')
    .select('*');
}
