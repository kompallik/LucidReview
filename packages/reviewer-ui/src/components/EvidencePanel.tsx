import { X, ExternalLink, FileText, Inbox } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '../lib/cn.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  fhirRef: string;
  path?: string;
  valueSeen?: string | number | boolean;
  effectiveTime?: string;
  sourceDocExcerpt?: string;
  sourceDocHash?: string;
  extractedBy: 'STRUCTURED' | 'NLP' | 'MANUAL';
  assertion: 'AFFIRMED' | 'NEGATED' | 'UNCERTAIN';
  confidence?: number;
}

interface EvidencePanelProps {
  evidence: EvidenceItem[];
  criterionDescription: string;
  onClose: () => void;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const EXTRACTED_BY_STYLES: Record<string, string> = {
  STRUCTURED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  NLP: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  MANUAL: 'bg-slate-50 text-slate-700 ring-slate-600/20',
};

const ASSERTION_STYLES: Record<string, string> = {
  AFFIRMED: 'bg-green-50 text-green-700 ring-green-600/20',
  NEGATED: 'bg-red-50 text-red-700 ring-red-600/20',
  UNCERTAIN: 'bg-amber-50 text-amber-700 ring-amber-600/20',
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
        className,
      )}
    >
      {label}
    </span>
  );
}

// ─── Value formatter ──────────────────────────────────────────────────────────

function FormattedValue({ value }: { value: string | number | boolean }) {
  if (typeof value === 'boolean') {
    return (
      <span className={cn('font-mono', value ? 'text-green-700' : 'text-red-700')}>
        {value ? 'true' : 'false'}
      </span>
    );
  }
  if (typeof value === 'number') {
    return <span className="font-mono text-slate-800">{value}</span>;
  }
  return <span className="text-slate-700">{value}</span>;
}

// ─── Time formatter ───────────────────────────────────────────────────────────

function EffectiveTime({ iso }: { iso: string }) {
  const date = new Date(iso);
  const relative = formatDistanceToNow(date, { addSuffix: true });
  const absolute = format(date, 'MMM d, yyyy HH:mm');
  return (
    <span title={absolute} className="text-slate-600">
      {relative}{' '}
      <span className="text-slate-400">({absolute})</span>
    </span>
  );
}

// ─── Evidence card ────────────────────────────────────────────────────────────

function EvidenceCard({ item }: { item: EvidenceItem }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5">
      {/* FHIR Reference */}
      <div className="flex items-center gap-1.5">
        <code className="flex-1 truncate text-[11px] font-mono text-blue-600 hover:text-blue-700">
          {item.fhirRef}
        </code>
        <ExternalLink size={11} className="shrink-0 text-blue-400" />
      </div>

      {/* Path */}
      {item.path && (
        <div className="text-xs">
          <span className="font-semibold text-slate-500">Path: </span>
          <code className="text-[11px] font-mono text-slate-600">{item.path}</code>
        </div>
      )}

      {/* Value */}
      {item.valueSeen !== undefined && item.valueSeen !== null && (
        <div className="text-xs">
          <span className="font-semibold text-slate-500">Value: </span>
          <FormattedValue value={item.valueSeen} />
        </div>
      )}

      {/* Effective time */}
      {item.effectiveTime && (
        <div className="text-xs">
          <span className="font-semibold text-slate-500">Observed: </span>
          <EffectiveTime iso={item.effectiveTime} />
        </div>
      )}

      {/* Source doc excerpt */}
      {item.sourceDocExcerpt && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <FileText size={11} className="text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-500">Source Document</span>
            {item.sourceDocHash && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-mono text-slate-500">
                #{item.sourceDocHash.slice(0, 8)}
              </span>
            )}
          </div>
          <blockquote className="border-l-2 border-slate-300 bg-slate-50 px-3 py-2 text-xs italic text-slate-600 leading-relaxed">
            {item.sourceDocExcerpt}
          </blockquote>
        </div>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          label={item.extractedBy}
          className={EXTRACTED_BY_STYLES[item.extractedBy] ?? EXTRACTED_BY_STYLES.MANUAL!}
        />
        <Badge
          label={item.assertion}
          className={ASSERTION_STYLES[item.assertion] ?? ASSERTION_STYLES.UNCERTAIN!}
        />
        {item.confidence !== undefined && (
          <span className="text-[10px] text-slate-400 ml-1">
            {Math.round(item.confidence * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function EvidencePanel({
  evidence,
  criterionDescription,
  onClose,
}: EvidencePanelProps) {
  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl border-l border-slate-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">Evidence Details</h3>
          <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{criterionDescription}</p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label="Close evidence panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {evidence.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox size={32} className="mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">No evidence available</p>
            <p className="mt-1 text-xs text-slate-400">
              Evidence will appear here once the agent collects supporting data.
            </p>
          </div>
        ) : (
          evidence.map((item, i) => <EvidenceCard key={`${item.fhirRef}-${i}`} item={item} />)
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 px-4 py-2.5">
        <span className="text-[10px] text-slate-400">
          {evidence.length} evidence item{evidence.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
