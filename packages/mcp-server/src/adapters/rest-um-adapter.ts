/**
 * REST UM System Adapter
 *
 * Connects to a real UM system REST API when UM_SYSTEM_BASE_URL is configured.
 * Implements the same interface as MockUmAdapter.
 *
 * Environment variables:
 *   UM_SYSTEM_BASE_URL  — Base URL of the UM system API (e.g. https://um.hospital.org/api)
 *   UM_SYSTEM_API_KEY   — Bearer token or API key for authentication
 *   UM_SYSTEM_TIMEOUT_MS — Request timeout in ms (default: 10000)
 */

const BASE_URL = process.env.UM_SYSTEM_BASE_URL ?? '';
const API_KEY  = process.env.UM_SYSTEM_API_KEY  ?? '';
const TIMEOUT  = Number(process.env.UM_SYSTEM_TIMEOUT_MS ?? 10_000);

async function umFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const resp = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
        ...options?.headers,
      },
    });
    if (!resp.ok) {
      throw new Error(`UM system returned ${resp.status} for ${path}`);
    }
    return resp.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

export const RestUmAdapter = {
  getCase: (caseNumber: string) =>
    umFetch<unknown>(`/cases/${encodeURIComponent(caseNumber)}`),

  getClinicalInfo: (caseNumber: string) =>
    umFetch<unknown>(`/cases/${encodeURIComponent(caseNumber)}/clinical`),

  getAttachments: (caseNumber: string) =>
    umFetch<unknown[]>(`/cases/${encodeURIComponent(caseNumber)}/attachments`),

  downloadAttachment: (caseNumber: string, attachmentId: string) =>
    umFetch<unknown>(`/cases/${encodeURIComponent(caseNumber)}/attachments/${encodeURIComponent(attachmentId)}`),

  getCaseHistory: (caseNumber: string) =>
    umFetch<unknown[]>(`/cases/${encodeURIComponent(caseNumber)}/history`),

  getCaseNotes: (caseNumber: string) =>
    umFetch<unknown[]>(`/cases/${encodeURIComponent(caseNumber)}/notes`),

  getMemberCoverage: (memberId: string) =>
    umFetch<unknown>(`/members/${encodeURIComponent(memberId)}/coverage`),
};

export default RestUmAdapter;

export function getUmAdapter(): typeof RestUmAdapter {
  if (process.env.UM_SYSTEM_BASE_URL) {
    return RestUmAdapter;
  }
  // Caller must import MockUmAdapter separately for the fallback
  throw new Error('UM_SYSTEM_BASE_URL not set — use MockUmAdapter for development');
}
