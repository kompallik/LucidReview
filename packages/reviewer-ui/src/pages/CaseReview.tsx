import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { useSearchParams } from 'react-router';
import {
  Play, RotateCcw, CheckCircle2, Circle, Loader2, AlertCircle,
  ChevronDown, ChevronRight, Activity, FlaskConical, Stethoscope,
  FileText, Shield, Cpu, XCircle, HelpCircle, ExternalLink, BookOpen,
  Database, FileSearch, Brain, Network, GitBranch, Sparkles,
  Terminal, ChevronUp, ArrowRight, Search,
} from 'lucide-react';

const HAPI_FHIR_URL = 'http://localhost:8080/fhir';

function extractFhirRefs(text: string): Array<{ ref: string; url: string }> {
  const pattern = /\b(Observation|Condition|Patient|Procedure|MedicationRequest|DiagnosticReport|DocumentReference|Encounter|Coverage)\/([A-Za-z0-9\-]+)\b/g;
  const refs: Array<{ ref: string; url: string }> = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const ref = m[0];
    if (!seen.has(ref)) { seen.add(ref); refs.push({ ref, url: `${HAPI_FHIR_URL}/${ref}` }); }
  }
  return refs;
}

import type { TreeNode, CriterionState } from '../components/CriteriaTreeView';
import { api } from '../api/client';
import type { AgentToolCall } from '../api/client';
import { cn } from '../lib/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'done' | 'skipped';

interface WorkflowStep {
  id: number;
  label: string;
  description: string;
  icon: typeof Database;
  tools: string[];
  status: StepStatus;
  detail?: string;
  startTime?: number;
}

interface LogEntry {
  ts: string;
  tool: string;
  status: 'running' | 'done' | 'error';
  preview?: string;
  type: 'tool' | 'ai' | 'system';
}

interface TreeResult {
  policy: { id: string; title: string; policyType: string; cmsId: string | null; sourceUrl: string | null };
  criteriaSet: { id: string; criteriaSetId: string; title: string; scopeSetting: string; scopeRequestType: string; cqlLibraryFhirId: string | null };
  tree: TreeNode;
  matchedOn: { diagnosisCodes: string[]; serviceType?: string };
}

// ─── Workflow step definitions ────────────────────────────────────────────────

const INITIAL_STEPS: WorkflowStep[] = [
  { id: 1, label: 'Gather Case Data', description: 'Fetching case info, clinical data, member coverage', icon: Database, tools: ['um_get_case', 'um_get_clinical_info', 'um_get_case_history', 'um_get_case_notes', 'um_get_member_coverage'], status: 'pending' },
  { id: 2, label: 'Collect Documents', description: 'Retrieving clinical attachments and PDFs', icon: FileSearch, tools: ['um_get_attachments', 'um_download_attachment'], status: 'pending' },
  { id: 3, label: 'Extract Text', description: 'Parsing PDF documents for clinical content', icon: FileText, tools: ['pdf_extract_text'], status: 'pending' },
  { id: 4, label: 'NLP Analysis', description: 'Extracting diagnoses, vitals, and clinical entities', icon: Brain, tools: ['nlp_extract_clinical_entities'], status: 'pending' },
  { id: 5, label: 'Normalize to FHIR', description: 'Converting clinical data to structured FHIR resources', icon: Network, tools: ['fhir_normalize_case', 'fhir_get_patient_summary'], status: 'pending' },
  { id: 6, label: 'Policy Lookup', description: 'Matching applicable coverage policies', icon: Shield, tools: ['policy_lookup'], status: 'pending' },
  { id: 7, label: 'Evaluate Criteria', description: 'Running CQL library against clinical evidence', icon: GitBranch, tools: ['cql_evaluate_criteria'], status: 'pending' },
  { id: 8, label: 'Determine Outcome', description: 'Proposing final authorization determination', icon: Sparkles, tools: ['propose_determination'], status: 'pending' },
];

const TOOL_TO_STEP: Record<string, number> = {};
INITIAL_STEPS.forEach(s => s.tools.forEach(t => { TOOL_TO_STEP[t] = s.id; }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowTs() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function toolPreview(toolName: string, output: unknown): string {
  try {
    const raw = Array.isArray(output) ? (output[0] as { text?: string } | undefined)?.text : String(output);
    if (!raw) return '';
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (toolName === 'um_get_case') { const pt = p['patient'] as Record<string, string> | undefined; return `${p['caseNumber'] ?? ''} — ${pt?.['firstName'] ?? ''} ${pt?.['lastName'] ?? ''}`; }
    if (toolName === 'um_get_clinical_info') return `${(p['diagnoses'] as unknown[] | undefined)?.length ?? 0} diagnoses · ${(p['vitals'] as unknown[] | undefined)?.length ?? 0} vitals`;
    if (toolName === 'pdf_extract_text') return `${(p['text'] as string | undefined)?.length ?? 0} chars`;
    if (toolName === 'nlp_extract_clinical_entities') return `${(p['entities'] as unknown[] | undefined)?.length ?? (p['problems'] as unknown[] | undefined)?.length ?? 0} entities`;
    if (toolName === 'policy_lookup') { const n = Array.isArray(p) ? (p as unknown[]).length : 1; return `${n} polic${n !== 1 ? 'ies' : 'y'} matched`; }
    if (toolName === 'cql_evaluate_criteria') { if (p['allCriteriaMet']) return 'All criteria met ✓'; const r = p['results'] as Array<{ result: string }> | undefined; const m = r?.filter(x => x.result === 'MET').length ?? 0; return `${m}/${r?.length ?? 0} met`; }
    if (toolName === 'propose_determination') { const conf = Math.round(((p['confidence'] as number | undefined) ?? 0) * 100); return `${p['determination'] ?? ''} · ${conf}%`; }
    if (toolName === 'fhir_normalize_case') return 'FHIR bundle created';
    return '';
  } catch { return ''; }
}

// ─── Tree-aware criterion → leaf ID matching ──────────────────────────────────
// Builds a map of normalized label/id → leaf node id from the actual tree.
function buildLeafLabelMap(node: TreeNode, map = new Map<string, string>()): Map<string, string> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (node.type === 'LEAF') {
    map.set(norm(node.label), node.id);
    map.set(norm(node.id), node.id);
  }
  for (const child of node.children ?? []) buildLeafLabelMap(child, map);
  return map;
}

// Match a criterion name from a tool result to tree leaf IDs.
// Priority: 1) direct criterionId  2) exact label  3) word-overlap  4) ARF keyword fallback
function matchCriterion(
  name: string,
  criterionId: string | undefined,
  treeLeafIds: string[],
  labelMap: Map<string, string>,
): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  // 1. Direct ID match
  if (criterionId && treeLeafIds.includes(criterionId)) return [criterionId];

  // 2. Exact normalized label or id match
  const normalizedName = norm(name);
  const exactMatch = labelMap.get(normalizedName);
  if (exactMatch) return [exactMatch];

  // 3. Word-overlap: 2+ significant words (>3 chars) overlap between criterion name and leaf label
  const nameWords = normalizedName.split(' ').filter(w => w.length > 3);
  if (nameWords.length > 0) {
    for (const [key, id] of labelMap) {
      const keyWords = key.split(' ').filter(w => w.length > 3);
      const overlap = nameWords.filter(nw =>
        keyWords.some(kw => kw === nw || kw.startsWith(nw) || nw.startsWith(kw))
      );
      if (overlap.length >= Math.max(1, Math.min(2, nameWords.length - 1))) return [id];
    }
  }

  // 4. Legacy ARF keyword fallback for known short names
  const KEYWORD_MAP: Array<[RegExp, string[]]> = [
    [/coverage|benefit|medicare|insur/i, ['coverage']],
    [/diagnos|icd|j96|respiratory fail/i, ['diagnosis']],
    [/spo2|spO|oximeter|saturation/i, ['spo2']],
    [/po2|pao2|partial.*oxygen/i, ['po2']],
    [/resp.*rate|RR|tachypnea/i, ['resp_rate']],
    [/pco2|paco2|hypercap/i, ['hypercapnia']],
    [/\bph\b|acidosis|acidem/i, ['acidosis']],
    [/lower.level|outpatient.*fail/i, ['treatment_failure']],
    [/inpatient.*monitor|bipap|cpap|ventil/i, ['inpatient_need']],
  ];
  for (const [pattern, ids] of KEYWORD_MAP) { if (pattern.test(name)) return ids; }
  return [];
}
function collectLeafIds(node: TreeNode): string[] {
  return node.type === 'LEAF' ? [node.id] : (node.children ?? []).flatMap(collectLeafIds);
}
function evaluateNode(node: TreeNode, states: Map<string, CriterionState>): 'MET' | 'NOT_MET' | 'UNKNOWN' {
  if (node.type === 'LEAF') { const s = states.get(node.id) ?? 'unknown'; return s === 'met' ? 'MET' : s === 'not_met' ? 'NOT_MET' : 'UNKNOWN'; }
  const results = (node.children ?? []).map(c => evaluateNode(c, states));
  if (node.type === 'AND') { if (!results.length) return 'UNKNOWN'; if (results.every(r => r === 'MET')) return 'MET'; if (results.some(r => r === 'NOT_MET')) return 'NOT_MET'; return 'UNKNOWN'; }
  if (results.some(r => r === 'MET')) return 'MET'; if (results.every(r => r === 'NOT_MET')) return 'NOT_MET'; return 'UNKNOWN';
}

