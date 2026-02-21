import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Eye } from 'lucide-react';
import { format } from 'date-fns';
import StatusBadge from './StatusBadge.tsx';
import { cn } from '../lib/cn.ts';
import type { CriterionResult } from '../api/client.ts';

interface EvidenceDetailProps {
  criterion: CriterionResult;
}

function EvidenceDetail({ criterion }: EvidenceDetailProps) {
  return (
    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs space-y-1.5">
      {criterion.evidence && (
        <div>
          <span className="font-semibold text-slate-500">Evidence: </span>
          <span className="text-slate-700">{criterion.evidence}</span>
        </div>
      )}
      {criterion.value && (
        <div>
          <span className="font-semibold text-slate-500">Value: </span>
          <span className="text-slate-700 font-mono">{criterion.value}</span>
        </div>
      )}
      {criterion.observedAt && (
        <div>
          <span className="font-semibold text-slate-500">Observed: </span>
          <span className="text-slate-700">{format(new Date(criterion.observedAt), 'MMM d, yyyy HH:mm')}</span>
        </div>
      )}
      {criterion.fhirReference && (
        <div className="flex items-center gap-1">
          <span className="font-semibold text-slate-500">FHIR Ref: </span>
          <code className="text-[11px] font-mono text-blue-600">{criterion.fhirReference}</code>
          <ExternalLink size={10} className="text-blue-400" />
        </div>
      )}
      {criterion.source && (
        <div>
          <span className="font-semibold text-slate-500">Source: </span>
          <span
            className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
              criterion.source === 'STRUCTURED'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-purple-50 text-purple-700',
            )}
          >
            {criterion.source}
          </span>
        </div>
      )}
    </div>
  );
}

interface CriteriaChecklistProps {
  criteria: CriterionResult[];
  onViewEvidence?: (criterionId: string, criterionName: string) => void;
}

export default function CriteriaChecklist({ criteria, onViewEvidence }: CriteriaChecklistProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const metCount = criteria.filter((c) => c.result === 'MET').length;

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">Criteria Evaluation</h3>
        <span className="text-xs text-slate-500">
          {metCount}/{criteria.length} met
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {criteria.map((c) => {
          const isExpanded = expandedIds.has(c.criterionId);
          return (
            <div key={c.criterionId}>
              <button
                onClick={() => toggleExpand(c.criterionId)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                <StatusBadge status={c.result} />
                <span className="flex-1 text-xs text-slate-800 font-medium">
                  {c.criterionName}
                </span>
                {c.value && (
                  <span className="text-xs font-mono text-slate-500">{c.value}</span>
                )}
                <span className="text-[11px] text-blue-600 font-medium hover:text-blue-700">
                  {isExpanded ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </span>
              </button>
              {(c.evidence || c.fhirReference) && onViewEvidence && (
                <button
                  onClick={() => onViewEvidence(c.criterionId, c.criterionName)}
                  className="flex items-center gap-1 px-4 py-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                  aria-label={`View evidence for ${c.criterionName}`}
                >
                  <Eye size={12} />
                  View Evidence
                </button>
              )}
              {isExpanded && <EvidenceDetail criterion={c} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
