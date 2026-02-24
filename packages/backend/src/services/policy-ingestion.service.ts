/**
 * CMS Coverage Policy Ingestion Service.
 *
 * Uses the new CMS Coverage API (api.coverage.cms.gov/v1, June 2025).
 * - NCD list + detail: free, no auth
 * - LCD detail + HCPCS: requires Bearer token (auto-obtained, 1-hr expiry)
 * - Article ICD-10: requires Bearer token
 */
import { randomUUID } from 'crypto';
import { db } from '../db/connection.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PolicyIngestionResult {
  id: string;
  cmsId: string;
  title: string;
  action: 'created' | 'updated';
}

export interface SyncResult {
  ingested: number;
  updated: number;
  errors: Array<{ id: string; error: string }>;
}

export interface SyncStatusResult {
  retired: number;
  activated: number;
  unchanged: number;
  errors: Array<{ id: string; error: string }>;
}

export interface EnrichResult {
  policyId: string;
  icd10CoveredCount: number;
  icd10NoncoveredCount: number;
  hcpcsCount: number;
}

export interface EnrichBatchResult {
  queued: number;
  skipped: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CMS_API_BASE = 'https://api.coverage.cms.gov/v1';

// ─── Token Management ─────────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getCmsToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  const resp = await fetch(`${CMS_API_BASE}/metadata/license-agreement/`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    throw new Error(`Failed to obtain CMS token: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json() as { data: Array<{ Token: string }> };
  const token = data?.data?.[0]?.Token;
  if (!token) {
    throw new Error('CMS token response missing Token field');
  }

  cachedToken = { token, expiresAt: now + 55 * 60 * 1000 }; // cache 55 min
  return token;
}

function invalidateToken(): void {
  cachedToken = null;
}

// ─── Pagination Helper ────────────────────────────────────────────────────────

interface CmsEnvelope<T> {
  meta?: { next_token?: string | null };
  data: T[];
}

async function fetchAllPages<T>(
  buildUrl: (nextToken: string | null) => string,
  headers: Record<string, string>,
): Promise<T[]> {
  const results: T[] = [];
  let nextToken: string | null = null;

  do {
    const url = buildUrl(nextToken);
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!resp.ok) {
      throw new Error(`CMS API error ${resp.status} for ${url}`);
    }
    const envelope = await resp.json() as CmsEnvelope<T>;
    results.push(...(envelope.data ?? []));
    nextToken = envelope.meta?.next_token ?? null;
  } while (nextToken);

  return results;
}

// ─── NCD Fetch Functions ──────────────────────────────────────────────────────

interface CmsNcdListItem {
  document_id: number;
  id: string;          // display ID like "20.4"
  title: string;
  status: string;
  effective_date: string;
  retirement_date?: string;
  last_updated_sort: string; // yyyymmdd
}

interface CmsNcdDetail {
  document_id: number;
  ncd_number: string;
  title: string;
  status: string;
  effective_date: string;
  retirement_date?: string;
  indications_and_limitations?: string;
  [key: string]: unknown;
}

async function fetchNcdList(): Promise<CmsNcdListItem[]> {
  return fetchAllPages<CmsNcdListItem>(
    (next) => {
      const url = new URL(`${CMS_API_BASE}/reports/national-coverage-ncd/`);
      if (next) url.searchParams.set('next_token', next);
      return url.toString();
    },
    { Accept: 'application/json' },
  );
}

async function fetchNcdDetail(docId: number, ver?: string): Promise<CmsNcdDetail | null> {
  const url = new URL(`${CMS_API_BASE}/data/ncd/`);
  url.searchParams.set('ncdid', String(docId));
  if (ver) url.searchParams.set('ncdver', ver);

  const resp = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) return null;
  const envelope = await resp.json() as CmsEnvelope<CmsNcdDetail>;
  return envelope.data?.[0] ?? null;
}

// ─── LCD Fetch Functions ──────────────────────────────────────────────────────

interface CmsLcdListItem {
  lcd_id: number;
  lcd_version: number;
  name: string;
  contractor: string;
  status: string;
  effective_date: string;
  retirement_date?: string;
  last_updated_sort: string;
}

interface CmsLcdDetail {
  lcd_id: number;
  lcd_version: number;
  lcd_name: string;
  status: string;
  effective_date: string;
  retirement_date?: string;
  indications_and_limitations?: string;
  [key: string]: unknown;
}

interface CmsHcpcCode {
  hcpc_code: string;
  short_description: string;
  modifier?: string;
}