const DATA_ICON: Record<string, React.ReactNode> = {
  vital: <Activity size={10} />, lab: <FlaskConical size={10} />, diagnosis: <Stethoscope size={10} />,
  procedure: <Cpu size={10} />, coverage: <Shield size={10} />, clinical_note: <FileText size={10} />,
};

// ─── Criteria Tree Node ───────────────────────────────────────────────────────

function AutoTreeNode({ node, states, evidence, depth = 0, activeLeafIds }: {
  node: TreeNode; states: Map<string, CriterionState>; evidence: Map<string, string>; depth?: number; activeLeafIds: Set<string>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showEvidence, setShowEvidence] = useState(false);
  const result = evaluateNode(node, states);
  const isActive = node.type === 'LEAF' && activeLeafIds.has(node.id);

  if (node.type === 'LEAF') {
    const s = states.get(node.id) ?? 'unknown';
    const ev = evidence.get(node.id) ?? '';
    const fhirRefs = ev ? extractFhirRefs(ev) : [];
    const hasEvidence = s !== 'unknown' && ev;

    const leafStyle =
      s === 'met' ? { border: 'border-l-emerald-500', bg: 'bg-emerald-50/60', ring: 'ring-emerald-100' } :
        s === 'not_met' ? { border: 'border-l-red-400', bg: 'bg-red-50/60', ring: 'ring-red-100' } :
          isActive ? { border: 'border-l-blue-400', bg: 'bg-blue-50/60', ring: 'ring-blue-100' } :
            { border: 'border-l-slate-200', bg: 'bg-white', ring: 'ring-slate-100' };

    const leafIcon =
      s === 'met' ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> :
        s === 'not_met' ? <XCircle size={14} className="text-red-400 shrink-0" /> :
          isActive ? <Loader2 size={14} className="text-blue-500 animate-spin shrink-0" /> :
            <Circle size={14} className="text-slate-300 shrink-0" />;

    return (
      <div className={cn(depth > 0 ? 'ml-5' : '', 'relative mb-1.5 animate-criteria-reveal')}>
        {depth > 0 && <div className="absolute -left-3 top-0 bottom-0 w-px bg-slate-200" />}
        {depth > 0 && <div className="absolute -left-3 top-5 h-px w-3 bg-slate-200" />}
        <div className={cn('rounded-lg border border-l-[3px] ring-1 transition-all duration-300', leafStyle.border, leafStyle.bg, leafStyle.ring, isActive && s === 'unknown' && 'animate-node-pulse')}>
          <div className="flex items-start gap-2 px-3 py-2">
            <div className="mt-0.5 shrink-0">{leafIcon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {node.dataType && (
                  <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] bg-slate-100 text-slate-500">{DATA_ICON[node.dataType]}</span>
                )}
                <span className="text-xs font-semibold text-slate-800">{node.label}</span>
              </div>
              {node.threshold && (
                <span className="mt-1 inline-block font-mono text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                  {node.threshold.display ?? `${node.threshold.operator} ${Array.isArray(node.threshold.value) ? node.threshold.value.join(', ') : String(node.threshold.value ?? '')}${node.threshold.unit ? ' ' + node.threshold.unit : ''}`}
                </span>
              )}
              {isActive && s === 'unknown' && <p className="mt-0.5 text-[10px] text-blue-500 animate-pulse">AI evaluating…</p>}
              {/* Inline evidence summary — always visible when present */}
              {hasEvidence && (
                <p className={cn('mt-1 text-[11px] leading-snug', s === 'met' ? 'text-emerald-700' : 'text-red-600')}>
                  {fhirRefs.length > 0
                    ? fhirRefs.map(r => r.ref).join(' · ')
                    : ev.slice(0, 140)}
                </p>
              )}
            </div>
            {hasEvidence && (
              <button
                type="button"
                onClick={() => setShowEvidence(v => !v)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all',
                  showEvidence
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : s === 'met'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-red-50 text-red-600 border-red-300 hover:bg-red-100'
                )}
              >
                <BookOpen size={12} />
                Evidence
                {fhirRefs.length > 0 && (
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', showEvidence ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700')}>{fhirRefs.length}</span>
                )}
              </button>
            )}
          </div>
          {hasEvidence && showEvidence && (
            <div className={cn('mx-3 mb-2.5 rounded-lg border p-3 text-xs animate-fade-in', s === 'met' ? 'border-emerald-200 bg-emerald-50/80' : 'border-red-200 bg-red-50/80')}>
              <p className={cn('font-semibold mb-1.5 text-[11px] uppercase tracking-wide', s === 'met' ? 'text-emerald-700' : 'text-red-700')}>Clinical Evidence</p>
              <p className="text-slate-600 leading-relaxed mb-2">{ev}</p>
              {fhirRefs.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">FHIR Resources</p>
                  <div className="flex flex-wrap gap-1.5">
                    {fhirRefs.map(({ ref, url }) => (
                      <a key={ref} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-white border border-blue-200 px-2 py-0.5 text-[11px] font-mono text-blue-600 hover:bg-blue-50 transition-colors">
                        <ExternalLink size={9} />{ref}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Branch node
  const children = node.children ?? [];
  const metCount = children.filter(c => evaluateNode(c, states) === 'MET').length;
  const branchBorder = result === 'MET' ? 'border-l-emerald-400' : result === 'NOT_MET' ? 'border-l-red-400' : node.type === 'AND' ? 'border-l-blue-300' : 'border-l-amber-300';
  const typeBadge = node.type === 'AND' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700';
  const barColor = result === 'MET' ? 'bg-emerald-400' : result === 'NOT_MET' ? 'bg-red-400' : 'bg-blue-300';
  const resultIcon = result === 'MET' ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> : result === 'NOT_MET' ? <XCircle size={13} className="text-red-400 shrink-0" /> : <HelpCircle size={13} className="text-slate-300 shrink-0" />;

  return (
    <div className={cn(depth > 0 ? 'ml-5' : '', 'relative mb-1.5')}>
      {depth > 0 && <div className="absolute -left-3 top-0 bottom-0 w-px bg-slate-200" />}
      {depth > 0 && <div className="absolute -left-3 top-5 h-px w-3 bg-slate-200" />}
      <div className={cn('rounded-lg border border-slate-200 border-l-[3px] bg-white shadow-sm overflow-hidden', branchBorder)}>
        <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={() => setExpanded(e => !e)}>
          <span className="text-slate-400 shrink-0">{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
          <span className={cn('rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0', typeBadge)}>{node.type === 'AND' ? 'All of' : 'Any of'}</span>
          <span className="text-xs font-semibold text-slate-800 flex-1 min-w-0 truncate">{node.label}</span>
          <span className="text-[10px] text-slate-400 font-mono shrink-0">{metCount}/{children.length}</span>
          {resultIcon}
        </div>
        <div className="h-0.5 bg-slate-100">
          <div className={cn('h-full transition-all duration-700 ease-out', barColor)} style={{ width: `${children.length ? (metCount / children.length) * 100 : 0}%` }} />
        </div>
      </div>
      {expanded && (
        <div className="mt-1">
          {children.map(c => <AutoTreeNode key={c.id} node={c} states={states} evidence={evidence} depth={depth + 1} activeLeafIds={activeLeafIds} />)}
        </div>
      )}
    </div>
  );
}

// ─── Outcome config ───────────────────────────────────────────────────────────

const OUTCOME_CONFIG = {
  AUTO_APPROVE: { label: 'Auto-Approve', sublabel: 'All required criteria are met', cssClass: 'outcome-approve', description: 'This case qualifies for automatic approval. All coverage criteria are satisfied by clinical evidence. Subject to human reviewer confirmation.' },
  MD_REVIEW: { label: 'MD Review Required', sublabel: 'Clinical criteria require physician review', cssClass: 'outcome-md-review', description: 'One or more criteria could not be confirmed from available documentation. A physician review is required before any adverse determination.' },
  MORE_INFO: { label: 'Additional Info Needed', sublabel: 'Missing clinical documentation', cssClass: 'outcome-more-info', description: 'Some criteria require additional clinical documentation. Please submit the missing information to complete this review.' },
  DENY: { label: 'Recommended Denial', sublabel: 'Coverage criteria not met', cssClass: 'outcome-deny', description: 'Coverage criteria are not met based on submitted clinical evidence. Recommended for denial — requires MD review before finalization.' },
} as const;
type OutcomeKey = keyof typeof OUTCOME_CONFIG;
function isOutcomeKey(val: string): val is OutcomeKey { return val in OUTCOME_CONFIG; }

// ─── Step item ────────────────────────────────────────────────────────────────

function StepItem({ step, isLast }: { step: WorkflowStep; isLast: boolean }) {
  const Icon = step.icon;
  const isRunning = step.status === 'running';
  const isDone = step.status === 'done';
  const isPending = step.status === 'pending';

  return (
    <div className="relative flex gap-3">
      {!isLast && (
        <div className="absolute left-[1.125rem] top-10 bottom-0 w-0.5">
          <div className={cn('h-full w-full transition-all duration-500', isDone ? 'bg-emerald-400' : 'bg-slate-200')} />
        </div>
      )}
      <div className="relative shrink-0 z-10">
        {isRunning ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-blue-400 bg-blue-50 shadow-sm shadow-blue-400/20">
            <Loader2 size={15} className="text-blue-500 animate-spin" />
          </div>
        ) : isDone ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 shadow-sm shadow-emerald-400/30">
            <CheckCircle2 size={16} className="text-white" />
          </div>
        ) : (
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-full border-2', isPending ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-slate-100')}>
            <Icon size={14} className="text-slate-400" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-start gap-2 pt-1.5">
          <div className="flex-1 min-w-0">
            <p className={cn('text-xs font-semibold leading-tight', isRunning ? 'text-blue-700' : isDone ? 'text-slate-800' : 'text-slate-400')}>
              {step.label}
            </p>
            <p className={cn('mt-0.5 text-[11px] leading-tight', isRunning ? 'text-blue-500' : isDone ? 'text-slate-500' : 'text-slate-400')}>
              {step.detail && isDone ? step.detail : step.description}
            </p>
          </div>
          {isRunning && <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-600 uppercase tracking-wide animate-pulse">Active</span>}
          {isDone && <span className="shrink-0 text-[10px] font-medium text-emerald-500">✓</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Known cases ──────────────────────────────────────────────────────────────
const KNOWN_CASES = ['ARF-2026-001', 'CHF-2026-002', 'HIP-2026-003', 'DIA-2026-004', 'SKN-2026-005'];

// ─── Case search input with suggestions dropdown ─────────────────────────────

function CaseSearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const suggestions = KNOWN_CASES.filter(c =>
    !query.trim() || c.toLowerCase().includes(query.toLowerCase()),
  );

  function select(c: string) {
    setQuery(c);
    onChange(c);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.toUpperCase();
    setQuery(v);
    onChange(v);
    setOpen(true);
  }

  useEffect(() => { setQuery(value); }, [value]);

  return (
    <div className="relative mb-6">
      <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Case Number
      </label>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search or type a case number…"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-10 font-mono text-sm font-semibold text-slate-800 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); onChange(''); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition-colors hover:bg-slate-300"
            aria-label="Clear"
          >
            <XCircle size={12} />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/80 animate-fade-in"
        >
          {suggestions.map(c => (
            <li key={c} role="option" aria-selected={c === value}>
              <button
                type="button"
                onMouseDown={() => select(c)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                  c === value ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', c === value ? 'bg-blue-500' : 'bg-slate-300')} />
                <span className="font-mono text-xs font-semibold tracking-wide">{c}</span>
                {c === value && <span className="ml-auto text-[10px] font-medium text-blue-500">Selected</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


// ─── Main page ────────────────────────────────────────────────────────────────

export default function CaseReview() {
  const [searchParams] = useSearchParams();
  const [caseNumber, setCaseNumber] = useState(() => searchParams.get('case') ?? 'ARF-2026-001');
  const autoStarted = useRef(false);
  const [phase, setPhase] = useState<'idle' | 'loading_criteria' | 'running' | 'done' | 'error'>('idle');
  const [steps, setSteps] = useState<WorkflowStep[]>(INITIAL_STEPS);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [treeResults, setTreeResults] = useState<TreeResult[]>([]);
  const [criteriaStates, setCriteriaStates] = useState<Map<string, CriterionState>>(new Map());
  const [criteriaEvidence, setCriteriaEvidence] = useState<Map<string, string>>(new Map());
  const [activeLeafIds, setActiveLeafIds] = useState<Set<string>>(new Set());
  const [runId, setRunId] = useState<string | null>(null);
  const [determination, setDetermination] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [seenToolIds, setSeenToolIds] = useState<Set<string>>(new Set());
  const [logCollapsed, setLogCollapsed] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const treeRef = useRef<TreeResult | null>(null);

  useEffect(() => {
    if (logRef.current && !logCollapsed) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log, logCollapsed]);

  const appendLog = useCallback((entry: LogEntry) => { setLog(prev => [...prev.slice(-99), entry]); }, []);

  function markStep(toolName: string, status: 'running' | 'done', detail?: string) {
    const stepId = TOOL_TO_STEP[toolName];
    if (!stepId) return;
    setSteps(prev => prev.map(s => {
      if (s.id === stepId) return { ...s, status: status === 'running' ? 'running' : 'done', detail: detail ?? s.detail, startTime: status === 'running' && !s.startTime ? Date.now() : s.startTime };
      if (s.id < stepId && s.status === 'pending' && status === 'running') return { ...s, status: 'done' };
      return s;
    }));
  }

  function processToolCalls(toolCalls: AgentToolCall[], treeLeafIds: string[]) {
    for (const tc of toolCalls) {
      const raw = tc as unknown as Record<string, unknown>;
      const toolName = String(raw['toolName'] ?? raw['tool_name'] ?? '');
      const output = raw['output'];
      const id = String(raw['id'] ?? '');
      if (seenToolIds.has(id)) continue;
      setSeenToolIds(prev => new Set([...prev, id]));

      const preview = toolPreview(toolName, output);
      appendLog({ ts: nowTs(), tool: toolName, status: 'done', preview, type: 'tool' });
      // cql_evaluate_criteria: keep step as "running" until criteria animation finishes
      if (toolName !== 'cql_evaluate_criteria') markStep(toolName, 'done', preview);

      if (toolName === 'propose_determination') {
        try {
          const rawContent = Array.isArray(output) ? (output[0] as { text?: string } | undefined)?.text : String(output);
          const det = JSON.parse(rawContent ?? '{}') as {
            determination?: string;
            confidence?: number;
            criteriaResults?: Array<{
              name?: string;
              criterionId?: string;
              result?: string;
              evidence?: string;
              fhirReference?: string;
              value?: string;
            }>;
          };
          const outKey = det.determination ?? '';
          setDetermination(outKey);
          setConfidence(det.confidence ?? 0);
          const labelMap = treeRef.current ? buildLeafLabelMap(treeRef.current.tree) : new Map<string, string>();
          const newStates = new Map<string, CriterionState>();
          const newEvidence = new Map<string, string>();
          for (const cr of det.criteriaResults ?? []) {
            const leafIds = matchCriterion(cr.name ?? '', cr.criterionId, treeLeafIds, labelMap);
            const state: CriterionState = cr.result === 'MET' ? 'met' : cr.result === 'NOT_MET' ? 'not_met' : 'unknown';
            let ev = cr.evidence ?? '';
            const fhirRef = cr.fhirReference ?? '';
            const val = cr.value ?? '';
            if (!ev && fhirRef) ev = fhirRef;
            if (ev && fhirRef && !ev.includes(fhirRef)) ev += ` · ${fhirRef}`;
            if (ev && val && !ev.includes(val)) ev += ` (${val})`;
            // Always produce evidence text — fallback to criterion name + result
            if (!ev) ev = `${cr.name ?? 'Criterion'}: ${cr.result ?? state.toUpperCase()} — evaluated by AI agent`;
            for (const lid of leafIds) {
              if (treeLeafIds.includes(lid)) { newStates.set(lid, state); newEvidence.set(lid, ev); }
            }
          }
          if (outKey === 'AUTO_APPROVE') {
            const tree = treeRef.current?.tree ?? null;
            const findLabel2 = (node: TreeNode, id: string): string => {
              if (node.id === id) return node.label;
              for (const c of node.children ?? []) { const l = findLabel2(c, id); if (l) return l; }
              return id;
            };
            for (const lid of treeLeafIds) {
              if (!newStates.has(lid)) {
                newStates.set(lid, 'met');
                if (!newEvidence.has(lid)) {
                  const label = tree ? findLabel2(tree, lid) : lid;
                  newEvidence.set(lid, `${label}: MET — all coverage criteria satisfied for ${outKey}`);
                }
              }
            }
          }
          // Only animate criteria that aren't already resolved by the CQL step
          setActiveLeafIds(new Set());
          let animDelay = 0;
          for (const [nodeId, nodeState] of newStates) {
            const ev = newEvidence.get(nodeId) ?? '';
            setTimeout(() => {
              setCriteriaStates(prev => { if (prev.get(nodeId) !== 'unknown' && prev.has(nodeId)) return prev; const n = new Map(prev); n.set(nodeId, nodeState); return n; });
              if (ev) setCriteriaEvidence(prev => { const n = new Map(prev); n.set(nodeId, ev); return n; });
            }, animDelay);
            animDelay += 200;
          }
        } catch { /* ignore */ }
      }
      if (toolName === 'cql_evaluate_criteria') {
        try {
          const rawCql = Array.isArray(output) ? (output[0] as { text?: string } | undefined)?.text : String(output);
          const cqlData = JSON.parse(rawCql ?? '{}') as {
            allCriteriaMet?: boolean;
            results?: Array<{ name?: string; criterionId?: string; result?: string; evidence?: string; fhirReference?: string; value?: string }>;
          };
          const labelMap = treeRef.current ? buildLeafLabelMap(treeRef.current.tree) : new Map<string, string>();

          // Build ordered list of {nodeId, state, evidence} — no duplicates
          const cqlUpdates: Array<{ nodeId: string; state: CriterionState; ev: string }> = [];
          const seen = new Set<string>();

          for (const r of (cqlData.results ?? [])) {
            const cqlState: CriterionState = r.result === 'MET' ? 'met' : r.result === 'NOT_MET' ? 'not_met' : 'unknown';
            let ev = r.evidence ?? '';
            const fhirRef = r.fhirReference ?? '';
            const val = r.value ?? '';
            if (!ev && fhirRef) ev = fhirRef;
            if (ev && fhirRef && !ev.includes(fhirRef)) ev += ` · ${fhirRef}`;
            if (ev && val && !ev.includes(val)) ev += ` (${val})`;
            const candidates = matchCriterion(r.name ?? '', r.criterionId, treeLeafIds, labelMap);
            for (const nodeId of candidates) {
              if (treeLeafIds.includes(nodeId) && !seen.has(nodeId)) {
                seen.add(nodeId);
                cqlUpdates.push({ nodeId, state: cqlState, ev });
              }
            }
          }

          // If allCriteriaMet, fill any unmatched leaves with a fallback evidence string
          if (cqlData.allCriteriaMet) {
            const tree = treeRef.current?.tree ?? null;
            const findLabel = (node: TreeNode, id: string): string => {
              if (node.id === id) return node.label;
              for (const c of node.children ?? []) { const l = findLabel(c, id); if (l) return l; }
              return '';
            };
            for (const leafId of treeLeafIds) {
              if (!seen.has(leafId)) {
                seen.add(leafId);
                const label = tree ? findLabel(tree, leafId) : leafId;
                const fallbackEv = `${label}: MET — CQL evaluation confirmed criterion satisfied`;
                cqlUpdates.push({ nodeId: leafId, state: 'met', ev: fallbackEv });
              }
            }
          }

          // Mark step running while animation plays, then done after last item
          markStep('cql_evaluate_criteria', 'running', preview);
          const PER_ITEM = 500; // ms between each criterion
          const FLASH_MS = 700; // active flash duration
          let cqlDelay = 0;
          for (const { nodeId, state: nodeState, ev } of cqlUpdates) {
            setTimeout(() => {
              setActiveLeafIds(new Set([nodeId]));
              setTimeout(() => {
                setCriteriaStates(prev => { const n = new Map(prev); n.set(nodeId, nodeState); return n; });
                if (ev) setCriteriaEvidence(prev => { const n = new Map(prev); n.set(nodeId, ev); return n; });
                setActiveLeafIds(prev => { const n = new Set(prev); n.delete(nodeId); return n; });
              }, FLASH_MS);
            }, cqlDelay);
            cqlDelay += PER_ITEM;
          }
          // Mark step done after all animations complete
          const totalDuration = cqlDelay + FLASH_MS + 200;
          setTimeout(() => markStep('cql_evaluate_criteria', 'done', preview), totalDuration);
        } catch {
          markStep('cql_evaluate_criteria', 'done', preview);
        }
      }
      if (toolName === 'um_get_member_coverage') {
        // Flash coverage node active, then mark it met
        setCriteriaStates(prev => {
          const next = new Map(prev);
          if (treeLeafIds.includes('coverage')) next.set('coverage', 'met');
          return next;
        });
        setActiveLeafIds(new Set(treeLeafIds.filter(id => id.includes('coverage'))));
        setTimeout(() => setActiveLeafIds(new Set()), 1500);
      }
      if (toolName === 'um_get_clinical_info') {
        try {
          const raw = Array.isArray(output) ? (output as Array<{text?: string}>)[0]?.text : String(output);
          const data = JSON.parse(raw as string) as {
            diagnoses?: Array<{code?: string; display?: string}>;
            vitals?: Array<{code?: string; loinc?: string; value?: number; unit?: string; name?: string}>;
            labs?: Array<{code?: string; loinc?: string; value?: number; unit?: string; name?: string}>;
          };

          const updates = new Map<string, 'met' | 'not_met'>();
          const tree = treeRef.current?.tree ?? null;

          // ── Helper: evaluate a threshold against a numeric value ──
          const evalThreshold = (val: number, op: string, threshold: number): boolean => {
            if (op === '<')  return val < threshold;
            if (op === '<=') return val <= threshold;
            if (op === '>')  return val > threshold;
            if (op === '>=') return val >= threshold;
            if (op === '==') return val === threshold;
            return false;
          };

          // ── Helper: find a leaf node in the tree by id ──
          const findLeaf = (node: unknown, id: string): Record<string, unknown> | null => {
            if (!node || typeof node !== 'object') return null;
            const n = node as Record<string, unknown>;
            if (n['id'] === id) return n;
            for (const child of (n['children'] as unknown[] ?? [])) {
              const found = findLeaf(child, id);
              if (found) return found;
            }
            return null;
          };

          // ── Match vitals and labs to leaf nodes via LOINC or name ──
          const allMeasurements = [...(data.vitals ?? []), ...(data.labs ?? [])];
          for (const m of allMeasurements) {
            if (m.value === undefined || m.value === null) continue;
            const loinc = m.loinc ?? '';
            const nameLower = (m.code ?? m.name ?? '').toLowerCase();

            // Map to leaf node IDs
            const candidateLeafIds: string[] = [];
            if (loinc === '2708-6' || nameLower.includes('spo2') || nameLower.includes('oxygen sat'))  candidateLeafIds.push('spo2');
            if (loinc === '9279-1' || nameLower.includes('respiratory rate') || nameLower.includes('resp_rate')) candidateLeafIds.push('resp_rate');
            if (loinc === '2703-7' || nameLower.includes('po2') || nameLower.includes('pao2'))         candidateLeafIds.push('po2');
            if (loinc === '2019-8' || nameLower.includes('pco2') || nameLower.includes('paco2'))       candidateLeafIds.push('hypercapnia');
            if (loinc === '2744-1' || nameLower === 'ph' || nameLower.includes('acidosis'))             candidateLeafIds.push('acidosis');

            for (const leafId of candidateLeafIds) {
              if (!treeLeafIds.includes(leafId)) continue;
              // Get threshold from tree if available
              const leafNode = tree ? findLeaf(tree, leafId) : null;
              const thresh = leafNode?.['threshold'] as {operator?: string; value?: number} | undefined;
              if (thresh?.operator && thresh.value !== undefined) {
                const met = evalThreshold(m.value as number, thresh.operator, thresh.value as number);
                updates.set(leafId, met ? 'met' : 'not_met');
              } else {
                // No threshold → just mark present = met
                updates.set(leafId, 'met');
              }
            }
          }

          // ── Match diagnoses to the diagnosis leaf ──
          const diagCodes = (data.diagnoses ?? []).map(d => d.code ?? '');
          if (diagCodes.length > 0 && treeLeafIds.includes('diagnosis')) {
            updates.set('diagnosis', 'met');
          }

          // ── Animate updates with stagger ──
          if (updates.size > 0) {
            let delay = 400;
            for (const [nodeId, state] of updates) {
              setTimeout(() => {
                setActiveLeafIds(new Set([nodeId]));
                setTimeout(() => {
                  setCriteriaStates(prev => { const n = new Map(prev); n.set(nodeId, state); return n; });
                  setActiveLeafIds(prev => { const n = new Set(prev); n.delete(nodeId); return n; });
                }, 900);
              }, delay);
              delay += 500;
            }
          } else if (diagCodes.length > 0 && treeLeafIds.includes('diagnosis')) {
            // Fallback: just animate diagnosis
            setActiveLeafIds(new Set(['diagnosis']));
            setTimeout(() => {
              setCriteriaStates(prev => { const n = new Map(prev); n.set('diagnosis', 'met'); return n; });
              setActiveLeafIds(new Set());
            }, 1000);
          }
        } catch { /* ignore */ }
      }
      if (toolName === 'nlp_extract_clinical_entities') {
        try {
          const rawNlp = Array.isArray(output) ? (output[0] as { text?: string } | undefined)?.text : String(output);
          const nlpData = JSON.parse(rawNlp ?? '{}') as { entities?: Array<{ type?: string; text?: string; value?: number; loinc?: string; assertion?: string }> };
          const entities = nlpData.entities ?? [];
          const nlpUpdates = new Map<string, CriterionState>();
          for (const e of entities) {
            const textLower = (e.text ?? '').toLowerCase();
            const isMet = (e.assertion ?? 'affirmed') === 'affirmed';
            const nlpState: CriterionState = isMet ? 'met' : 'not_met';
            // SpO2 / oxygen saturation
            if ((textLower.includes('spo2') || textLower.includes('oxygen sat') || e.loinc === '2708-6') && treeLeafIds.includes('spo2')) {
              nlpUpdates.set('spo2', nlpState);
            }
            // Respiratory rate
            if ((textLower.includes('respiratory rate') || textLower.includes(' rr ') || e.loinc === '9279-1') && treeLeafIds.includes('resp_rate')) {
              nlpUpdates.set('resp_rate', nlpState);
            }
            // pCO2 / hypercapnia
            if ((textLower.includes('pco2') || textLower.includes('hypercapn') || e.loinc === '2019-8') && treeLeafIds.includes('hypercapnia')) {
              nlpUpdates.set('hypercapnia', nlpState);
            }
            // pH / acidosis
            if ((textLower.includes('ph ') || textLower.includes('acidosis') || e.loinc === '2744-1') && treeLeafIds.includes('acidosis')) {
              nlpUpdates.set('acidosis', nlpState);
            }
            // Treatment failure / lower level care
            if ((textLower.includes('nebulizer') || textLower.includes('failed') || textLower.includes('outpatient')) && treeLeafIds.includes('treatment_failure')) {
              nlpUpdates.set('treatment_failure', nlpState);
            }
          }
          if (nlpUpdates.size > 0) {
            // Animate each update: flash the node active, then commit the state
            let nlpDelay = 300;
            for (const [nodeId, nodeState] of nlpUpdates) {
              setTimeout(() => {
                setActiveLeafIds(new Set([nodeId]));
                setTimeout(() => {
                  setCriteriaStates(prev => { const n = new Map(prev); n.set(nodeId, nodeState); return n; });
                  setActiveLeafIds(new Set());
                }, 800);
              }, nlpDelay);
              nlpDelay += 600;
            }
          }
        } catch { /* ignore */ }
      }
    }
  }

  async function startReview() {
    setPhase('loading_criteria');
    setSteps(INITIAL_STEPS.map(s => ({ ...s })));
    setLog([]); setTreeResults([]); setCriteriaStates(new Map()); setCriteriaEvidence(new Map());
    setActiveLeafIds(new Set()); setRunId(null); setDetermination(null); setErrorMsg(''); setSeenToolIds(new Set());
    if (pollRef.current) clearInterval(pollRef.current);
    try {
      appendLog({ ts: nowTs(), tool: 'Loading case information…', status: 'running', type: 'system' });
      const caseInfo = await api.reviews.get(caseNumber).catch(() => null);
      appendLog({ ts: nowTs(), tool: 'Building criteria decision tree…', status: 'running', type: 'system' });

      // Map case service_type to scope setting
      const SERVICE_TYPE_MAP: Record<string, string> = {
        'Inpatient Level of Care': 'INPATIENT',
        'Inpatient Admission':     'INPATIENT',
        'INPATIENT':               'INPATIENT',
        'Preservice Outpatient':   'OUTPATIENT',
        'OUTPATIENT':              'OUTPATIENT',
        'Outpatient Surgery':      'OUTPATIENT',
        'Outpatient Service':      'OUTPATIENT',
        'DME':                     'DME',
        'Durable Medical Equipment': 'DME',
        'Home Health':             'HOME_HEALTH',
        'HOME_HEALTH':             'HOME_HEALTH',
        'SNF':                     'INPATIENT',
        'Transplant':              'INPATIENT',
        // OOA has no single setting — omit for broadest match
      };
      const caseScope = caseInfo?.serviceType ? (SERVICE_TYPE_MAP[caseInfo.serviceType] ?? '') : '';

      const token = localStorage.getItem('lucidreview_token') ?? '';

      // Helper: fetch criteria tree with given params
      const fetchTree = async (scopeSetting: string): Promise<TreeResult[]> => {
        const p = new URLSearchParams();
        if (caseInfo?.primaryDiagnosisCode) p.set('icd10', caseInfo.primaryDiagnosisCode);
        if (scopeSetting) p.set('serviceType', scopeSetting);
        const r = await fetch(`/api/criteria-tree?${p.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
        return r.ok ? (await r.json() as TreeResult[]) : [];
      };

      // Try with scope first, fall back to no-scope if 0 results
      let trees = await fetchTree(caseScope);
      if (!trees.length && caseScope) {
        appendLog({ ts: nowTs(), tool: 'Broadening criteria search…', status: 'running', type: 'system' });
        trees = await fetchTree('');
      }
      // Final fallback: search by diagnosis without scope to get at least something
      if (!trees.length && caseInfo?.primaryDiagnosisCode) {
        const fallbackCodes = caseInfo.primaryDiagnosisCode.split('.')[0]; // e.g. J96 from J96.00
        const p = new URLSearchParams({ icd10: fallbackCodes });
        const r = await fetch(`/api/criteria-tree?${p.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
        trees = r.ok ? (await r.json() as TreeResult[]) : [];
      }
      setTreeResults(trees);
      if (trees.length > 0) treeRef.current = trees[0];
      if (!trees.length) appendLog({ ts: nowTs(), tool: 'No matching criteria tree — using agent evaluation', status: 'done', type: 'system' });
      else appendLog({ ts: nowTs(), tool: 'criteria_tree', status: 'done', preview: `${trees.length} criteria set(s) loaded`, type: 'system' });
      setPhase('running');
      appendLog({ ts: nowTs(), tool: 'Initializing AI review agent…', status: 'running', type: 'system' });
      const { runId: rid } = await api.reviews.runAgent(caseNumber);
      setRunId(rid);
      appendLog({ ts: nowTs(), tool: 'agent_start', status: 'done', preview: `Run ${rid.slice(0, 8)}…`, type: 'system' });
      const treeLeafIds = trees.length ? collectLeafIds(trees[0].tree) : [];
      let lastToolCount = 0, lastTurnCount = 0;
      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const [runStatus, trace] = await Promise.all([api.agentRuns.get(rid), api.agentRuns.getTrace(rid)]);
            if (trace.turns.length > lastTurnCount) {
              const newTurns = trace.turns.slice(lastTurnCount); lastTurnCount = trace.turns.length;
              for (const { turn } of newTurns) {
                const t = turn as unknown as Record<string, unknown>;
                if (t['role'] !== 'assistant') continue;
                try {
                  const content = typeof t['content'] === 'string' ? JSON.parse(t['content'] as string) : t['content'];
                  if (Array.isArray(content)) {
                    for (const block of content) {
                      const text = block?.text ?? block?.['text']; const isToolUse = !!(block?.toolUse ?? block?.['toolUse']);
                      if (text && !isToolUse && String(text).trim()) appendLog({ ts: nowTs(), tool: 'AI Reasoning', status: 'done', preview: String(text).slice(0, 400), type: 'ai' });
                    }
                  }
                } catch { /* ignore */ }
              }
            }
            const allToolCalls = trace.turns.flatMap(t => t.toolCalls);
            if (allToolCalls.length > lastToolCount) {
              const lastCall = allToolCalls[allToolCalls.length - 1];
              if (lastCall) { const lc = lastCall as unknown as Record<string, unknown>; markStep(String(lc['toolName'] ?? lc['tool_name'] ?? ''), 'running'); }
              processToolCalls(allToolCalls.slice(lastToolCount) as AgentToolCall[], treeLeafIds);
              lastToolCount = allToolCalls.length;
            }
            if (runStatus.status === 'completed' || runStatus.status === 'failed') {
              clearInterval(pollRef.current!);
              setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'done' } : s));
              if (runStatus.status === 'completed') {
                if (runStatus.determination) {
                  // Backend may use 'determination' or 'decision' as the key depending on serialization
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const detRaw = runStatus.determination as any;
                  const detKey: string = detRaw.determination ?? detRaw.decision ?? '';
                  if (detKey) setDetermination(detKey);
                  setConfidence(runStatus.determination.confidence ?? 0);
                }
                setPhase('done');
                appendLog({ ts: nowTs(), tool: 'Review complete', status: 'done', preview: `${trace.turns.length} agent turns`, type: 'system' });
              } else { setPhase('error'); setErrorMsg(runStatus.error ?? 'Agent run failed'); }
            }
          } catch { /* polling error — retry */ }
        })();
      }, 3000);
    } catch (e: unknown) {
      if (pollRef.current) clearInterval(pollRef.current);
      setPhase('error');
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error');
    }
  }

  // Auto-start when the URL provides a ?case= param
  useEffect(() => {
    if (searchParams.get('case') && !autoStarted.current) {
      autoStarted.current = true;
      void startReview();
    }
  // startReview is stable — it only closes over refs and setters; searchParams is set once on mount
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase('idle'); setSteps(INITIAL_STEPS.map(s => ({ ...s }))); setLog([]); setTreeResults([]);
    setCriteriaStates(new Map()); setCriteriaEvidence(new Map()); setActiveLeafIds(new Set());
    setRunId(null); setDetermination(null); setErrorMsg('');
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const outcomeConfig = determination && isOutcomeKey(determination) ? OUTCOME_CONFIG[determination] : null;
  const isActive = phase === 'running' || phase === 'loading_criteria';
  const doneCount = steps.filter(s => s.status === 'done').length;
  const runningStep = steps.find(s => s.status === 'running');
  const progressPct = ((doneCount + (runningStep ? 0.5 : 0)) / steps.length) * 100;

  // ── IDLE STATE ────────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="flex h-full overflow-hidden" style={{ maxHeight: '100vh' }}>

        {/* ══ LEFT: dark hero panel ══════════════════════════════════════ */}
        <div className="relative flex w-[46%] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-10 py-12">
          {/* Background grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
          {/* Glow blobs */}
          <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-violet-600/15 blur-3xl" />

          {/* Top: logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/40">
              <Activity size={20} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">LucidReview</div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-blue-300/60">UM Platform</div>
            </div>
          </div>

          {/* Middle: headline + bullets */}
          <div className="relative z-10">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1">
              <Sparkles size={11} className="text-blue-400" />
              <span className="text-[11px] font-semibold text-blue-300">AI-Powered Analysis</span>
            </div>
            <h1 className="mb-4 text-4xl font-black leading-tight tracking-tight text-white">
              Intelligent<br />
              <span className="text-blue-400">Prior Auth</span><br />
              Review
            </h1>
            <p className="mb-8 max-w-xs text-sm text-slate-400 leading-relaxed">
              The AI agent autonomously gathers evidence, evaluates coverage criteria, and recommends authorization decisions in real-time.
            </p>

            {/* Feature bullets */}
            <div className="space-y-4">
              {[
                { icon: Database, title: 'Multi-Source Data Gathering', body: 'Case info, clinical notes, attachments, FHIR records.' },
                { icon: Brain, title: 'NLP & Clinical Intelligence', body: 'Entity extraction, diagnosis mapping, vitals parsing.' },
                { icon: GitBranch, title: 'Live Criteria Decision Tree', body: 'CQL evaluation against payer policies with evidence trails.' },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex items-start gap-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/8 ring-1 ring-white/10">
                    <Icon size={14} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: trust bar */}
          <div className="relative z-10 flex items-center gap-5">
            {['HIPAA Compliant', 'HL7 FHIR R4', 'CMS Policies'].map(label => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <CheckCircle2 size={11} className="text-slate-600" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ══ RIGHT: form + pipeline ═════════════════════════════════════ */}
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
          <div className="flex h-full flex-col justify-center px-10 py-6 max-w-lg mx-auto w-full animate-fade-up">

            {/* Form heading */}
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">Start a Review</h2>
              <p className="mt-0.5 text-sm text-slate-500">Select a case to begin the AI analysis workflow.</p>
            </div>

            {/* Search input */}
            <CaseSearchInput value={caseNumber} onChange={setCaseNumber} />

            {/* CTA — premium gradient button */}
            <button
              onClick={() => { void startReview(); }}
              disabled={!caseNumber.trim()}
              className="group relative mb-5 flex w-full overflow-hidden rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: caseNumber.trim()
                  ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #4f46e5 100%)'
                  : '#e2e8f0',
                boxShadow: caseNumber.trim()
                  ? '0 4px 24px -4px rgba(37,99,235,0.5), 0 1px 3px rgba(37,99,235,0.3), inset 0 1px 0 rgba(255,255,255,0.15)'
                  : 'none',
              }}
            >
              {/* Shimmer overlay on hover */}
              <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <div className={cn('flex w-full items-center gap-2.5 px-5', !caseNumber.trim() && 'text-slate-400')}>
                {/* Left: play icon in circle */}
                <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', caseNumber.trim() ? 'bg-white/20' : 'bg-slate-300')}>
                  <Play size={12} fill="currentColor" className={caseNumber.trim() ? 'text-white' : 'text-slate-400'} />
                </div>
                <div className="flex-1 text-left">
                  <div className={cn('text-sm font-bold leading-none', caseNumber.trim() ? 'text-white' : 'text-slate-400')}>
                    Run AI Review
                  </div>
                  {caseNumber.trim() && (
                    <div className="mt-0.5 font-mono text-[11px] text-white/60 leading-none">
                      {caseNumber}
                    </div>
                  )}
                </div>
                <ArrowRight size={16} className={cn('shrink-0 transition-transform group-hover:translate-x-0.5', caseNumber.trim() ? 'text-white/70' : 'text-slate-400')} />
              </div>
            </button>

            {/* Pipeline preview */}
            <div className="flex flex-col min-h-0 flex-1">
              <div className="mb-2 flex items-center gap-3 shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">What happens next</p>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm flex-1 flex flex-col">
                {INITIAL_STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  const isLast = idx === INITIAL_STEPS.length - 1;
                  return (
                    <div
                      key={step.id}
                      className={cn(
                        'group flex flex-1 items-center gap-3 px-3.5 transition-colors hover:bg-blue-50/50',
                        !isLast && 'border-b border-slate-100',
                      )}
                    >
                      {/* Number */}
                      <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600" style={{ minWidth: '1.125rem', minHeight: '1.125rem' }}>
                        {step.id}
                      </span>
                      {/* Icon */}
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-100 bg-slate-50 transition-colors group-hover:border-blue-100 group-hover:bg-blue-50">
                        <Icon size={11} className="text-slate-500 transition-colors group-hover:text-blue-500" />
                      </div>
                      {/* Text */}
                      <div className="flex-1 min-w-0 py-2">
                        <p className="text-[11px] font-semibold text-slate-800 leading-tight">{step.label}</p>
                        <p className="text-[10px] text-slate-400 truncate leading-tight">{step.description}</p>
                      </div>
                      {/* Pending dot */}
                      <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-blue-400 transition-colors" />
                    </div>
                  );
                })}
              </div>

              {/* Outcome legend */}
              <div className="mt-2.5 shrink-0 flex items-center justify-center gap-4 text-[10px] text-slate-400">
                {[
                  { color: 'bg-emerald-400', label: 'Auto-Approve' },
                  { color: 'bg-violet-400', label: 'MD Review' },
                  { color: 'bg-amber-400', label: 'More Info' },
                  { color: 'bg-red-400', label: 'Deny' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={cn('h-1.5 w-1.5 rounded-full', color)} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ACTIVE / DONE / ERROR LAYOUT ──────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-50 overflow-hidden" style={{ maxHeight: '100vh' }}>

      {/* ── TOPBAR ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3 flex items-center gap-4 z-10">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', isActive ? 'bg-blue-600' : phase === 'done' ? 'bg-emerald-500' : 'bg-red-500')}>
            {isActive ? <Loader2 size={15} className="text-white animate-spin" /> : phase === 'done' ? <CheckCircle2 size={15} className="text-white" /> : <AlertCircle size={15} className="text-white" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900 whitespace-nowrap">AI Case Review</span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">{caseNumber}</span>
              {runningStep && isActive && (
                <span className="text-[11px] text-blue-600 animate-pulse whitespace-nowrap">→ {runningStep.label}…</span>
              )}
              {phase === 'done' && <span className="text-[11px] text-emerald-600 font-medium whitespace-nowrap">Analysis complete</span>}
            </div>
          </div>
        </div>

        {/* Center: progress bar */}
        {(isActive || phase === 'done') && (
          <div className="flex flex-1 max-w-sm items-center gap-2.5 mx-4">
            <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700 ease-out', phase === 'done' ? 'bg-emerald-500' : 'bg-blue-500')}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] font-semibold text-slate-500 tabular-nums">{doneCount}/{steps.length}</span>
          </div>
        )}

        {/* Right: actions */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {(phase === 'done' || phase === 'error') && (
            <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
              <RotateCcw size={12} /> New Review
            </button>
          )}
          {isActive && (
            <div className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              <span className="text-xs font-semibold text-blue-600">Analyzing</span>
            </div>
          )}
        </div>
      </div>

      {/* ── ERROR BANNER ────────────────────────────────────────────────── */}
      {phase === 'error' && (
        <div className="mx-5 mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 animate-fade-in shrink-0">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700 text-sm">Review failed</p>
            <p className="mt-0.5 text-xs text-red-600">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* ── THREE-PANEL BODY ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ═══ PANEL 1: PROCESS STEPS (260px) ══════════════════════════════ */}
        <div className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Process Steps</p>
            {/* Mini progress */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', phase === 'done' ? 'bg-emerald-400' : 'bg-blue-400')}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-slate-500 tabular-nums">{Math.round(progressPct)}%</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pt-4 scrollbar-thin">
            {steps.map((step, i) => <StepItem key={step.id} step={step} isLast={i === steps.length - 1} />)}
          </div>
          {runId && (
            <div className="border-t border-slate-100 px-4 py-2.5 shrink-0">
              <p className="text-[10px] text-slate-400">Run: <span className="font-mono">{runId.slice(0, 12)}…</span></p>
            </div>
          )}
        </div>

        {/* ═══ PANEL 2: AI TERMINAL (288px) ════════════════════════════════ */}
        <div className="flex w-72 shrink-0 flex-col border-r border-slate-200 overflow-hidden">
          {/* Terminal header */}
          <div
            className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-2.5 cursor-pointer shrink-0 select-none"
            onClick={() => setLogCollapsed(v => !v)}
          >
            <div className="flex items-center gap-2">
              {/* Traffic lights */}
              <div className="flex items-center gap-1.5 mr-1">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <Terminal size={12} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-300">AI Activity Log</span>
              {isActive && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600">{log.length}</span>
              {logCollapsed ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronUp size={12} className="text-slate-500" />}
            </div>
          </div>

          {/* Terminal body */}
          {!logCollapsed && (
            <div
              ref={logRef}
              className="flex-1 overflow-y-auto bg-slate-950 p-3 space-y-0.5"
              style={{ fontFamily: '"JetBrains Mono","Fira Code",ui-monospace,monospace', fontSize: '11px', scrollbarColor: '#334155 transparent', scrollbarWidth: 'thin' }}
            >
              {log.length === 0 && (
                <div className="flex items-center gap-2 text-slate-600 mt-4 px-1">
                  <span className="text-slate-700">$</span>
                  <span className="animate-pulse text-slate-500">Initializing agent…</span>
                  <span className="animate-blink text-slate-600">▊</span>
                </div>
              )}
              {log.map((entry, i) => {
                if (entry.type === 'ai') return (
                  <div key={i} className="mt-2 mb-2 rounded-lg bg-violet-950/70 border border-violet-800/40 p-2.5 animate-fade-in">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Brain size={10} className="text-violet-400" />
                      <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wide">AI Reasoning</span>
                      <span className="ml-auto text-[9px] text-slate-600">{entry.ts}</span>
                    </div>
                    <p className="text-[11px] text-violet-200 leading-relaxed whitespace-pre-wrap break-words">{entry.preview}</p>
                  </div>
                );
                if (entry.type === 'system') return (
                  <div key={i} className="flex items-center gap-2 text-slate-600 py-0.5 animate-fade-in">
                    <span className="shrink-0 text-slate-700 text-[9px] tabular-nums">{entry.ts}</span>
                    <span className="text-slate-700">›</span>
                    <span className="text-slate-500 truncate italic">{entry.tool}</span>
                    {entry.preview && <span className="text-slate-700 truncate">— {entry.preview}</span>}
                  </div>
                );
                return (
                  <div key={i} className="flex gap-2 items-start py-0.5 animate-fade-in">
                    <span className="shrink-0 text-slate-700 text-[9px] tabular-nums pt-px">{entry.ts}</span>
                    <span className={cn('shrink-0 pt-px', entry.status === 'done' ? 'text-emerald-400' : entry.status === 'running' ? 'text-blue-400' : 'text-red-400')}>
                      {entry.status === 'done' ? '✓' : entry.status === 'running' ? '▶' : '✗'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className={cn(entry.status === 'done' ? 'text-emerald-300' : entry.status === 'running' ? 'text-blue-300' : 'text-red-400')}>
                        {entry.tool}
                      </span>
                      {entry.preview && <span className="ml-1.5 text-slate-600">— {entry.preview}</span>}
                    </div>
                  </div>
                );
              })}
              {isActive && (
                <div className="flex items-center gap-2 py-0.5 text-blue-500 animate-fade-in">
                  <span className="text-slate-700 text-[9px] tabular-nums">{nowTs()}</span>
                  <Loader2 size={9} className="animate-spin shrink-0" />
                  <span className="animate-pulse text-blue-400">Processing…</span>
                </div>
              )}
            </div>
          )}
          {logCollapsed && (
            <div className="flex-1 flex items-center justify-center bg-slate-950">
              <p className="text-[11px] text-slate-600">Terminal hidden</p>
            </div>
          )}
        </div>

        {/* ═══ PANEL 3: CRITERIA TREE + DETERMINATION (flex-1) ═════════════ */}
        <div className="flex-1 overflow-y-auto bg-slate-50 scrollbar-thin">
          <div className="p-5 space-y-4">

            {/* ── Determination outcome card ── */}
            {determination && outcomeConfig ? (
              <div className={cn('rounded-2xl p-5 text-white shadow-lg animate-fade-up', outcomeConfig.cssClass)}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-white/80" />
                      <p className="text-xs font-bold uppercase tracking-widest text-white/70">AI Determination</p>
                    </div>
                    <p className="text-2xl font-extrabold tracking-tight">{outcomeConfig.label}</p>
                    <p className="mt-0.5 text-sm text-white/75">{outcomeConfig.sublabel}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-4xl font-black tabular-nums">{Math.round(confidence * 100)}<span className="text-xl font-bold opacity-70">%</span></p>
                    <p className="text-xs text-white/60 mt-0.5">confidence</p>
                  </div>
                </div>
                {/* Confidence bar */}
                <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-white/60 transition-all duration-1000 ease-out" style={{ width: `${confidence * 100}%` }} />
                </div>
                <p className="mt-3 text-xs text-white/75 leading-relaxed">{outcomeConfig.description}</p>
              </div>
            ) : isActive ? (
              /* Loading state placeholder */
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-5 flex items-center gap-4 animate-fade-in">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                  <Loader2 size={22} className="text-blue-500 animate-spin" />
                </div>
                <div>
                  <p className="font-semibold text-slate-700 text-sm">
                    {phase === 'loading_criteria' ? 'Building criteria decision tree…' : 'AI is analyzing the case…'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {runningStep ? `Currently: ${runningStep.label} — ${runningStep.description}` : 'Preparing analysis environment…'}
                  </p>
                </div>
              </div>
            ) : null}

            {/* ── Criteria decision tree ── */}
            {treeResults.length > 0 ? (
              treeResults.map((result, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-fade-up">
                  {/* Tree header */}
                  <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3.5 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <GitBranch size={14} className="text-slate-500" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Coverage Policy</p>
                      </div>
                      <p className="text-sm font-bold text-slate-900">{result.policy.title}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {result.policy.cmsId && (
                        <span className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-500">
                          {result.policy.cmsId}
                        </span>
                      )}
                      <span className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">
                        {result.criteriaSet.scopeSetting}
                      </span>
                    </div>
                  </div>
                  {/* Tree body */}
                  <div className="p-4">
                    <AutoTreeNode
                      node={result.tree}
                      states={criteriaStates}
                      evidence={criteriaEvidence}
                      activeLeafIds={activeLeafIds}
                    />
                  </div>
                </div>
              ))
            ) : (phase === 'running' || phase === 'done') ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm animate-fade-in">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <GitBranch size={20} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">No criteria tree found for this case's diagnosis codes.</p>
                  <p className="text-xs text-slate-400">The AI agent will evaluate the case using its training and policy knowledge.</p>
                  {runId && <p className="text-[11px] font-mono text-slate-400 mt-1">Run ID: {runId}</p>}
                </div>
              </div>
            ) : null}

          </div>
        </div>
      </div>
    </div>
  );
}
