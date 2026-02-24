import { useState } from 'react';
import { Search, BookOpen, Loader2, ExternalLink, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { usePolicies } from '../api/hooks.ts';
import { api, type Policy } from '../api/client.ts';
import { cn } from '../lib/cn.ts';

const POLICY_TYPE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'NCD', label: 'NCD' },
  { value: 'LCD', label: 'LCD' },
  { value: 'INTERNAL', label: 'Internal' },
];

function PolicyTypeBadge({ type }: { type: string }) {
  const config: Record<string, string> = {
    NCD: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    LCD: 'bg-teal-50 text-teal-700 ring-teal-600/20',
    INTERNAL: 'bg-violet-50 text-violet-700 ring-violet-600/20',
    Article: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        config[type] ?? config.Internal,
      )}
    >
      {type}
    </span>
  );
}

function PolicyStatusBadge({ status }: { status: string }) {
  const isActive = status === 'ACTIVE' || status === 'active';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        isActive
          ? 'bg-green-50 text-green-700 ring-green-600/20'
          : 'bg-amber-50 text-amber-700 ring-amber-600/20',
      )}
    >
      {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
    </span>
  );
}

function CodePills({
  codes,
  colorClass,
}: {
  codes: Array<{ code: string; description: string }>;
  colorClass: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const MAX_SHOWN = 20;
  const displayed = showAll ? codes : codes.slice(0, MAX_SHOWN);
  const remaining = codes.length - MAX_SHOWN;

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {displayed.map((c) => (
        <span
          key={c.code}
          title={c.description}
          className={cn(
            'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-medium ring-1 ring-inset cursor-default',
            colorClass,
          )}
        >
          {c.code}
        </span>
      ))}
      {!showAll && remaining > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="text-[10px] text-slate-500 hover:text-slate-700 underline"
        >
          +{remaining} more
        </button>
      )}
    </div>
  );
}

