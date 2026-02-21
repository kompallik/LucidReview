import { describe, it, expect } from 'vitest';
import { MockUmAdapter } from './mock-um-adapter.js';

describe('MockUmAdapter', () => {
  const adapter = new MockUmAdapter();

  describe('getCase', () => {
    it('returns case data for ARF-2026-001 with correct patient name', async () => {
      const caseData = await adapter.getCase('ARF-2026-001');
      expect(caseData.patient.firstName).toBe('John');
      expect(caseData.patient.lastName).toBe('Doe');
    });

    it('returns correct case metadata', async () => {
      const caseData = await adapter.getCase('ARF-2026-001');
      expect(caseData.caseNumber).toBe('ARF-2026-001');
      expect(caseData.urgency).toBe('URGENT');
      expect(caseData.serviceType).toBe('Inpatient Admission');
      expect(caseData.memberId).toBe('MBR-123456');
    });

    it('returns correct patient demographics', async () => {
      const caseData = await adapter.getCase('ARF-2026-001');
      expect(caseData.patient.dateOfBirth).toBe('1958-03-15');
      expect(caseData.patient.gender).toBe('male');
      expect(caseData.patient.mrn).toBe('MRN-789012');
    });

    it('returns facility information', async () => {
      const caseData = await adapter.getCase('ARF-2026-001');
      expect(caseData.facility.name).toBe('City General Hospital');
    });

    it('throws for unknown case number', async () => {
      await expect(adapter.getCase('UNKNOWN-001')).rejects.toThrow(
        'Mock: case UNKNOWN-001 not found',
      );
    });
  });

  describe('getClinicalInfo', () => {
    it('returns primary diagnosis J96.00 (acute respiratory failure)', async () => {
      const clinical = await adapter.getClinicalInfo('ARF-2026-001');
      const primary = clinical.diagnoses.find((d) => d.type === 'PRIMARY');
      expect(primary).toBeDefined();
      expect(primary!.code).toBe('J96.00');
      expect(primary!.codeSystem).toBe('ICD-10-CM');
    });

    it('returns secondary diagnosis J44.1 (COPD exacerbation)', async () => {
      const clinical = await adapter.getClinicalInfo('ARF-2026-001');
      const secondary = clinical.diagnoses.find((d) => d.type === 'SECONDARY');
      expect(secondary).toBeDefined();
      expect(secondary!.code).toBe('J44.1');
    });

    it('returns SpO2 vital with value less than 90%', async () => {
      const clinical = await adapter.getClinicalInfo('ARF-2026-001');
      const spo2 = clinical.vitals?.find((v) => v.type === 'SpO2');
      expect(spo2).toBeDefined();
      expect(spo2!.value).toBeLessThan(90);
      expect(spo2!.unit).toBe('%');
    });

    it('returns elevated respiratory rate', async () => {
      const clinical = await adapter.getClinicalInfo('ARF-2026-001');
      const rr = clinical.vitals?.find((v) => v.type === 'Respiratory Rate');
      expect(rr).toBeDefined();
      expect(rr!.value).toBeGreaterThan(20);
    });

    it('returns low pO2 lab value', async () => {
      const clinical = await adapter.getClinicalInfo('ARF-2026-001');
      const po2 = clinical.labs?.find((l) => l.name === 'pO2');
      expect(po2).toBeDefined();
      expect(po2!.value).toBe(55);
      expect(po2!.loincCode).toBe('2703-7');
    });
  });

  describe('getAttachments', () => {
    it('returns two PDF attachments', async () => {
      const attachments = await adapter.getAttachments('ARF-2026-001');
      expect(attachments).toHaveLength(2);
      expect(attachments[0].mimeType).toBe('application/pdf');
      expect(attachments[1].mimeType).toBe('application/pdf');
    });

    it('includes clinical note and lab result categories', async () => {
      const attachments = await adapter.getAttachments('ARF-2026-001');
      const categories = attachments.map((a) => a.category);
      expect(categories).toContain('CLINICAL_NOTE');
      expect(categories).toContain('LAB_RESULT');
    });
  });

  describe('downloadAttachment', () => {
    it('returns base64 content for ATT-001', async () => {
      const result = await adapter.downloadAttachment('ARF-2026-001', 'ATT-001');
      expect(result.base64Content).toBeTruthy();
      expect(result.fileName).toBe('ED_Physician_Note.pdf');
      // Verify content decodes to readable text
      const text = Buffer.from(result.base64Content, 'base64').toString('utf-8');
      expect(text).toContain('John Doe');
      expect(text).toContain('acute respiratory failure');
    });

    it('throws for unknown attachment ID', async () => {
      await expect(
        adapter.downloadAttachment('ARF-2026-001', 'ATT-999'),
      ).rejects.toThrow('Mock: attachment ATT-999 not found');
    });
  });

  describe('getMemberCoverage', () => {
    it('returns active Medicare Part A coverage', async () => {
      const coverage = await adapter.getMemberCoverage('MBR-123456');
      expect(coverage.planName).toBe('Medicare Part A');
      expect(coverage.coverageActive).toBe(true);
    });

    it('covers inpatient admission with auth required', async () => {
      const coverage = await adapter.getMemberCoverage('MBR-123456');
      const inpatient = coverage.benefits.find(
        (b) => b.benefitType === 'Inpatient Admission',
      );
      expect(inpatient).toBeDefined();
      expect(inpatient!.covered).toBe(true);
      expect(inpatient!.requiresAuth).toBe(true);
    });

    it('throws for unknown member ID', async () => {
      await expect(adapter.getMemberCoverage('UNKNOWN')).rejects.toThrow(
        'Mock: member UNKNOWN not found',
      );
    });
  });

  describe('getCaseHistory', () => {
    it('returns history entries', async () => {
      const history = await adapter.getCaseHistory('ARF-2026-001');
      expect(history.length).toBeGreaterThanOrEqual(2);
      const actions = history.map((h) => h.action);
      expect(actions).toContain('CASE_CREATED');
    });
  });

  describe('getCaseNotes', () => {
    it('returns clinical and administrative notes', async () => {
      const notes = await adapter.getCaseNotes('ARF-2026-001');
      expect(notes.length).toBeGreaterThanOrEqual(2);
      const types = notes.map((n) => n.noteType);
      expect(types).toContain('CLINICAL');
      expect(types).toContain('ADMINISTRATIVE');
    });
  });
});
