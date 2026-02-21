import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for review.service.ts.
 *
 * Expected service interface:
 *   getOrCreateReview(caseNumber, data?): Promise<ReviewRow>
 *   listReviews(filters?): Promise<ReviewRow[]>
 *   recordDetermination(caseNumber, determination, reviewerId, notes?): Promise<ReviewRow>
 */

// Mock the db module
vi.mock('../../db/connection.js', () => {
  const mockKnex = vi.fn();
  return { db: mockKnex };
});

import { db } from '../../db/connection.js';
import {
  getOrCreateReview,
  listReviews,
  recordDetermination,
} from '../../services/review.service.js';

const mockDb = db as unknown as ReturnType<typeof vi.fn>;

describe('review.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreateReview', () => {
    it('returns existing row when case already exists', async () => {
      const existingRow = {
        id: 'rev-001',
        case_number: 'ARF-2026-001',
        status: 'pending',
        determination: null,
        urgency: 'STANDARD',
        created_at: new Date(),
      };

      const mockFirst = vi.fn().mockResolvedValue(existingRow);
      const mockWhere = vi.fn().mockReturnValue({ first: mockFirst });
      mockDb.mockReturnValue({ where: mockWhere });

      const result = await getOrCreateReview('ARF-2026-001');

      expect(mockDb).toHaveBeenCalledWith('reviews');
      expect(mockWhere).toHaveBeenCalledWith(
        expect.objectContaining({ case_number: 'ARF-2026-001' })
      );
      expect(result).toEqual(existingRow);
    });

    it('creates a new row when case does not exist', async () => {
      // First call: SELECT returns nothing
      const mockFirst = vi.fn().mockResolvedValue(undefined);
      const mockSelectWhere = vi.fn().mockReturnValue({ first: mockFirst });

      // Second call: INSERT
      const mockInsert = vi.fn().mockResolvedValue([1]);

      // Third call: SELECT the newly inserted row
      const newRow = {
        id: 'rev-new',
        case_number: 'ARF-2026-002',
        status: 'pending',
        determination: null,
        urgency: 'STANDARD',
        created_at: new Date(),
      };
      const mockNewFirst = vi.fn().mockResolvedValue(newRow);
      const mockNewWhere = vi.fn().mockReturnValue({ first: mockNewFirst });

      let callCount = 0;
      mockDb.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { where: mockSelectWhere };
        if (callCount === 2) return { insert: mockInsert };
        return { where: mockNewWhere };
      });

      const result = await getOrCreateReview('ARF-2026-002');

      expect(result).toHaveProperty('case_number', 'ARF-2026-002');
      expect(result).toHaveProperty('status', 'pending');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          case_number: 'ARF-2026-002',
          status: 'pending',
        })
      );
    });
  });

  describe('listReviews', () => {
    it('returns all reviews without filters', async () => {
      const rows = [
        { id: 'r1', case_number: 'ARF-2026-001', status: 'pending' },
        { id: 'r2', case_number: 'ARF-2026-002', status: 'decided' },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(rows);
      const mockSelect = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      mockDb.mockReturnValue({ select: mockSelect });

      const result = await listReviews();

      expect(result).toEqual(rows);
      expect(mockDb).toHaveBeenCalledWith('reviews');
    });

    it('applies status filter correctly', async () => {
      const filteredRows = [
        { id: 'r1', case_number: 'ARF-2026-001', status: 'pending' },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(filteredRows);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockSelect = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.mockReturnValue({ select: mockSelect });

      const result = await listReviews({ status: 'pending' });

      expect(result).toEqual(filteredRows);
      expect(mockWhere).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' })
      );
    });
  });

  describe('recordDetermination', () => {
    it('updates status to "decided" and sets determination/reviewer_id/decided_at', async () => {
      const updatedRow = {
        id: 'rev-001',
        case_number: 'ARF-2026-001',
        status: 'decided',
        determination: 'AUTO_APPROVE',
        reviewer_id: 'user-nurse-01',
        decided_at: new Date(),
      };

      const mockUpdate = vi.fn().mockResolvedValue(1);
      const mockUpdateWhere = vi.fn().mockReturnValue({ update: mockUpdate });

      const mockFirst = vi.fn().mockResolvedValue(updatedRow);
      const mockSelectWhere = vi.fn().mockReturnValue({ first: mockFirst });

      let callCount = 0;
      mockDb.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { where: mockUpdateWhere };
        return { where: mockSelectWhere };
      });

      const result = await recordDetermination(
        'ARF-2026-001',
        'AUTO_APPROVE',
        'user-nurse-01'
      );

      expect(result).toHaveProperty('status', 'decided');
      expect(result).toHaveProperty('determination', 'AUTO_APPROVE');
      expect(result).toHaveProperty('reviewer_id', 'user-nurse-01');
      expect(result).toHaveProperty('decided_at');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'decided',
          determination: 'AUTO_APPROVE',
          reviewer_id: 'user-nurse-01',
        })
      );
    });

    it('includes reviewer notes when provided', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(1);
      const mockUpdateWhere = vi.fn().mockReturnValue({ update: mockUpdate });

      const updatedRow = {
        id: 'rev-001',
        case_number: 'ARF-2026-001',
        status: 'decided',
        determination: 'MD_REVIEW',
        reviewer_id: 'user-nurse-01',
        reviewer_notes: 'Needs MD sign-off on SpO2 reading',
        decided_at: new Date(),
      };
      const mockFirst = vi.fn().mockResolvedValue(updatedRow);
      const mockSelectWhere = vi.fn().mockReturnValue({ first: mockFirst });

      let callCount = 0;
      mockDb.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { where: mockUpdateWhere };
        return { where: mockSelectWhere };
      });

      const result = await recordDetermination(
        'ARF-2026-001',
        'MD_REVIEW',
        'user-nurse-01',
        'Needs MD sign-off on SpO2 reading'
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewer_notes: 'Needs MD sign-off on SpO2 reading',
        })
      );
      expect(result).toHaveProperty('reviewer_notes', 'Needs MD sign-off on SpO2 reading');
    });
  });
});
