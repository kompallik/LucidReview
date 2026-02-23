import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Play, Loader2, Search, SlidersHorizontal,
  ClipboardList, CheckCircle2, Clock, AlertCircle, TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import DeterminationBadge from '../components/DeterminationBadge.tsx';
import UrgencyBadge from '../components/UrgencyBadge.tsx';
import { SkeletonTable } from '../components/LoadingSkeleton.tsx';
import { useReviews, useRunAgent } from '../api/hooks.ts';
import { cn } from '../lib/cn.ts';

// ── Status filter config ───────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: '', label: 'All', color: 'text-slate-600' },
  { value: 'pending', label: 'Pending', color: 'text-amber-600' },
  { value: 'in_review', label: 'In Review', color: 'text-blue-600' },
  { value: 'decided', label: 'Decided', color: 'text-emerald-600' },
];

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: typeof ClipboardList;
  iconColor: string;
  iconBg: string;
  trend?: string;
}

function StatCard({ label, value, icon: Icon, iconColor, iconBg, trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3.5">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon size={18} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-slate-900 leading-none">{value}</p>
        {trend && (
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-600">
            <TrendingUp size={10} />
            <span>{trend}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agent status indicator ────────────────────────────────────────────────────

function AgentStatus({ status, runId }: { status: string; runId?: string }) {
  if (!runId && status === 'pending') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        <span className="text-xs text-slate-400">Not started</span>
      </div>
    );
  }
  if (status === 'in_review') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
        </span>
        <span className="text-xs font-medium text-blue-600">Running</span>
      </div>
    );
  }
  if (status === 'decided') {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle2 size={13} className="text-emerald-500" />
        <span className="text-xs font-medium text-emerald-600">Complete</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
      <span className="text-xs text-slate-400">{status}</span>
    </div>
  );
}

// ── Row component ─────────────────────────────────────────────────────────────

function ReviewRow({
  review,
  onClick,
}: {
  review: ReturnType<typeof useReviews>['data'] extends (infer R)[] | undefined ? R : never;
  onClick: () => void;
}) {
  const navigate = useNavigate();
  const runAgent = useRunAgent(review.caseNumber);

  const handleRunAgent = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/case-review?case=${review.caseNumber}`);
  };

  const safeDate = (val: string | undefined) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      return isNaN(d.getTime()) ? '—' : format(d, 'MMM d, HH:mm');
    } catch { return '—'; }
  };

  return (
    <tr
      onClick={onClick}
      className="group cursor-pointer border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/70"
    >
      {/* Case # */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-blue-600 group-hover:text-blue-700">
            {review.caseNumber}
          </span>
        </div>
      </td>

      {/* Service type */}
      <td className="px-4 py-3">
        {review.serviceType ? (
          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {review.serviceType}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>

      {/* Diagnosis */}
      <td className="px-4 py-3">
        <div className="text-xs font-medium text-slate-800">
          {review.primaryDiagnosisDisplay ?? '—'}
        </div>
        {review.primaryDiagnosisCode && (
          <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
            {review.primaryDiagnosisCode}
          </span>
        )}
      </td>

      {/* Urgency */}
      <td className="px-4 py-3">
        <UrgencyBadge urgency={review.urgency} />
      </td>

      {/* Determination */}
      <td className="px-4 py-3">
        <DeterminationBadge determination={review.determination} />
      </td>

      {/* Agent */}
      <td className="px-4 py-3">
        <AgentStatus status={review.status} runId={review.latestRunId} />
      </td>

      {/* Created */}
      <td className="px-4 py-3">
        <span className="text-[11px] text-slate-500">{safeDate(review.createdAt)}</span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        {review.status === 'pending' && (
          <button
            onClick={handleRunAgent}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-md"
          >
            <Play size={11} />
            Run AI
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReviewQueue() {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const { data: reviews, isLoading } = useReviews(
    statusFilter ? { status: statusFilter } : undefined,
  );

  const filteredReviews = reviews?.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.caseNumber.toLowerCase().includes(term) ||
      r.primaryDiagnosisDisplay?.toLowerCase().includes(term) ||
      r.primaryDiagnosisCode?.toLowerCase().includes(term)
    );
  });

  // Stats derived from data
  const total = reviews?.length ?? 0;
  const pending = reviews?.filter((r) => r.status === 'pending').length ?? 0;
  const running = reviews?.filter((r) => r.status === 'in_review').length ?? 0;
  const decided = reviews?.filter((r) => r.status === 'decided').length ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-900">Review Queue</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Utilization management cases awaiting AI analysis or human review
            </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/20 transition-all hover:bg-blue-700">
            <Play size={12} />
            New Case
          </button>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          <StatCard
            label="Total Cases"
            value={total}
            icon={ClipboardList}
            iconColor="text-slate-600"
            iconBg="bg-slate-100"
          />
          <StatCard
            label="Pending Review"
            value={pending}
            icon={Clock}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
          />
          <StatCard
            label="AI Running"
            value={running}
            icon={Loader2}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
          />
          <StatCard
            label="Decided"
            value={decided}
            icon={CheckCircle2}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
            trend="↑ 12% this week"
          />
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-6 py-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search case #, diagnosis…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 transition-colors focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/20"
          />
        </div>

        {/* Status pill filter */}
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                statusFilter === value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filter button */}
        <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50">
          <SlidersHorizontal size={12} />
          Filters
        </button>

        {/* Count */}
        <span className="ml-auto text-[11px] text-slate-400">
          {filteredReviews ? `${filteredReviews.length} case${filteredReviews.length !== 1 ? 's' : ''}` : ''}
        </span>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 py-4 scrollbar-thin">
        {isLoading ? (
          <SkeletonTable rows={6} columns={8} />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <table className="w-full clinical-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Case #
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Service
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Diagnosis
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Urgency
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Determination
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    AI Agent
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Created
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
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
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                          <AlertCircle size={20} className="text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-600">No reviews found</p>
                        <p className="text-xs text-slate-400">Try adjusting your search or filters</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
