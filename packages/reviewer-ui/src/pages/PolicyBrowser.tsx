import { useState } from 'react';
import { Search, BookOpen, Loader2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { usePolicies } from '../api/hooks.ts';
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
  const isActive = status === 'active';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        isActive
          ? 'bg-green-50 text-green-700 ring-green-600/20'
          : 'bg-amber-50 text-amber-700 ring-amber-600/20',
      )}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function PolicyBrowser() {
  const [typeFilter, setTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const { data: policies, isLoading } = usePolicies();

  const filteredPolicies = policies?.filter((p) => {
    if (typeFilter && p.policyType !== typeFilter) return false;
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

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
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
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full clinical-table">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
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
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Loader2 size={20} className="mx-auto animate-spin text-slate-400 mb-2" />
                  <span className="text-xs text-slate-500">Loading policies...</span>
                </td>
              </tr>
            ) : filteredPolicies && filteredPolicies.length > 0 ? (
              filteredPolicies.map((policy) => (
                <tr key={policy.id} className="hover:bg-slate-50/50 transition-colors">
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
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-xs text-slate-500">
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
