import { useState, useCallback } from 'react';
import {
  CheckCircle2, XCircle, HelpCircle,
  ChevronDown, ChevronRight,
  Activity, FlaskConical, Stethoscope, FileText, Shield, Cpu,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CriterionState = 'unknown' | 'met' | 'not_met';

export interface TreeNode {
  id: string;
  label: string;
  description?: string;
  type: 'AND' | 'OR' | 'LEAF';
  dataType?: 'vital' | 'lab' | 'diagnosis' | 'procedure' | 'coverage' | 'clinical_note';
  threshold?: {
    operator: string;
    value?: number | string | string[];
    unit?: string;
    loinc?: string;
    display?: string;
  };
  cqlExpression?: string;
  required: boolean;
  clinicalNotes?: string;
  children?: TreeNode[];
}

// ─── Data-type icon map ───────────────────────────────────────────────────────

const DATA_TYPE_ICON: Record<string, React.ReactNode> = {
  vital:         <Activity size={11} />,
  lab:           <FlaskConical size={11} />,
  diagnosis:     <Stethoscope size={11} />,
  procedure:     <Cpu size={11} />,
  coverage:      <Shield size={11} />,
  clinical_note: <FileText size={11} />,
};

// ─── Tree evaluation helpers ──────────────────────────────────────────────────

function evaluateNode(
  node: TreeNode,
  states: Map<string, CriterionState>,
): 'MET' | 'NOT_MET' | 'UNKNOWN' {
  if (node.type === 'LEAF') {
    const s = states.get(node.id) ?? 'unknown';
    if (s === 'met') return 'MET';
    if (s === 'not_met') return 'NOT_MET';
    return 'UNKNOWN';
  }
  const children = node.children ?? [];
  const results = children.map((c) => evaluateNode(c, states));
  if (node.type === 'AND') {
    if (results.length === 0) return 'UNKNOWN';
    if (results.every((r) => r === 'MET')) return 'MET';
    if (results.some((r) => r === 'NOT_MET')) return 'NOT_MET';
    return 'UNKNOWN';
  }
  // OR
  if (results.some((r) => r === 'MET')) return 'MET';
  if (results.every((r) => r === 'NOT_MET')) return 'NOT_MET';
  return 'UNKNOWN';
}

function countLeaves(node: TreeNode): number {
  if (node.type === 'LEAF') return 1;
  return (node.children ?? []).reduce((sum, c) => sum + countLeaves(c), 0);
}

function countMetLeaves(node: TreeNode, states: Map<string, CriterionState>): number {
  if (node.type === 'LEAF') return states.get(node.id) === 'met' ? 1 : 0;
  return (node.children ?? []).reduce((sum, c) => sum + countMetLeaves(c, states), 0);
}

function childProgress(node: TreeNode, states: Map<string, CriterionState>) {
  const children = node.children ?? [];
  const met = children.filter((c) => evaluateNode(c, states) === 'MET').length;
  return { met, total: children.length };
}

// ─── Outcome configuration ────────────────────────────────────────────────────

const OUTCOMES = {
  AUTO_APPROVE: { label: 'Auto-Approve',      color: 'bg-emerald-500', confidence: 0.95 },
  MD_REVIEW:    { label: 'MD Review',         color: 'bg-amber-500',   confidence: 0.70 },
  MORE_INFO:    { label: 'More Info Needed',   color: 'bg-blue-500',   confidence: 0.50 },
  PENDING:      { label: 'Assessment Pending', color: 'bg-slate-400',  confidence: 0 },
} as const;

type OutcomeKey = keyof typeof OUTCOMES;

function getOutcome(
  rootResult: 'MET' | 'NOT_MET' | 'UNKNOWN',
  totalLeaves: number,
  metLeaves: number,
): OutcomeKey {
  if (totalLeaves === 0 || metLeaves === 0) return 'PENDING';
  if (rootResult === 'MET') return 'AUTO_APPROVE';
  if (rootResult === 'NOT_MET') return 'MD_REVIEW';
  return 'MORE_INFO';
}

// ─── LeafNode ─────────────────────────────────────────────────────────────────

interface LeafProps {
  node: TreeNode;
  state: CriterionState;
  onChange: (id: string, state: CriterionState) => void;
}

function LeafNode({ node, state, onChange }: LeafProps) {
  const borderColor =
    state === 'met'     ? 'border-l-emerald-500' :
    state === 'not_met' ? 'border-l-red-400'     :
                          'border-l-slate-300';

  const bgColor =
    state === 'met'     ? 'bg-emerald-50/60' :
    state === 'not_met' ? 'bg-red-50/60'     :
                          'bg-white';

  const labelColor =
    state === 'met'     ? 'text-emerald-800' :
    state === 'not_met' ? 'text-red-700'     :
                          'text-slate-800';

  return (
    <div
      className={`rounded-lg border border-slate-100 border-l-4 ${borderColor} ${bgColor} shadow-sm mb-2 transition-colors duration-150`}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        {/* Status icon — click to cycle unknown -> met -> not_met -> unknown */}
        <button
          type="button"
          onClick={() => {
            const next: CriterionState =
              state === 'unknown' ? 'met' : state === 'met' ? 'not_met' : 'unknown';
            onChange(node.id, next);
          }}
          className="mt-0.5 shrink-0 rounded-full transition-transform hover:scale-110 focus:outline-none"
          title="Click to toggle: Unknown → Met → Not Met"
        >
          {state === 'met'     ? <CheckCircle2 size={20} className="text-emerald-500" /> :
           state === 'not_met' ? <XCircle      size={20} className="text-red-400" />     :
                                 <HelpCircle   size={20} className="text-slate-300" />}
        </button>

        <div className="flex-1 min-w-0">
          {/* Label row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            {node.dataType && (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-500">
                {DATA_TYPE_ICON[node.dataType]}
                {node.dataType.replace('_', ' ')}
              </span>
            )}
            <span className={`text-sm font-medium ${labelColor}`}>{node.label}</span>
            {!node.required && (
              <span className="text-[10px] text-slate-400 italic">optional</span>
            )}
          </div>

          {node.description && (
            <p className="text-xs text-slate-500 leading-relaxed">{node.description}</p>
          )}

          {/* Threshold */}
          {node.threshold && (
            <span className="inline-block mt-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-mono text-slate-600">
              {node.threshold.display ?? (
                `${node.threshold.operator} ${Array.isArray(node.threshold.value) ? node.threshold.value.join(', ') : String(node.threshold.value ?? '')}${node.threshold.unit ? ' ' + node.threshold.unit : ''}`
              )}
              {node.threshold.loinc && (
                <span className="ml-1.5 text-slate-400">LOINC {node.threshold.loinc}</span>
              )}
            </span>
          )}

          {node.clinicalNotes && (
            <p className="mt-1 text-[11px] text-slate-400 italic">{node.clinicalNotes}</p>
          )}
        </div>

        {/* Met / Not Met action buttons */}
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button
            type="button"
            onClick={() => onChange(node.id, state === 'met' ? 'unknown' : 'met')}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              state === 'met'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700'
            }`}
          >
            Met
          </button>
          <button
            type="button"
            onClick={() => onChange(node.id, state === 'not_met' ? 'unknown' : 'not_met')}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              state === 'not_met'
                ? 'bg-red-400 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-700'
            }`}
          >
            Not Met
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BranchNode (AND / OR) ────────────────────────────────────────────────────

interface BranchProps {
  node: TreeNode;
  states: Map<string, CriterionState>;
  onChange: (id: string, state: CriterionState) => void;
  depth?: number;
}

function BranchNode({ node, states, onChange, depth = 0 }: BranchProps) {
  const [expanded, setExpanded] = useState(true);
  const result = evaluateNode(node, states);
  const { met, total } = childProgress(node, states);

  const borderColor =
    result === 'MET'     ? 'border-l-emerald-400' :
    result === 'NOT_MET' ? 'border-l-red-400'     :
    node.type === 'AND'  ? 'border-l-blue-300'    :
                           'border-l-amber-300';

  const progressPct = total > 0 ? Math.round((met / total) * 100) : 0;

  const progressBarColor =
    result === 'MET'     ? 'bg-emerald-400' :
    result === 'NOT_MET' ? 'bg-red-400'     :
                           'bg-blue-400';

  const countColor =
    result === 'MET'     ? 'text-emerald-600' :
    result === 'NOT_MET' ? 'text-red-500'     :
                           'text-slate-400';

  return (
    <div className={`${depth > 0 ? 'ml-5 relative' : ''} mb-2`}>
      {depth > 0 && <div className="absolute -left-3 top-0 bottom-0 w-px bg-slate-200" />}
      {depth > 0 && <div className="absolute -left-3 top-5 w-3 h-px bg-slate-200" />}

      <div className={`rounded-lg border border-slate-200 border-l-4 ${borderColor} bg-white shadow-sm`}>
        {/* Branch header */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
          onClick={() => setExpanded((e) => !e)}
        >
          <div className="text-slate-400 shrink-0">
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </div>

          {/* AND / OR badge */}
          {node.type === 'AND' ? (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 shrink-0">
              ALL OF
            </span>
          ) : (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 shrink-0">
              ANY OF
            </span>
          )}

          <span className="text-sm font-semibold text-slate-800 flex-1">{node.label}</span>

          {/* Progress count */}
          <span className={`text-xs font-mono shrink-0 ${countColor}`}>
            {met}/{total}
            {node.type === 'OR' && (
              <span className="text-slate-300 ml-1">(need 1)</span>
            )}
          </span>

          {/* Result icon */}
          <div className="shrink-0">
            {result === 'MET'     ? <CheckCircle2 size={16} className="text-emerald-500" /> :
             result === 'NOT_MET' ? <XCircle      size={16} className="text-red-400" />     :
                                    <HelpCircle   size={16} className="text-slate-300" />}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-100 rounded-b overflow-hidden">
          <div
            className={`h-full ${progressBarColor} transition-all duration-300`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Children */}
      {expanded && (
        <div className="mt-1 ml-2">
          {(node.children ?? []).map((child) =>
            child.type === 'LEAF' ? (
              <LeafNode
                key={child.id}
                node={child}
                state={states.get(child.id) ?? 'unknown'}
                onChange={onChange}
              />
            ) : (
              <BranchNode
                key={child.id}
                node={child}
                states={states}
                onChange={onChange}
                depth={depth + 1}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ─── Outcome banner ───────────────────────────────────────────────────────────

interface OutcomeBannerProps {
  outcomeKey: OutcomeKey;
  metLeaves: number;
  notMetLeaves: number;
  reviewedLeaves: number;
  totalLeaves: number;
  progressPct: number;
  onReset: () => void;
}

function OutcomeBanner({
  outcomeKey,
  metLeaves,
  notMetLeaves,
  reviewedLeaves,
  totalLeaves,
  progressPct,
  onReset,
}: OutcomeBannerProps) {
  const outcome = OUTCOMES[outcomeKey];

  return (
    <div className="sticky top-0 z-20 rounded-xl mb-4 overflow-hidden shadow-md">
      <div className={`${outcome.color} px-4 py-3`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-white tracking-wide">{outcome.label}</span>
            {outcomeKey !== 'PENDING' && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs text-white font-medium">
                {Math.round(outcome.confidence * 100)}% confidence
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/80 text-xs">
              {metLeaves} of {totalLeaves} criteria met
              {notMetLeaves > 0 && ` · ${notMetLeaves} not met`}
            </span>
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1 text-xs text-white font-medium transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-2 h-1.5 rounded-full bg-white/30 overflow-hidden">
          <div
            className="h-full bg-white/90 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5 text-[10px] text-white/60">
          <span>{reviewedLeaves} reviewed</span>
          <span>{totalLeaves - reviewedLeaves} remaining</span>
        </div>
      </div>

      {/* Outcome explanation */}
      {outcomeKey !== 'PENDING' && (
        <div className="bg-white border-x border-b border-slate-200 px-4 py-2">
          <p className="text-xs text-slate-500">
            {outcomeKey === 'AUTO_APPROVE' &&
              'All required criteria are met. This case qualifies for automatic approval.'}
            {outcomeKey === 'MD_REVIEW' &&
              'One or more criteria are not met. Physician review is required before any adverse determination.'}
            {outcomeKey === 'MORE_INFO' &&
              'Some criteria are still pending. Additional clinical documentation or information is needed.'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── CriteriaTreeView (root export) ──────────────────────────────────────────

interface CriteriaTreeViewProps {
  tree: TreeNode;
  policyTitle?: string;
  cmsId?: string | null;
  scopeSetting?: string;
  scopeRequestType?: string;
  cqlLibraryFhirId?: string | null;
}

export default function CriteriaTreeView({
  tree,
  policyTitle,
  cmsId,
  scopeSetting,
  scopeRequestType,
}: CriteriaTreeViewProps) {
  const [states, setStates] = useState<Map<string, CriterionState>>(new Map());

  const handleChange = useCallback((id: string, state: CriterionState) => {
    setStates((prev) => {
      const next = new Map(prev);
      if (state === 'unknown') {
        next.delete(id);
      } else {
        next.set(id, state);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => setStates(new Map()), []);

  const rootResult   = evaluateNode(tree, states);
  const totalLeaves  = countLeaves(tree);
  const metLeaves    = countMetLeaves(tree, states);
  const notMetLeaves = [...states.values()].filter((s) => s === 'not_met').length;
  const reviewedLeaves = metLeaves + notMetLeaves;
  const outcomeKey   = getOutcome(rootResult, totalLeaves, metLeaves);
  const progressPct  = totalLeaves > 0 ? Math.round((reviewedLeaves / totalLeaves) * 100) : 0;

  return (
    <div>
      {/* Policy header */}
      {policyTitle && (
        <div className="mb-4 flex items-start justify-between gap-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
              Coverage Policy
            </p>
            <p className="text-sm font-semibold text-slate-800">{policyTitle}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-right shrink-0">
            {cmsId && (
              <span className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-mono text-slate-500">
                {cmsId}
              </span>
            )}
            {scopeSetting && (
              <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">
                {scopeSetting}
              </span>
            )}
            {scopeRequestType && (
              <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">
                {scopeRequestType}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Outcome banner (sticky) */}
      <OutcomeBanner
        outcomeKey={outcomeKey}
        metLeaves={metLeaves}
        notMetLeaves={notMetLeaves}
        reviewedLeaves={reviewedLeaves}
        totalLeaves={totalLeaves}
        progressPct={progressPct}
        onReset={reset}
      />

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-500 px-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-200" /> ALL required (AND)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-200" /> ANY one required (OR)
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-emerald-500" /> Met
        </span>
        <span className="flex items-center gap-1.5">
          <XCircle size={12} className="text-red-400" /> Not Met
        </span>
        <span className="flex items-center gap-1.5">
          <HelpCircle size={12} className="text-slate-300" /> Not yet reviewed
        </span>
      </div>

      {/* Tree */}
      <BranchNode node={tree} states={states} onChange={handleChange} depth={0} />
    </div>
  );
}
