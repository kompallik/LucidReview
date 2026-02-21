import { randomUUID } from 'crypto';
import { db } from '../db/connection.js';

/** Convert a snake_case DB row to the camelCase shape the frontend expects. */
function serialize(row: ReviewRow): Record<string, unknown> {
  return {
    id: row.id,
    caseNumber: row.case_number,
    status: row.status,
    determination: row.determination ?? null,
    urgency: row.urgency,
    serviceType: row.service_type ?? null,
    primaryDiagnosisCode: (row as Record<string, unknown>).primary_diagnosis_code ?? null,
    primaryDiagnosisDisplay: (row as Record<string, unknown>).primary_diagnosis_display ?? null,
    patientFhirId: (row as Record<string, unknown>).patient_fhir_id ?? null,
    reviewerId: row.reviewer_id ?? null,
    overrideReason: row.override_reason ?? null,
    reviewerNotes: row.reviewer_notes ?? null,
    latestRunId: (row as Record<string, unknown>).latest_run_id ?? null,
    decidedAt: row.decided_at instanceof Date ? row.decided_at.toISOString() : (row.decided_at ?? null),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at ?? null),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at ?? null),
  };
}

export interface ReviewRow {
  id: string;
  case_number: string;
  status: string;
  determination: string | null;
  urgency: string;
  service_type: string | null;
  reviewer_id: string | null;
  override_reason: string | null;
  reviewer_notes: string | null;
  decided_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ListReviewsFilters {
  status?: string;
  limit?: number;
  offset?: number;
}

/**
 * Find an existing review for a case, or create a new one.
 */
export async function getOrCreateReview(caseNumber: string): Promise<ReviewRow> {
  const existing = await db('reviews')
    .where({ case_number: caseNumber })
    .first();

  if (existing) {
    return serialize(existing) as unknown as ReviewRow;
  }

  const id = randomUUID();
  await db('reviews').insert({
    id,
    case_number: caseNumber,
    status: 'pending',
    urgency: 'STANDARD',
  });

  const created = await db('reviews')
    .where({ case_number: caseNumber })
    .first();

  return serialize(created) as unknown as ReviewRow;
}

/**
 * List reviews with optional filters.
 */
export async function listReviews(filters?: ListReviewsFilters): Promise<ReviewRow[]> {
  let query = db('reviews').select('*');

  if (filters?.status) {
    query = query.where({ status: filters.status });
  }

  const rows = await query.orderBy('created_at', 'desc');
  return rows.map(serialize) as unknown as ReviewRow[];
}

/**
 * Look up a single review by case number.
 */
export async function getReview(caseNumber: string): Promise<ReviewRow | undefined> {
  const row = await db('reviews').where({ case_number: caseNumber }).first();
  return row ? (serialize(row) as unknown as ReviewRow) : undefined;
}

/**
 * Record a human reviewer's determination on a case.
 */
export async function recordDetermination(
  caseNumber: string,
  determination: string,
  reviewerId: string,
  notes?: string,
  overrideReason?: string
): Promise<ReviewRow> {
  await db('reviews')
    .where({ case_number: caseNumber })
    .update({
      status: 'decided',
      determination,
      reviewer_id: reviewerId,
      reviewer_notes: notes ?? null,
      override_reason: overrideReason ?? null,
      decided_at: new Date(),
      updated_at: new Date(),
    });

  const updated = await db('reviews').where({ case_number: caseNumber }).first();
  return serialize(updated) as unknown as ReviewRow;
}
