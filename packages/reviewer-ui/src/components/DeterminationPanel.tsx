import { useState } from 'react';
import { CheckCircle, UserCheck, AlertTriangle, XCircle, Shield } from 'lucide-react';
import DeterminationBadge from './DeterminationBadge.tsx';
import { cn } from '../lib/cn.ts';
import type { DeterminationResult, DeterminationRequest } from '../api/client.ts';

// ─── Confidence Bar ───────────────────────────────────────────────────────────

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>Confidence</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Action Buttons ───────────────────────────────────────────────────────────

const ACTION_BUTTONS = [
  { decision: 'AUTO_APPROVE', label: 'Approve', icon: CheckCircle, color: 'bg-green-600 hover:bg-green-700 text-white' },
  { decision: 'MD_REVIEW', label: 'Send to MD', icon: UserCheck, color: 'bg-purple-600 hover:bg-purple-700 text-white' },
  { decision: 'MORE_INFO', label: 'More Info', icon: AlertTriangle, color: 'bg-amber-600 hover:bg-amber-700 text-white' },
  { decision: 'DENY', label: 'Deny', icon: XCircle, color: 'bg-red-600 hover:bg-red-700 text-white' },
] as const;

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface DeterminationPanelProps {
  determination?: DeterminationResult;
  isDecided?: boolean;
  onDecide?: (req: DeterminationRequest) => void;
  isSubmitting?: boolean;
}

export default function DeterminationPanel({
  determination,
  isDecided,
  onDecide,
  isSubmitting,
}: DeterminationPanelProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');

  if (!determination) {
    return (
      <div className="px-4 py-8 text-center">
        <Shield size={32} className="mx-auto mb-3 text-slate-300" />
        <p className="text-sm text-slate-500">No determination yet</p>
        <p className="text-xs text-slate-400 mt-1">Run AI Review to generate a determination</p>
      </div>
    );
  }

  const isOverride = selectedAction != null && selectedAction !== determination.decision;

  const handleSubmit = () => {
    if (!selectedAction || !onDecide) return;
    onDecide({
      decision: selectedAction,
      overrideReason: isOverride ? overrideReason : undefined,
      reviewerNotes: reviewerNotes || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header / Badge */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">AI Determination</h3>
          <DeterminationBadge determination={determination.decision} size="md" />
        </div>
        <ConfidenceBar confidence={determination.confidence} />
      </div>

      {/* Policy Basis */}
      {determination.policyBasis && determination.policyBasis.length > 0 && (
        <div className="px-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Policy Basis
          </div>
          {determination.policyBasis.map((p) => (
            <div key={p.policyId} className="text-xs text-slate-700">
              {p.title}
              {p.version && <span className="ml-1.5 text-slate-400">v{p.version}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Rationale */}
      {determination.rationale && (
        <div className="px-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Rationale
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{determination.rationale}</p>
        </div>
      )}

      {/* Missing data warnings */}
      {determination.missingData && determination.missingData.length > 0 && (
        <div className="mx-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 mb-1">
            Missing Data
          </div>
          <ul className="space-y-0.5">
            {determination.missingData.map((item, i) => (
              <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      {!isDecided && onDecide && (
        <div className="px-4 space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Reviewer Decision
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ACTION_BUTTONS.map(({ decision, label, icon: Icon, color }) => (
              <button
                key={decision}
                onClick={() => setSelectedAction(decision)}
                disabled={isSubmitting}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all',
                  selectedAction === decision
                    ? cn(color, 'ring-2 ring-offset-1')
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Override reason */}
          {isOverride && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Override Reason (required)
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why you're overriding the AI determination..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                rows={3}
              />
            </div>
          )}

          {/* Reviewer notes */}
          {selectedAction && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Reviewer Notes (optional)
              </label>
              <textarea
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Additional notes for this review..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                rows={2}
              />
            </div>
          )}

          {/* Submit */}
          {selectedAction && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (isOverride && !overrideReason.trim())}
              className={cn(
                'w-full rounded-lg py-2.5 text-xs font-semibold text-white transition-colors',
                isSubmitting || (isOverride && !overrideReason.trim())
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700',
              )}
            >
              {isSubmitting ? 'Submitting...' : 'Confirm Decision'}
            </button>
          )}
        </div>
      )}

      {/* Decided state */}
      {isDecided && (
        <div className="mx-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-center">
          <CheckCircle size={16} className="mx-auto mb-1 text-green-600" />
          <p className="text-xs font-medium text-green-800">Decision Recorded</p>
        </div>
      )}
    </div>
  );
}