interface CmsRelatedDocument {
  document_type: string;
  document_id: number;
  document_version: number;
  document_name: string;
}

interface CmsIcd10Code {
  icd10_cd: string;
  long_description: string;
}

async function fetchLcdList(): Promise<CmsLcdListItem[]> {
  const token = await getCmsToken();
  return fetchAllPages<CmsLcdListItem>(
    (next) => {
      const url = new URL(`${CMS_API_BASE}/reports/local-coverage-final-lcds`);
      if (next) url.searchParams.set('next_token', next);
      return url.toString();
    },
    { Accept: 'application/json', Authorization: `Bearer ${token}` },
  );
}

async function fetchLcdDetail(lcdId: number, ver: number): Promise<CmsLcdDetail | null> {
  const token = await getCmsToken();
  const url = new URL(`${CMS_API_BASE}/data/lcd/`);
  url.searchParams.set('lcdid', String(lcdId));
  url.searchParams.set('lcdver', String(ver));

  const resp = await fetch(url.toString(), {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) return null;
  const envelope = await resp.json() as CmsEnvelope<CmsLcdDetail>;
  return envelope.data?.[0] ?? null;
}

async function fetchLcdHcpcsCodes(lcdId: number, ver: number): Promise<CmsHcpcCode[]> {
  const token = await getCmsToken();
  return fetchAllPages<CmsHcpcCode>(
    (next) => {
      const url = new URL(`${CMS_API_BASE}/data/lcd/hcpc-code`);
      url.searchParams.set('lcdid', String(lcdId));
      url.searchParams.set('ver', String(ver));
      if (next) url.searchParams.set('next_token', next);
      return url.toString();
    },
    { Accept: 'application/json', Authorization: `Bearer ${token}` },
  );
}

async function fetchLcdRelatedDocuments(lcdId: number, ver: number): Promise<CmsRelatedDocument[]> {
  const token = await getCmsToken();
  return fetchAllPages<CmsRelatedDocument>(
    (next) => {
      const url = new URL(`${CMS_API_BASE}/data/lcd/related-documents`);
      url.searchParams.set('lcdid', String(lcdId));
      url.searchParams.set('ver', String(ver));
      if (next) url.searchParams.set('next_token', next);
      return url.toString();
    },
    { Accept: 'application/json', Authorization: `Bearer ${token}` },
  );
}

async function fetchArticleIcd10Covered(articleId: number, ver: number): Promise<CmsIcd10Code[]> {
  const token = await getCmsToken();
  return fetchAllPages<CmsIcd10Code>(
    (next) => {
      const url = new URL(`${CMS_API_BASE}/data/article/icd10-covered`);
      url.searchParams.set('articleid', String(articleId));
      url.searchParams.set('ver', String(ver));
      if (next) url.searchParams.set('next_token', next);
      return url.toString();
    },
    { Accept: 'application/json', Authorization: `Bearer ${token}` },
  );
}

async function fetchArticleIcd10NonCovered(articleId: number, ver: number): Promise<CmsIcd10Code[]> {
  const token = await getCmsToken();
  return fetchAllPages<CmsIcd10Code>(
    (next) => {
      const url = new URL(`${CMS_API_BASE}/data/article/icd10-noncovered`);
      url.searchParams.set('articleid', String(articleId));
      url.searchParams.set('ver', String(ver));
      if (next) url.searchParams.set('next_token', next);
      return url.toString();
    },
    { Accept: 'application/json', Authorization: `Bearer ${token}` },
  );
}

// ─── Legacy Stub Fetch (backward compat) ─────────────────────────────────────

async function fetchCmsNcd(ncdId: string): Promise<Record<string, unknown>> {
  // Try to get from NCD list first
  try {
    const list = await fetchNcdList();
    const item = list.find((n) => n.id === ncdId);
    if (item) {
      const detail = await fetchNcdDetail(item.document_id);
      if (detail) {
        return {
          id: ncdId,
          title: detail.title,
          type: 'ncd',
          status: detail.status?.toLowerCase() === 'retired' ? 'retired' : 'active',
          effectiveDate: detail.effective_date,
          retirementDate: detail.retirement_date ?? null,
          summary: detail.indications_and_limitations ?? null,
        };
      }
    }
  } catch {
    // fall through to stub
  }
  return {
    id: ncdId,
    title: `NCD ${ncdId} (pending CMS sync)`,
    type: 'ncd',
    status: 'active',
  };
}

async function fetchCmsLcd(lcdId: string): Promise<Record<string, unknown>> {
  return {
    id: lcdId,
    title: `LCD ${lcdId} (pending CMS sync)`,
    type: 'lcd',
    status: 'active',
  };
}

// ─── Sections Parser (NCD only) ───────────────────────────────────────────────

function parseSectionsJson(item: Record<string, unknown>): Record<string, unknown> {
  const raw = typeof item['summary'] === 'string' ? item['summary'] : JSON.stringify(item);
  const icd10Pattern = /\b[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?\b/g;
  const diagnosisCodes = [...new Set(raw.match(icd10Pattern) ?? [])];
  return {
    summary: item['summary'] ?? null,
    indications: (item as Record<string, string>)['indications'] ?? null,
    nonCoveredIndications: (item as Record<string, string>)['nonCoveredIndications'] ?? null,
    codingGuidance: (item as Record<string, string>)['codingGuidance'] ?? null,
    diagnosisCodes,
  };
}

// ─── Upsert Helper ────────────────────────────────────────────────────────────

async function upsertPolicy(
  cmsId: string,
  policyType: 'NCD' | 'LCD',
  item: Record<string, unknown>,
): Promise<PolicyIngestionResult> {
  const existing = await db('policies').where({ cms_id: cmsId }).first();
  const sectionsJson = parseSectionsJson(item);

  const policyData: Record<string, unknown> = {
    cms_id: cmsId,
    policy_type: policyType,
    title: item['title'] ?? `${policyType} ${cmsId}`,
    status: item['status'] === 'retired' ? 'RETIRED' : 'ACTIVE',
    effective_date: item['effectiveDate'] ?? null,
    retirement_date: item['retirementDate'] ?? null,
    source_url: item['sourceUrl'] ?? `https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?NCDId=${cmsId}`,
    sections_json: JSON.stringify(sectionsJson),
    updated_at: new Date(),
  };

  if (existing) {
    await db('policies').where({ id: existing.id }).update(policyData);
    return { id: existing.id as string, cmsId, title: policyData['title'] as string, action: 'updated' };
  }

  const id = randomUUID();
  await db('policies').insert({ id, ...policyData, created_at: new Date() });
  return { id, cmsId, title: policyData['title'] as string, action: 'created' };
}

// ─── Legacy Public API (backward compat) ─────────────────────────────────────

export async function ingestNcdFromCms(ncdId: string): Promise<PolicyIngestionResult> {
  const item = await fetchCmsNcd(ncdId);
  return upsertPolicy(ncdId, 'NCD', item);
}

export async function ingestLcdFromCms(lcdId: string): Promise<PolicyIngestionResult> {
  const item = await fetchCmsLcd(lcdId);
  return upsertPolicy(lcdId, 'LCD', item);
}

export async function syncActivePolicies(): Promise<SyncResult> {
  // Delegate to new sync
  const result = await syncPolicyStatus();
  return {
    ingested: result.activated,
    updated: result.retired,
    errors: result.errors,
  };
}

// ─── New Sync Functions ───────────────────────────────────────────────────────

/**
 * Sync policy status changes (retirements, new policies) — fast, ~5 min.
 * Compares CMS list retirement_date + status vs DB.
 */
export async function syncPolicyStatus(): Promise<SyncStatusResult> {
  let retired = 0;
  let activated = 0;
  let unchanged = 0;
  const errors: Array<{ id: string; error: string }> = [];

  try {
    // Sync NCDs
    const ncdList = await fetchNcdList();
    for (const ncd of ncdList) {
      try {
        const existing = await db('policies')
          .where({ cms_id: ncd.id, policy_type: 'NCD' })
          .first();

        const cmsStatus = ncd.status?.toLowerCase() === 'retired' ? 'RETIRED' : 'ACTIVE';

        if (!existing) {
          // New NCD — insert stub
          await db('policies').insert({
            id: randomUUID(),
            policy_type: 'NCD',
            cms_id: ncd.id,
            cms_document_id: ncd.document_id,
            title: ncd.title,
            status: cmsStatus,
            effective_date: ncd.effective_date ?? null,
            retirement_date: ncd.retirement_date ?? null,
            source_url: `https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?NCDId=${ncd.document_id}`,
            sections_json: JSON.stringify({ diagnosisCodes: [] }),
            created_at: new Date(),
            updated_at: new Date(),
          });
          activated++;
        } else if (existing.status !== cmsStatus || existing.cms_document_id !== ncd.document_id) {
          await db('policies').where({ id: existing.id }).update({
            status: cmsStatus,
            cms_document_id: ncd.document_id,
            retirement_date: ncd.retirement_date ?? null,
            updated_at: new Date(),
          });
          if (cmsStatus === 'RETIRED') retired++;
          else activated++;
        } else {
          unchanged++;
        }
      } catch (err) {
        errors.push({ id: ncd.id, error: String(err) });
      }
    }
  } catch (err) {
    errors.push({ id: 'ncd-list', error: String(err) });
  }

  try {
    // Sync LCDs
    const lcdList = await fetchLcdList();
    for (const lcd of lcdList) {
      try {
        const lcdCmsId = `L${lcd.lcd_id}`;
        const existing = await db('policies')
          .where({ cms_id: lcdCmsId, policy_type: 'LCD' })
          .first();

        const cmsStatus = lcd.status?.toLowerCase() === 'retired' ? 'RETIRED' : 'ACTIVE';

        if (!existing) {
          await db('policies').insert({
            id: randomUUID(),
            policy_type: 'LCD',
            cms_id: lcdCmsId,
            cms_document_id: lcd.lcd_id,
            title: lcd.name,
            status: cmsStatus,
            effective_date: lcd.effective_date ?? null,
            retirement_date: lcd.retirement_date ?? null,
            source_url: `https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?LCDId=${lcd.lcd_id}`,
            sections_json: JSON.stringify({ diagnosisCodes: [] }),
            created_at: new Date(),
            updated_at: new Date(),
          });
          activated++;
        } else if (existing.status !== cmsStatus || existing.cms_document_id !== lcd.lcd_id) {
          await db('policies').where({ id: existing.id }).update({
            status: cmsStatus,
            cms_document_id: lcd.lcd_id,
            retirement_date: lcd.retirement_date ?? null,
            updated_at: new Date(),
          });
          if (cmsStatus === 'RETIRED') retired++;
          else activated++;
        } else {
          unchanged++;
        }
      } catch (err) {
        errors.push({ id: `L${lcd.lcd_id}`, error: String(err) });
      }
    }
  } catch (err) {
    errors.push({ id: 'lcd-list', error: String(err) });
  }

  return { retired, activated, unchanged, errors };
}

/**
 * Enrich a single policy with ICD-10 + HCPCS codes.
 */
export async function enrichPolicy(policyId: string): Promise<EnrichResult> {
  const policy = await db('policies').where({ id: policyId }).first();
  if (!policy) throw new Error(`Policy ${policyId} not found`);

  let icd10Covered: Array<{ code: string; description: string }> = [];
  let icd10Noncovered: Array<{ code: string; description: string }> = [];
  let hcpcsCodes: Array<{ code: string; description: string; modifier?: string }> = [];

  if (policy.policy_type === 'LCD' && policy.cms_document_id) {
    const lcdId = policy.cms_document_id as number;
    const lcdVer = 1; // default version; in practice would come from list

    // Fetch HCPCS codes
    try {
      await new Promise((r) => setTimeout(r, 100));
      const raw = await fetchLcdHcpcsCodes(lcdId, lcdVer);
      hcpcsCodes = raw.map((h) => ({
        code: h.hcpc_code,
        description: h.short_description,
        ...(h.modifier ? { modifier: h.modifier } : {}),
      }));
    } catch (err) {
      console.warn(`HCPCS fetch failed for LCD ${lcdId}:`, err);
    }

    // Fetch related documents to find Article IDs
    try {
      await new Promise((r) => setTimeout(r, 100));
      const relDocs = await fetchLcdRelatedDocuments(lcdId, lcdVer);
      const articleDocs = relDocs.filter((d) => d.document_type?.toLowerCase().includes('article'));

      for (const article of articleDocs) {
        try {
          await new Promise((r) => setTimeout(r, 100));
          const [covered, noncovered] = await Promise.all([
            fetchArticleIcd10Covered(article.document_id, article.document_version),
            fetchArticleIcd10NonCovered(article.document_id, article.document_version),
          ]);
          icd10Covered.push(...covered.map((c) => ({ code: c.icd10_cd, description: c.long_description })));
          icd10Noncovered.push(...noncovered.map((c) => ({ code: c.icd10_cd, description: c.long_description })));
        } catch (err) {
          console.warn(`Article ICD-10 fetch failed for article ${article.document_id}:`, err);
        }
      }
    } catch (err) {
      console.warn(`Related docs fetch failed for LCD ${lcdId}:`, err);
    }
  } else if (policy.policy_type === 'NCD') {
    // For NCDs: copy regex-extracted codes from sections_json into icd10_covered
    try {
      const sections = typeof policy.sections_json === 'string'
        ? JSON.parse(policy.sections_json)
        : (policy.sections_json ?? {});
      const codes: string[] = sections.diagnosisCodes ?? [];
      icd10Covered = codes.map((c) => ({ code: c, description: '' }));
    } catch {
      // ignore parse errors
    }
  }

  await db('policies').where({ id: policyId }).update({
    icd10_covered: JSON.stringify(icd10Covered),
    icd10_noncovered: JSON.stringify(icd10Noncovered),
    hcpcs_codes: JSON.stringify(hcpcsCodes),
    last_synced_at: new Date(),
    updated_at: new Date(),
  });

  return {
    policyId,
    icd10CoveredCount: icd10Covered.length,
    icd10NoncoveredCount: icd10Noncovered.length,
    hcpcsCount: hcpcsCodes.length,
  };
}

/**
 * Smart delta: enrich only policies where CMS last_updated > last_synced_at.
 */
export async function enrichChangedPolicies(): Promise<EnrichBatchResult> {
  let queued = 0;
  let skipped = 0;

  // Dynamically import to avoid circular deps
  const { getPolicySyncQueue } = await import('../queue/policy-sync-queue.js');
  const queue = getPolicySyncQueue();

  try {
    const ncdList = await fetchNcdList();
    for (const ncd of ncdList) {
      const existing = await db('policies')
        .where({ cms_id: ncd.id, policy_type: 'NCD' })
        .first();
      if (!existing) { skipped++; continue; }

      const cmsLastUpdated = ncd.last_updated_sort; // yyyymmdd string
      const dbLastSynced = existing.last_synced_at as Date | null;

      // Convert yyyymmdd to comparable date
      const cmsDate = cmsLastUpdated
        ? new Date(`${cmsLastUpdated.slice(0, 4)}-${cmsLastUpdated.slice(4, 6)}-${cmsLastUpdated.slice(6, 8)}`)
        : null;

      if (!dbLastSynced || (cmsDate && cmsDate > dbLastSynced)) {
        await queue.add('enrich', { syncType: 'enrich', policyId: existing.id, triggeredBy: 'scheduler' });
        queued++;
      } else {
        skipped++;
      }
    }
  } catch (err) {
    console.error('enrichChangedPolicies NCD error:', err);
  }

  try {
    const lcdList = await fetchLcdList();
    for (const lcd of lcdList) {
      const lcdCmsId = `L${lcd.lcd_id}`;
      const existing = await db('policies')
        .where({ cms_id: lcdCmsId, policy_type: 'LCD' })
        .first();
      if (!existing) { skipped++; continue; }

      const cmsLastUpdated = lcd.last_updated_sort;
      const dbLastSynced = existing.last_synced_at as Date | null;

      const cmsDate = cmsLastUpdated
        ? new Date(`${cmsLastUpdated.slice(0, 4)}-${cmsLastUpdated.slice(4, 6)}-${cmsLastUpdated.slice(6, 8)}`)
        : null;

      if (!dbLastSynced || (cmsDate && cmsDate > dbLastSynced)) {
        await queue.add('enrich', { syncType: 'enrich', policyId: existing.id, triggeredBy: 'scheduler' });
        queued++;
      } else {
        skipped++;
      }
    }
  } catch (err) {
    console.error('enrichChangedPolicies LCD error:', err);
  }

  return { queued, skipped };
}

/**
 * Enqueue enrichment jobs for all policies where icd10_covered IS NULL.
 */
export async function enqueueMissingEnrichment(): Promise<{ queued: number }> {
  const { getPolicySyncQueue } = await import('../queue/policy-sync-queue.js');
  const queue = getPolicySyncQueue();

  const missing = await db('policies')
    .whereNull('icd10_covered')
    .select('id');

  for (const row of missing) {
    await queue.add('enrich', {
      syncType: 'enrich',
      policyId: row.id as string,
      triggeredBy: 'admin',
    });
  }

  return { queued: missing.length };
}

/**
 * Full sync: status + enrich changed policies.
 */
export async function fullSync(): Promise<{ status: SyncStatusResult; enrich: EnrichBatchResult }> {
  const status = await syncPolicyStatus();
  const enrich = await enrichChangedPolicies();
  return { status, enrich };
}
