import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Play, Loader2, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import DeterminationBadge from '../components/DeterminationBadge.tsx';
import UrgencyBadge from '../components/UrgencyBadge.tsx';
import { SkeletonTable } from '../components/LoadingSkeleton.tsx';
import { useReviews, useRunAgent } from '../api/hooks.ts';
import { cn } from '../lib/cn.ts';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_review', label: 'In Review' },
  { value: 'decided', label: 'Decided' },
];

function AgentStatusLabel({ status, runId }: { status: string; runId?: string }) {
  if (!runId && status === 'pending') {
    return <span className="text-xs text-slate-400">Not Started</span>;
  }
  if (status === 'in_review') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
        <Loader2 size={11} className="animate-spin" /> Running
      </span>
    );
  }
  if (status === 'decided') {
    return <span className="text-xs text-green-600 font-medium">Complete</span>;
  }
  return <span className="text-xs text-slate-400">{status}</span>;
}

export default function ReviewQueue() {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const { data: reviews, isLoading } = useReviews(
    statusFilter ? { status: statusFilter } : undefined,
  );

  // Local search filter
  const filteredReviews = reviews?.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.caseNumber.toLowerCase().includes(term) ||
      r.primaryDiagnosisDisplay?.toLowerCase().includes(term) ||
      r.primaryDiagnosisCode?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900">Review Queue</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage and review utilization management cases
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by case #, diagnosis..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                statusFilter === value
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
          <Filter size={13} />
          Filters
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={5} columns={8} />
      ) : (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full clinical-table">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-2.5">
                Case #
              </th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-2.5">
                Service Type
              </th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-2.5">
                Diagnosis
              </th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-2.5">
                Urgency
              </th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-2.5">
                Determination
              </th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-2.5">
                Agent
              </th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-2.5">
                Created
              </th>
              <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-2.5">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredReviews && filteredReviews.length > 0 ? (
              filteredReviews.map((review) => (
                <ReviewRow
                  key={review.id}
                  review={review}
                  onClick={() => navigate(`/reviews/${review.caseNumber}`)}
                />
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-xs text-slate-500">
                  No reviews found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

// ─── Row Component ────────────────────────────────────────────────────────────

function ReviewRow({
  review,
  onClick,
}: {
  review: ReturnType<typeof useReviews>['data'] extends (infer R)[] | undefined ? R : never;
  onClick: () => void;
}) {
  const runAgent = useRunAgent(review.caseNumber);

  const handleRunAgent = (e: React.MouseEvent) => {
    e.stopPropagation();
    runAgent.mutate();
  };

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer hover:bg-slate-50/50 transition-colors"
    >
      <td className="px-4 py-2.5">
        <span className="text-xs font-semibold text-blue-600 font-mono">{review.caseNumber}</span>
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-700">{review.serviceType ?? '—'}</td>
      <td className="px-4 py-2.5">
        <div className="text-xs text-slate-800">{review.primaryDiagnosisDisplay ?? '—'}</div>
        {review.primaryDiagnosisCode && (
          <span className="text-[10px] font-mono text-slate-400">{review.primaryDiagnosisCode}</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <UrgencyBadge urgency={review.urgency} />
      </td>
      <td className="px-4 py-2.5">
        <DeterminationBadge determination={review.determination} />
      </td>
      <td className="px-4 py-2.5">
        <AgentStatusLabel status={review.status} runId={review.latestRunId} />
      </td>
      <td className="px-4 py-2.5 text-[11px] text-slate-500">
        {review.createdAt ? (() => { try { const d = new Date(review.createdAt); return isNaN(d.getTime()) ? '—' : format(d, 'MMM d, HH:mm'); } catch { return '—'; } })() : '—'}
      </td>
      <td className="px-4 py-2.5 text-right">
        {review.status === 'pending' && (
          <button
            onClick={handleRunAgent}
            disabled={runAgent.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
          >
            {runAgent.isPending ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Play size={11} />
            )}
            Run AI
          </button>
        )}
      </td>
    </tr>
  );
}