function PolicyExpandedPanel({ policy }: { policy: Policy }) {
  const hasCovered = (policy.icd10Covered?.length ?? 0) > 0;
  const hasNoncovered = (policy.icd10Noncovered?.length ?? 0) > 0;
  const hasHcpcs = (policy.hcpcsCodes?.length ?? 0) > 0;

  if (!hasCovered && !hasNoncovered && !hasHcpcs) {
    return (
      <div className="px-4 py-3 text-xs text-slate-400 italic">
        No enrichment data available.{' '}
        {policy.lastSyncedAt
          ? `Last synced: ${format(new Date(policy.lastSyncedAt), 'MMM d, yyyy')}`
          : 'Never synced.'}
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 space-y-3">
      {hasCovered && (
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-green-700 mr-2">
            ICD-10 Covered ({policy.icd10Covered!.length})
          </span>
          <CodePills
            codes={policy.icd10Covered!}
            colorClass="bg-green-50 text-green-700 ring-green-600/20"
          />
        </div>
      )}
      {hasNoncovered && (
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-red-700 mr-2">
            ICD-10 Non-Covered ({policy.icd10Noncovered!.length})
          </span>
          <CodePills
            codes={policy.icd10Noncovered!}
            colorClass="bg-red-50 text-red-700 ring-red-600/20"
          />
        </div>
      )}
      {hasHcpcs && (
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 mr-2">
            HCPCS Codes ({policy.hcpcsCodes!.length})
          </span>
          <CodePills
            codes={policy.hcpcsCodes!.map((h) => ({
              code: h.modifier ? `${h.code}-${h.modifier}` : h.code,
              description: h.description,
            }))}
            colorClass="bg-blue-50 text-blue-700 ring-blue-600/20"
          />
        </div>
      )}
      {policy.lastSyncedAt && (
        <div className="text-[10px] text-slate-400">
          Synced: {format(new Date(policy.lastSyncedAt), 'MMM d, yyyy h:mm a')}
        </div>
      )}
    </div>
  );
}

function getAdminRole(): boolean {
  try {
    const user = JSON.parse(localStorage.getItem('lucidreview_user') ?? '{}');
    return user?.role === 'ADMIN';
  } catch {
    return false;
  }
}

export default function PolicyBrowser() {
  const [typeFilter, setTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [icd10Filter, setIcd10Filter] = useState(false);
  const [hcpcsFilter, setHcpcsFilter] = useState(false);
  const [expandedPolicyId, setExpandedPolicyId] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { data: policies, isLoading } = usePolicies();
  const isAdmin = getAdminRole();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSyncStatus = async () => {
    setSyncLoading(true);
    try {
      const result = await api.policies.syncStatus();
      showToast(result.message ?? 'Sync started');
    } catch (err) {
      showToast(`Sync failed: ${String(err)}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleEnrich = async () => {
    setEnrichLoading(true);
    try {
      const result = await api.policies.enrich();
      showToast(result.message ?? `Queued ${result.queued} enrichment jobs`);
    } catch (err) {
      showToast(`Enrich failed: ${String(err)}`);
    } finally {
      setEnrichLoading(false);
    }
  };

  const filteredPolicies = policies?.filter((p) => {
    if (typeFilter && p.policyType !== typeFilter) return false;
    if (icd10Filter && !(p.icd10Covered?.length ?? 0)) return false;
    if (hcpcsFilter && !(p.hcpcsCodes?.length ?? 0)) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.title.toLowerCase().includes(term) ||
      p.cmsId?.toLowerCase().includes(term) ||
      p.policyType.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900">Coverage Policies</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Browse and manage coverage determination policies and criteria
        </p>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-xs text-green-800">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-4 text-green-600 hover:text-green-800">
            ✕
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, CMS ID..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          {POLICY_TYPE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTypeFilter(value)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                typeFilter === value
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Enrichment filter chips */}
        <button
          onClick={() => setIcd10Filter((v) => !v)}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
            icd10Filter
              ? 'bg-green-50 text-green-700 border-green-300'
              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300',
          )}
        >
          Has ICD-10
        </button>
        <button
          onClick={() => setHcpcsFilter((v) => !v)}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
            hcpcsFilter
              ? 'bg-blue-50 text-blue-700 border-blue-300'
              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300',
          )}
        >
          Has HCPCS
        </button>

        {/* Admin sync buttons */}
        {isAdmin && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleSyncStatus}
              disabled={syncLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {syncLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              Sync Status
            </button>
            <button
              onClick={handleEnrich}
              disabled={enrichLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
            >
              {enrichLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              Enrich
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full clinical-table">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="w-8 px-4 py-2.5" />
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-2.5">
                Type
              </th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-2.5">
                CMS ID
              </th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-2.5">
                Title
              </th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-2.5">
                Status
              </th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-2.5">
                Effective Date
              </th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-2.5">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2 size={20} className="mx-auto animate-spin text-slate-400 mb-2" />
                  <span className="text-xs text-slate-500">Loading policies...</span>
                </td>
              </tr>
            ) : filteredPolicies && filteredPolicies.length > 0 ? (
              filteredPolicies.map((policy) => {
                const isExpanded = expandedPolicyId === policy.id;
                const hasEnrichment =
                  (policy.icd10Covered?.length ?? 0) > 0 ||
                  (policy.icd10Noncovered?.length ?? 0) > 0 ||
                  (policy.hcpcsCodes?.length ?? 0) > 0;

                return (
                  <>
                    <tr
                      key={policy.id}
                      onClick={() => setExpandedPolicyId(isExpanded ? null : policy.id)}
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-2.5 text-slate-400">
                        {isExpanded ? (
                          <ChevronUp size={13} />
                        ) : (
                          <ChevronDown size={13} className={hasEnrichment ? 'text-slate-400' : 'text-slate-200'} />
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <PolicyTypeBadge type={policy.policyType} />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-mono text-slate-600">
                          {policy.cmsId ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <BookOpen size={13} className="text-slate-400 shrink-0" />
                          <span className="text-xs text-slate-800 font-medium">{policy.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <PolicyStatusBadge status={policy.status} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {policy.effectiveDate
                          ? format(new Date(policy.effectiveDate), 'MMM d, yyyy')
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {policy.cmsId ? (
                          <a
                            href={`https://www.cms.gov/search/cms?keys=${encodeURIComponent(policy.cmsId)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            CMS.gov
                            <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${policy.id}-expanded`}>
                        <td colSpan={7} className="p-0">
                          <PolicyExpandedPanel policy={policy} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-xs text-slate-500">
                  No policies found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
