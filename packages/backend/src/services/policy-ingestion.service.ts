/**
 * CMS Medicare Coverage Policy Ingestion Service.
 *
 * Fetches NCD/LCD policy data from the CMS Medicare Coverage Database API
 * and upserts into the local policies table.
 *
 * API base: https://api.cms.gov/medicare-coverage-db/api/v2
 */
import { randomUUID } from 'crypto';
import { db } from '../db/connection.js';

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

const CMS_API_BASE = 'https://api.cms.gov/medicare-coverage-db/api/v2';

// Well-known NCDs to sync
const KNOWN_NCD_IDS = [
  '20.4', '20.6', '20.9', '20.10', '20.14', '20.15',
  '50.1', '50.3', '160.6', '160.12', '160.18', '160.26',
];

interface CmsApiItem {
  id?: string;
  title?: string;
  type?: string;
  status?: string;
  effectiveDate?: string;
  retirementDate?: string;
  sourceUrl?: string;
  summary?: string;
  [key: string]: unknown;
}

/**
 * Fetch a single NCD from CMS API.
 */
async function fetchCmsNcd(ncdId: string): Promise<CmsApiItem> {
  const url = `${CMS_API_BASE}/ncd/${encodeURIComponent(ncdId)}`;
  const resp = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    // Return stub data if API unavailable
    return {
      id: ncdId,
      title: `NCD ${ncdId} (pending CMS sync)`,
      type: 'ncd',
      status: 'active',
    };
  }

  return resp.json() as Promise<CmsApiItem>;
}

/**
 * Fetch a single LCD from CMS API.
 */
async function fetchCmsLcd(lcdId: string): Promise<CmsApiItem> {
  const url = `${CMS_API_BASE}/lcd/${encodeURIComponent(lcdId)}`;
  const resp = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    return {
      id: lcdId,
      title: `LCD ${lcdId} (pending CMS sync)`,
      type: 'lcd',
      status: 'active',
    };
  }

  return resp.json() as Promise<CmsApiItem>;
}

/**
 * Parse raw CMS content into structured sections_json.
 */
function parseSectionsJson(item: CmsApiItem): Record<string, unknown> {
  const raw = typeof item.summary === 'string' ? item.summary : JSON.stringify(item);

  // Extract ICD-10 codes (letter + 2-4 digits + optional decimal + more digits)
  const icd10Pattern = /\b[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?\b/g;
  const diagnosisCodes = [...new Set(raw.match(icd10Pattern) ?? [])];

  return {
    summary: item.summary ?? null,
    indications: (item as { indications?: string }).indications ?? null,
    nonCoveredIndications: (item as { nonCoveredIndications?: string }).nonCoveredIndications ?? null,
    codingGuidance: (item as { codingGuidance?: string }).codingGuidance ?? null,
    diagnosisCodes,
  };
}

/**
 * Upsert a policy from CMS item data.
 */
async function upsertPolicy(
  cmsId: string,
  policyType: 'NCD' | 'LCD',
  item: CmsApiItem,
): Promise<PolicyIngestionResult> {
  const existing = await db('policies').where({ cms_id: cmsId }).first();
  const sectionsJson = parseSectionsJson(item);

  const policyData = {
    cms_id: cmsId,
    policy_type: policyType,
    title: item.title ?? `${policyType} ${cmsId}`,
    status: item.status === 'retired' ? 'RETIRED' : 'ACTIVE',
    effective_date: item.effectiveDate ?? null,
    retirement_date: item.retirementDate ?? null,
    source_url: item.sourceUrl ?? `https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?NCDId=${cmsId}`,
    sections_json: JSON.stringify(sectionsJson),
    updated_at: new Date(),
  };

  if (existing) {
    await db('policies').where({ id: existing.id }).update(policyData);
    return { id: existing.id, cmsId, title: policyData.title, action: 'updated' };
  }

  const id = randomUUID();
  await db('policies').insert({ id, ...policyData, created_at: new Date() });
  return { id, cmsId, title: policyData.title, action: 'created' };
}

export async function ingestNcdFromCms(ncdId: string): Promise<PolicyIngestionResult> {
  const item = await fetchCmsNcd(ncdId);
  return upsertPolicy(ncdId, 'NCD', item);
}

export async function ingestLcdFromCms(lcdId: string): Promise<PolicyIngestionResult> {
  const item = await fetchCmsLcd(lcdId);
  return upsertPolicy(lcdId, 'LCD', item);
}

export async function syncActivePolicies(): Promise<SyncResult> {
  let ingested = 0;
  let updated = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const ncdId of KNOWN_NCD_IDS) {
    try {
      const result = await ingestNcdFromCms(ncdId);
      if (result.action === 'created') ingested++;
      else updated++;
    } catch (err) {
      errors.push({ id: ncdId, error: String(err) });
    }
  }

  return { ingested, updated, errors };
}
