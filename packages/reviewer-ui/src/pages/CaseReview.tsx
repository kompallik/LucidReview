import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, RotateCcw, CheckCircle2, Circle, Loader2, AlertCircle,
  ChevronDown, ChevronRight, Activity, FlaskConical, Stethoscope,
  FileText, Shield, Cpu, XCircle, HelpCircle,
} from 'lucide-react';
import type { TreeNode, CriterionState } from '../components/CriteriaTreeView';
import { api } from '../api/client';
import type { AgentToolCall } from '../api/client';

// ─── Types ─────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'done' | 'skipped';

interface WorkflowStep {
  id: number;
  label: string;
  tools: string[];
  status: StepStatus;
  detail?: string;
}

interface LogEntry {
  ts: string;
  tool: string;
  status: 'running' | 'done' | 'error';
  preview?: string;
}

interface TreeResult {
  policy: {
    id: string;
    title: string;
    policyType: string;
    cmsId: string | null;
    sourceUrl: string | null;
  };
  criteriaSet: {
    id: string;
    criteriaSetId: string;
    title: string;
    scopeSetting: string;
    scopeRequestType: string;
    cqlLibraryFhirId: string | null;
  };
  tree: TreeNode;
  matchedOn: { diagnosisCodes: string[]; serviceType?: string };
}

// ─── Workflow step definitions ───────────────────────────────────────────────

const INITIAL_STEPS: WorkflowStep[] = [
  { id: 1, label: 'Gather Case Data',       tools: ['um_get_case', 'um_get_clinical_info', 'um_get_case_history', 'um_get_case_notes', 'um_get_member_coverage'], status: 'pending' },
  { id: 2, label: 'Collect Documents',       tools: ['um_get_attachments', 'um_download_attachment'], status: 'pending' },
  { id: 3, label: 'Extract Text from PDFs',  tools: ['pdf_extract_text'], status: 'pending' },
  { id: 4, label: 'Analyze Clinically (NLP)', tools: ['nlp_extract_clinical_entities'], status: 'pending' },
  { id: 5, label: 'Normalize to FHIR',       tools: ['fhir_normalize_case', 'fhir_get_patient_summary'], status: 'pending' },
  { id: 6, label: 'Look Up Coverage Policy', tools: ['policy_lookup'], status: 'pending' },
  { id: 7, label: 'Evaluate CQL Criteria',   tools: ['cql_evaluate_criteria'], status: 'pending' },
  { id: 8, label: 'Propose Determination',   tools: ['propose_determination'], status: 'pending' },
];

const TOOL_TO_STEP: Record<string, number> = {};
INITIAL_STEPS.forEach(s => s.tools.forEach(t => { TOOL_TO_STEP[t] = s.id; }));

// ─── Helpers ────────────────────────────────────────────────────────────────

