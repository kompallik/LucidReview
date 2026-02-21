import { randomUUID } from 'crypto';
import { db } from '../db/connection.js';

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
    return existing;
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

  return created;
}

/**
 * List reviews with optional filters.
 */
export async function listReviews(filters?: ListReviewsFilters): Promise<ReviewRow[]> {
  let query = db('reviews').select('*');

  if (filters?.status) {
    query = query.where({ status: filters.status });
  }

  return query.orderBy('created_at', 'desc');
}

/**
 * Look up a single review by case number.
 */
export async function getReview(caseNumber: string): Promise<ReviewRow | undefined> {
  return db('reviews')
    .where({ case_number: caseNumber })
    .first();
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

  const updated = await db('reviews')
    .where({ case_number: caseNumber })
    .first();

  return updated;
}