function nowTs(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function toolPreview(toolName: string, output: unknown): string {
  try {
    const rawContent = Array.isArray(output)
      ? (output[0] as { text?: string } | undefined)?.text
      : String(output);
    if (!rawContent) return '';
    const parsed = JSON.parse(rawContent) as Record<string, unknown>;
    if (toolName === 'um_get_case') {
      const p = parsed['patient'] as Record<string, string> | undefined;
      return `Case: ${String(parsed['caseNumber'] ?? '')} — ${p?.['firstName'] ?? ''} ${p?.['lastName'] ?? ''}`;
    }
    if (toolName === 'um_get_clinical_info') {
      const diags = (parsed['diagnoses'] as unknown[] | undefined)?.length ?? 0;
      const vitals = (parsed['vitals'] as unknown[] | undefined)?.length ?? 0;
      return `${diags} diagnoses, ${vitals} vitals`;
    }
    if (toolName === 'pdf_extract_text') {
      return `${(parsed['text'] as string | undefined)?.length ?? 0} chars extracted`;
    }
    if (toolName === 'nlp_extract_clinical_entities') {
      const count =
        (parsed['entities'] as unknown[] | undefined)?.length ??
        (parsed['problems'] as unknown[] | undefined)?.length ?? 0;
      return `${count} entities found`;
    }
    if (toolName === 'policy_lookup') {
      const len = Array.isArray(parsed) ? (parsed as unknown[]).length : 1;
      return `${len} polic${len !== 1 ? 'ies' : 'y'} matched`;
    }
    if (toolName === 'cql_evaluate_criteria') {
      if (parsed['allCriteriaMet']) return 'All CQL criteria met';
      const results = parsed['results'] as Array<{ result: string }> | undefined;
      const met = results?.filter(r => r.result === 'MET').length ?? 0;
      return `${met}/${results?.length ?? 0} CQL criteria met`;
    }
    if (toolName === 'propose_determination') {
      const conf = Math.round(((parsed['confidence'] as number | undefined) ?? 0) * 100);
      return `${String(parsed['determination'] ?? '')} (${conf}% confidence)`;
    }
    if (toolName === 'fhir_normalize_case') return 'FHIR bundle created';
    return '';
  } catch {
    return '';
  }
}

// Fuzzy-map a criterion name from propose_determination to a tree leaf id
const KEYWORD_MAP: Array<[RegExp, string[]]> = [
  [/coverage|benefit|medicare|insur/i,                              ['coverage']],
  [/diagnos|icd|j96|respiratory fail/i,                            ['diagnosis']],
  [/spo2|spO|oximeter|saturation/i,                                ['spo2']],
  [/po2|pao2|partial.*oxygen|oxygen.*partial/i,                    ['po2']],
  [/resp.*rate|RR|breathing.*rate|tachypnea/i,                     ['resp_rate']],
  [/pco2|paco2|hypercap/i,                                         ['hypercapnia']],
  [/ph|acidosis|acidem/i,                                          ['acidosis']],
  [/lower.level|outpatient.*fail|fail.*outpat|nebuliz|home.*treat/i, ['treatment_failure']],
  [/inpatient.*monitor|iv.*medic|bipap|cpap|ventil|hospital.*level/i, ['inpatient_need']],
  [/cql|automat|library/i,                                          ['cql']],
];

function mapCriterionToLeafIds(name: string): string[] {
  for (const [pattern, ids] of KEYWORD_MAP) {
    if (pattern.test(name)) return ids;
  }
  return [];
}

function collectLeafIds(node: TreeNode): string[] {
  if (node.type === 'LEAF') return [node.id];
  return (node.children ?? []).flatMap(collectLeafIds);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const DATA_TYPE_ICON: Record<string, React.ReactNode> = {
  vital:         <Activity size={11} />,
  lab:           <FlaskConical size={11} />,
  diagnosis:     <Stethoscope size={11} />,
  procedure:     <Cpu size={11} />,
  coverage:      <Shield size={11} />,
  clinical_note: <FileText size={11} />,
};

function evaluateNode(
  node: TreeNode,
  states: Map<string, CriterionState>,
): 'MET' | 'NOT_MET' | 'UNKNOWN' {
  if (node.type === 'LEAF') {
    const s = states.get(node.id) ?? 'unknown';
    return s === 'met' ? 'MET' : s === 'not_met' ? 'NOT_MET' : 'UNKNOWN';
  }
  const results = (node.children ?? []).map(c => evaluateNode(c, states));
  if (node.type === 'AND') {
    if (!results.length) return 'UNKNOWN';
    if (results.every(r => r === 'MET')) return 'MET';
    if (results.some(r => r === 'NOT_MET')) return 'NOT_MET';
    return 'UNKNOWN';
  }
  // OR
  if (results.some(r => r === 'MET')) return 'MET';
  if (results.every(r => r === 'NOT_MET')) return 'NOT_MET';
  return 'UNKNOWN';
}

// Read-only auto-updating tree node
function AutoTreeNode({
  node,
  states,
  depth = 0,
  activeLeafIds,
}: {
  node: TreeNode;
  states: Map<string, CriterionState>;
  depth?: number;
  activeLeafIds: Set<string>;
}) {
  const [expanded, setExpanded] = useState(true);
  const result = evaluateNode(node, states);
  const isActive = node.type === 'LEAF' && activeLeafIds.has(node.id);

  if (node.type === 'LEAF') {
    const s = states.get(node.id) ?? 'unknown';
    const border =
      s === 'met'     ? 'border-l-emerald-500' :
      s === 'not_met' ? 'border-l-red-400'     :
      isActive        ? 'border-l-blue-400'    :
                        'border-l-slate-200';
    const bg =
      s === 'met'     ? 'bg-emerald-50' :
      s === 'not_met' ? 'bg-red-50'     :
      isActive        ? 'bg-blue-50'    :
                        'bg-white';
    const icon =
      s === 'met'     ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> :
      s === 'not_met' ? <XCircle size={16} className="text-red-400 shrink-0" />          :
      isActive        ? <Loader2 size={16} className="text-blue-500 animate-spin shrink-0" /> :
                        <HelpCircle size={16} className="text-slate-300 shrink-0" />;

    return (
      <div className={`${depth > 0 ? 'ml-4' : ''} relative mb-1.5`}>
        {depth > 0 && <div className="absolute -left-2 top-0 bottom-0 w-px bg-slate-200" />}
        {depth > 0 && <div className="absolute -left-2 top-4 w-2 h-px bg-slate-200" />}
        <div
          className={`rounded-lg border border-slate-100 border-l-4 ${border} ${bg} px-3 py-2 flex items-start gap-2 transition-all duration-300`}
        >
          <div className="mt-0.5">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {node.dataType && (
                <span className="inline-flex items-center gap-0.5 text-[10px] bg-slate-100 text-slate-500 rounded px-1 py-0.5">
                  {DATA_TYPE_ICON[node.dataType]}
                </span>
              )}
              <span className="text-xs font-medium text-slate-800">{node.label}</span>
            </div>
            {node.threshold && (
              <span className="inline-block mt-0.5 text-[10px] font-mono text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                {node.threshold.display ??
                  `${node.threshold.operator} ${
                    Array.isArray(node.threshold.value)
                      ? node.threshold.value.join(', ')
                      : String(node.threshold.value ?? '')
                  }${node.threshold.unit ? ' ' + node.threshold.unit : ''}`}
              </span>
            )}
            {isActive && s === 'unknown' && (
              <p className="text-[10px] text-blue-500 mt-0.5 animate-pulse">Evaluating...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Branch node
  const children = node.children ?? [];
  const metCount = children.filter(c => evaluateNode(c, states) === 'MET').length;
  const borderColor =
    result === 'MET'     ? 'border-l-emerald-400' :
    result === 'NOT_MET' ? 'border-l-red-400'     :
    node.type === 'AND'  ? 'border-l-blue-300'    :
                           'border-l-amber-300';
  const resultIcon =
    result === 'MET'     ? <CheckCircle2 size={15} className="text-emerald-500" /> :
    result === 'NOT_MET' ? <XCircle size={15} className="text-red-400" />          :
                           <HelpCircle size={15} className="text-slate-300" />;

  return (
    <div className={`${depth > 0 ? 'ml-4' : ''} relative mb-1.5`}>
      {depth > 0 && <div className="absolute -left-2 top-0 bottom-0 w-px bg-slate-200" />}
      {depth > 0 && <div className="absolute -left-2 top-4 w-2 h-px bg-slate-200" />}
      <div className={`rounded-lg border border-slate-200 border-l-4 ${borderColor} bg-white shadow-sm overflow-hidden`}>
        <div
          className="flex items-center gap-2 px-3 py-2 cursor-pointer"
          onClick={() => setExpanded(e => !e)}
        >
          <span className="text-slate-400">
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          {node.type === 'AND'
            ? <span className="text-[9px] font-bold bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 shrink-0">ALL OF</span>
            : <span className="text-[9px] font-bold bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 shrink-0">ANY OF</span>}
          <span className="text-xs font-semibold text-slate-800 flex-1">{node.label}</span>
          <span className="text-[10px] text-slate-400 font-mono shrink-0">{metCount}/{children.length}</span>
          {resultIcon}
        </div>
        {/* mini progress bar */}
        <div className="h-0.5 bg-slate-100">
          <div
            className={`h-full transition-all duration-500 ${
              result === 'MET' ? 'bg-emerald-400' : result === 'NOT_MET' ? 'bg-red-400' : 'bg-blue-300'
            }`}
            style={{ width: `${children.length ? (metCount / children.length) * 100 : 0}%` }}
          />
        </div>
      </div>
      {expanded && (
        <div className="mt-1">
          {children.map(c => (
            <AutoTreeNode
              key={c.id}
              node={c}
              states={states}
              depth={depth + 1}
              activeLeafIds={activeLeafIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Outcome banner config ───────────────────────────────────────────────────

const OUTCOME_CONFIG = {
  AUTO_APPROVE: { label: 'Auto-Approve',     bg: 'bg-emerald-500' },
  MD_REVIEW:    { label: 'MD Review Needed', bg: 'bg-amber-500' },
  MORE_INFO:    { label: 'More Info Needed', bg: 'bg-blue-500' },
  DENY:         { label: 'Deny',             bg: 'bg-red-500' },
} as const;

type OutcomeKey = keyof typeof OUTCOME_CONFIG;

function isOutcomeKey(val: string): val is OutcomeKey {
  return val in OUTCOME_CONFIG;
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

const KNOWN_CASES = ['ARF-2026-001', 'CHF-2026-002', 'HIP-2026-003', 'DIA-2026-004', 'SKN-2026-005'];

export default function CaseReview() {
  const [caseNumber, setCaseNumber] = useState('ARF-2026-001');
  const [phase, setPhase] = useState<'idle' | 'loading_criteria' | 'running' | 'done' | 'error'>('idle');
  const [steps, setSteps] = useState<WorkflowStep[]>(INITIAL_STEPS);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [treeResults, setTreeResults] = useState<TreeResult[]>([]);
  const [criteriaStates, setCriteriaStates] = useState<Map<string, CriterionState>>(new Map());
  const [activeLeafIds, setActiveLeafIds] = useState<Set<string>>(new Set());
  const [runId, setRunId] = useState<string | null>(null);
  const [determination, setDetermination] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [seenToolIds, setSeenToolIds] = useState<Set<string>>(new Set());
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll log to bottom on new entries
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const appendLog = useCallback((entry: LogEntry) => {
    setLog(prev => [...prev.slice(-49), entry]);
  }, []);

  function markStep(toolName: string, status: 'running' | 'done', detail?: string) {
    const stepId = TOOL_TO_STEP[toolName];
    if (!stepId) return;
    setSteps(prev =>
      prev.map(s => {
        if (s.id === stepId) {
          // Only advance to done if currently running or re-running
          const nextStatus: StepStatus =
            status === 'running' ? 'running' : 'done';
          return { ...s, status: nextStatus, detail: detail ?? s.detail };
        }
        // Auto-complete earlier pending steps when a later step starts running
        if (s.id < stepId && s.status === 'pending' && status === 'running') {
          return { ...s, status: 'done' };
        }
        return s;
      }),
    );
  }

  function processToolCalls(toolCalls: AgentToolCall[], treeLeafIds: string[]) {
    for (const tc of toolCalls) {
      const { toolName, output, id } = tc;
      if (seenToolIds.has(id)) continue;
      setSeenToolIds(prev => new Set([...prev, id]));

      const preview = toolPreview(toolName, output);
      appendLog({ ts: nowTs(), tool: toolName, status: 'done', preview });
      markStep(toolName, 'done', preview);

      // Update criteria states from propose_determination output
      if (toolName === 'propose_determination') {
        try {
          const rawContent = Array.isArray(output)
            ? (output[0] as { text?: string } | undefined)?.text
            : String(output);
          const det = JSON.parse(rawContent ?? '{}') as {
            determination?: string;
            confidence?: number;
            criteriaResults?: Array<{ name?: string; result?: string }>;
          };

          const outKey = det.determination ?? '';
          setDetermination(outKey);
          setConfidence(det.confidence ?? 0);

          const newStates = new Map<string, CriterionState>();
          for (const cr of det.criteriaResults ?? []) {
            const leafIds = mapCriterionToLeafIds(cr.name ?? '');
            const state: CriterionState =
              cr.result === 'MET' ? 'met' : cr.result === 'NOT_MET' ? 'not_met' : 'unknown';
            for (const lid of leafIds) {
              if (treeLeafIds.includes(lid)) newStates.set(lid, state);
            }
          }
          // If AUTO_APPROVE, mark all remaining unknown leaves as met
          if (outKey === 'AUTO_APPROVE') {
            for (const lid of treeLeafIds) {
              if (!newStates.has(lid)) newStates.set(lid, 'met');
            }
          }
          setCriteriaStates(newStates);
          setActiveLeafIds(new Set());
        } catch {
          // ignore parse errors
        }
      }

      // Light up clinical leaves during CQL evaluation
      if (toolName === 'cql_evaluate_criteria') {
        setActiveLeafIds(
          new Set(treeLeafIds.filter(id => ['spo2', 'po2', 'resp_rate', 'hypercapnia', 'acidosis'].includes(id))),
        );
        setTimeout(() => setActiveLeafIds(new Set()), 3000);
      }

      // Mark coverage as met when coverage is fetched
      if (toolName === 'um_get_member_coverage') {
        setCriteriaStates(prev => {
          const next = new Map(prev);
          if (treeLeafIds.includes('coverage')) next.set('coverage', 'met');
          return next;
        });
      }

      // Briefly highlight diagnosis leaf during clinical info fetch
      if (toolName === 'um_get_clinical_info') {
        setActiveLeafIds(new Set(['diagnosis']));
        setTimeout(() => {
          setActiveLeafIds(new Set());
          setCriteriaStates(prev => {
            const next = new Map(prev);
            if (treeLeafIds.includes('diagnosis')) next.set('diagnosis', 'met');
            return next;
          });
        }, 1500);
      }
    }
  }

  async function startReview() {
    setPhase('loading_criteria');
    setSteps(INITIAL_STEPS.map(s => ({ ...s })));
    setLog([]);
    setTreeResults([]);
    setCriteriaStates(new Map());
    setActiveLeafIds(new Set());
    setRunId(null);
    setDetermination(null);
    setErrorMsg('');
    setSeenToolIds(new Set());
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      // Step A: Fetch case info to get diagnosis code
      appendLog({ ts: nowTs(), tool: 'Loading case info...', status: 'running' });
      const caseInfo = await api.reviews.get(caseNumber).catch(() => null);

      // Step B: Load criteria tree
      appendLog({ ts: nowTs(), tool: 'Loading criteria tree...', status: 'running' });
      const params = new URLSearchParams({ serviceType: 'INPATIENT' });
      if (caseInfo?.primaryDiagnosisCode) params.set('icd10', caseInfo.primaryDiagnosisCode);

      const token = localStorage.getItem('lucidreview_token') ?? '';
      const treesResponse = await fetch(`/api/criteria-tree?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const trees: TreeResult[] = treesResponse.ok ? await treesResponse.json() as TreeResult[] : [];
      setTreeResults(trees);

      if (!trees.length) {
        appendLog({ ts: nowTs(), tool: 'No criteria tree found — using agent evaluation only', status: 'done' });
      } else {
        appendLog({ ts: nowTs(), tool: 'criteria_tree', status: 'done', preview: `${trees.length} criteria set(s) loaded` });
      }

      setPhase('running');

      // Step C: Trigger agent run
      appendLog({ ts: nowTs(), tool: 'Starting AI review agent...', status: 'running' });
      const { runId: rid } = await api.reviews.runAgent(caseNumber);
      setRunId(rid);
      appendLog({ ts: nowTs(), tool: 'agent_start', status: 'done', preview: `Run ID: ${rid.slice(0, 8)}...` });

      const treeLeafIds = trees.length ? collectLeafIds(trees[0].tree) : [];

      // Step D: Poll trace for updates
      let lastToolCount = 0;

      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const [runStatus, trace] = await Promise.all([
              api.agentRuns.get(rid),
              api.agentRuns.getTrace(rid),
            ]);

            // Flatten all tool calls from all turns
            const allToolCalls = trace.turns.flatMap(t => t.toolCalls);

            if (allToolCalls.length > lastToolCount) {
              const newCalls = allToolCalls.slice(lastToolCount);
              // Show currently running tool as "running" in workflow steps
              const lastCall = allToolCalls[allToolCalls.length - 1];
              if (lastCall) markStep(lastCall.toolName, 'running');
              processToolCalls(newCalls, treeLeafIds);
              lastToolCount = allToolCalls.length;
            }

            if (runStatus.status === 'completed' || runStatus.status === 'failed') {
              clearInterval(pollRef.current!);
              setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'done' } : s));

              if (runStatus.status === 'completed') {
                // Use determination from run status if not already set via tool calls
                if (runStatus.determination) {
                  const det = runStatus.determination;
                  const outKey = det.decision ?? '';
                  setDetermination(outKey);
                  setConfidence(det.confidence ?? 0);
                }
                setPhase('done');
                appendLog({
                  ts: nowTs(),
                  tool: 'Review complete',
                  status: 'done',
                  preview: `${trace.turns.length} turns`,
                });
              } else {
                setPhase('error');
                setErrorMsg(runStatus.error ?? 'Agent run failed');
              }
            }
          } catch {
            // Polling error — ignore, will retry on next tick
          }
        })();
      }, 3000);
    } catch (e: unknown) {
      if (pollRef.current) clearInterval(pollRef.current);
      setPhase('error');
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error');
    }
  }

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase('idle');
    setSteps(INITIAL_STEPS.map(s => ({ ...s })));
    setLog([]);
    setTreeResults([]);
    setCriteriaStates(new Map());
    setActiveLeafIds(new Set());
    setRunId(null);
    setDetermination(null);
    setErrorMsg('');
  }

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const outcomeConfig =
    determination && isOutcomeKey(determination)
      ? OUTCOME_CONFIG[determination]
      : null;

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-50">
      {/* ── HEADER ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 flex-wrap">
        <h1 className="text-lg font-semibold text-slate-900 shrink-0">AI Case Review</h1>
        <div className="flex items-center gap-2 flex-1">
          <label className="text-xs font-medium text-slate-600 shrink-0">Case #</label>
          <select
            value={caseNumber}
            onChange={e => { setCaseNumber(e.target.value); reset(); }}
            disabled={phase === 'running' || phase === 'loading_criteria'}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-slate-100"
          >
            {KNOWN_CASES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            value={caseNumber}
            onChange={e => setCaseNumber(e.target.value.toUpperCase())}
            disabled={phase === 'running' || phase === 'loading_criteria'}
            placeholder="or type a case number"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 disabled:bg-slate-100"
          />
        </div>
        <div className="flex items-center gap-2">
          {(phase === 'done' || phase === 'error') && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw size={14} /> Reset
            </button>
          )}
          <button
            onClick={() => { void startReview(); }}
            disabled={phase === 'running' || phase === 'loading_criteria' || !caseNumber.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-sm"
          >
            {phase === 'loading_criteria' || phase === 'running' ? (
              <><Loader2 size={15} className="animate-spin" /> Running...</>
            ) : (
              <><Play size={15} /> Run Review</>
            )}
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Workflow + Log ── */}
        <div className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col">
          {/* Steps */}
          <div className="p-4 border-b border-slate-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Workflow Steps
            </p>
            <div className="space-y-1">
              {steps.map(step => (
                <div
                  key={step.id}
                  className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
                    step.status === 'running' ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {step.status === 'done'    && <CheckCircle2 size={15} className="text-emerald-500" />}
                    {step.status === 'running' && <Loader2 size={15} className="text-blue-500 animate-spin" />}
                    {step.status === 'pending' && <Circle size={15} className="text-slate-300" />}
                    {step.status === 'skipped' && <Circle size={15} className="text-slate-200" />}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-medium ${
                        step.status === 'running' ? 'text-blue-700' :
                        step.status === 'done'    ? 'text-slate-700' :
                                                    'text-slate-400'
                      }`}
                    >
                      {step.id}. {step.label}
                    </p>
                    {step.detail && step.status === 'done' && (
                      <p className="text-[10px] text-slate-400 truncate">{step.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Log */}
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              AI Activity
            </p>
            <div ref={logRef} className="flex-1 overflow-y-auto space-y-1 font-mono text-[10px]">
              {log.length === 0 && phase === 'idle' && (
                <p className="text-slate-400 italic text-center mt-4">Click Run Review to start</p>
              )}
              {log.map((entry, i) => (
                <div
                  key={i}
                  className={`flex gap-1.5 ${
                    entry.status === 'error'   ? 'text-red-500'  :
                    entry.status === 'running' ? 'text-blue-500' :
                                                 'text-slate-500'
                  }`}
                >
                  <span className="text-slate-400 shrink-0">{entry.ts}</span>
                  <span
                    className={`shrink-0 ${
                      entry.status === 'done'    ? 'text-emerald-600' :
                      entry.status === 'running' ? 'text-blue-500'    :
                                                   'text-red-500'
                    }`}
                  >
                    {entry.status === 'done' ? '✓' : entry.status === 'running' ? '▶' : '✗'}
                  </span>
                  <span className="truncate text-slate-600">{entry.tool}</span>
                  {entry.preview && (
                    <span className="text-slate-400 truncate">— {entry.preview}</span>
                  )}
                </div>
              ))}
              {(phase === 'running' || phase === 'loading_criteria') && (
                <div className="flex gap-1.5 text-blue-400">
                  <span className="text-slate-400">{nowTs()}</span>
                  <Loader2 size={10} className="animate-spin shrink-0 mt-0.5" />
                  <span className="animate-pulse">Working...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Criteria Tree ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {phase === 'idle' && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="rounded-full bg-blue-100 p-4 mb-4">
                <Play size={28} className="text-blue-500" />
              </div>
              <p className="text-slate-600 font-medium">Select a case and click Run Review</p>
              <p className="text-sm text-slate-400 mt-1">
                The AI will gather clinical data, evaluate criteria, and propose a determination.
              </p>
            </div>
          )}

          {phase === 'error' && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-6 flex items-start gap-3">
              <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700">Review failed</p>
                <p className="text-sm text-red-600 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {(phase === 'loading_criteria' || phase === 'running' || phase === 'done') && (
            <div>
              {/* Outcome banner */}
              {determination && outcomeConfig ? (
                <div className={`${outcomeConfig.bg} rounded-xl mb-6 p-4 text-white shadow-md`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold opacity-80 uppercase tracking-wider mb-0.5">
                        Determination
                      </p>
                      <p className="text-2xl font-bold">{outcomeConfig.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold opacity-90">{Math.round(confidence * 100)}%</p>
                      <p className="text-xs opacity-70">confidence</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 bg-white/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/80 rounded-full"
                      style={{ width: `${confidence * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs opacity-80">
                    {determination === 'AUTO_APPROVE' &&
                      'All required criteria are met. This case qualifies for automatic approval — subject to human reviewer confirmation.'}
                    {determination === 'MD_REVIEW' &&
                      'One or more criteria could not be confirmed. Physician review is required before any adverse determination.'}
                    {determination === 'MORE_INFO' &&
                      'Some criteria require additional clinical documentation. Please provide the missing information.'}
                    {determination === 'DENY' &&
                      'Coverage criteria are not met. This case is recommended for denial — requires MD review.'}
                  </p>
                </div>
              ) : (phase === 'running' || phase === 'loading_criteria') ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 mb-6 p-4 flex items-center gap-3 text-slate-400">
                  <Loader2 size={18} className="animate-spin text-blue-400 shrink-0" />
                  <span className="text-sm">
                    {phase === 'loading_criteria' ? 'Loading criteria...' : 'AI is reviewing the case...'}
                  </span>
                </div>
              ) : null}

              {/* Criteria tree */}
              {treeResults.length > 0 ? (
                treeResults.map((result, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                          Coverage Policy
                        </p>
                        <p className="text-sm font-semibold text-slate-800">{result.policy.title}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        {result.policy.cmsId && (
                          <span className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-mono text-slate-500">
                            {result.policy.cmsId}
                          </span>
                        )}
                        <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
                          {result.criteriaSet.scopeSetting}
                        </span>
                      </div>
                    </div>
                    <AutoTreeNode
                      node={result.tree}
                      states={criteriaStates}
                      activeLeafIds={activeLeafIds}
                    />
                  </div>
                ))
              ) : (phase === 'running' || phase === 'done') ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400 text-sm">
                  No criteria tree found for this case's diagnosis codes.
                  {runId && <p className="text-xs mt-1">Run ID: {runId}</p>}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
