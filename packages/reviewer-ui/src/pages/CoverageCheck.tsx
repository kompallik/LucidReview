import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Search, ChevronDown, SearchCheck, Shield, FileText,
  Activity, GitBranch, Sparkles, CheckCircle2, RotateCcw,
  ArrowRight, AlertCircle, Loader2, XCircle,
  HelpCircle, X, Heart, Eye, Brain, Bone, Stethoscope,
  Microscope, Syringe, Scan, Zap, FlaskConical, Pill,
} from 'lucide-react';
import CriteriaTreeView, { type TreeNode } from '../components/CriteriaTreeView.tsx';
import QuickReferencePanel from '../components/QuickReferencePanel.tsx';
import { cn } from '../lib/cn.ts';

// ─── Quick-select scenarios ───────────────────────────────────────────────────

const QUICK_CODES = [
  {
    label: 'Back Pain + Facet Injection', sub: 'Axial Pain · Interventional',
    icd10: 'M54.50', cpt: '64493', serviceType: 'OUTPATIENT',
    Icon: Zap, color: 'bg-orange-500', light: 'bg-orange-50 text-orange-600 border-orange-200',
  },
  {
    label: 'Knee OA + Total Knee (TKA)', sub: 'Orthopedic · Surgery',
    icd10: 'M17.11', cpt: '27447', serviceType: 'OUTPATIENT',
    Icon: Bone, color: 'bg-blue-500', light: 'bg-blue-50 text-blue-600 border-blue-200',
  },
  {
    label: 'Cataract + Phaco Surgery', sub: 'Ophthalmology · Lens',
    icd10: 'H25.9', cpt: '66984', serviceType: 'OUTPATIENT',
    Icon: Eye, color: 'bg-violet-500', light: 'bg-violet-50 text-violet-600 border-violet-200',
  },
  {
    label: 'CAD + Cardiac Stress Test', sub: 'Cardiology · Diagnostic',
    icd10: 'I25.10', cpt: '93015', serviceType: 'OUTPATIENT',
    Icon: Heart, color: 'bg-rose-500', light: 'bg-rose-50 text-rose-600 border-rose-200',
  },
  {
    label: 'Depression + TMS Therapy', sub: 'Psychiatry · Neuromodulation',
    icd10: 'F32.9', cpt: '90867', serviceType: 'OUTPATIENT',
    Icon: Brain, color: 'bg-purple-500', light: 'bg-purple-50 text-purple-600 border-purple-200',
  },
  {
    label: 'Colon Screen + Colonoscopy', sub: 'Gastroenterology · Screening',
    icd10: 'Z12.11', cpt: '45378', serviceType: 'OUTPATIENT',
    Icon: Scan, color: 'bg-teal-500', light: 'bg-teal-50 text-teal-600 border-teal-200',
  },
];

const FEATURE_BULLETS = [
  { icon: GitBranch, title: 'Live Decision Trees', body: 'Criteria fetched from CMS policy libraries as evaluable decision trees.' },
  { icon: Shield, title: 'Multi-Setting Coverage', body: 'Inpatient, outpatient, DME, and home health in one view.' },
  { icon: FileText, title: 'Interactive Criteria Review', body: 'Mark criteria Met / Not Met and see real-time determination outcomes.' },
];

const SERVICE_TYPES = [
  { value: '', label: 'Any Setting' },
  { value: 'INPATIENT', label: 'Inpatient' },
  { value: 'OUTPATIENT', label: 'Outpatient' },
  { value: 'DME', label: 'DME' },
  { value: 'HOME_HEALTH', label: 'Home Health' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface CriteriaCombo {
  policyId: string;
  policyTitle: string;
  policyType: string;
  cmsId: string | null;
  criteriaSetId: string;
  scopeSetting: string;
  icd10: string;
  allIcd10: string[];
  cpt: string;
  allCpt: string[];
}

interface TreeResult {
  relevanceScore?: number;
  isPrimary?: boolean;
  policy: { id: string; title: string; policyType: string; cmsId: string | null; sourceUrl: string | null };
  criteriaSet: { id: string; criteriaSetId: string; title: string; scopeSetting: string; scopeRequestType: string; cqlLibraryFhirId: string | null };
  tree: TreeNode;
  matchedOn: { diagnosisCodes: string[]; serviceType?: string };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CoverageCheck() {
  const [icd10, setIcd10] = useState('');
  const [cpt, setCpt] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TreeResult[] | null>(null);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [synthesize, setSynthesize] = useState(false);
  const [helpCombos, setHelpCombos] = useState<CriteriaCombo[]>([]);
  const [helpTotal, setHelpTotal] = useState(0);
  const [helpSearch, setHelpSearch] = useState('');
  const [helpSetting, setHelpSetting] = useState('OUTPATIENT');
  const [helpLoading, setHelpLoading] = useState(false);

  const token = localStorage.getItem('lucidreview_token');

  // Fetch combos when modal opens or filters change
  useEffect(() => {
    if (!showHelp) return;
    setHelpLoading(true);
    const params = new URLSearchParams();
    if (helpSearch.trim()) params.set('q', helpSearch.trim());
    if (helpSetting) params.set('setting', helpSetting);
    fetch(`/api/criteria-combos?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setHelpCombos(d.combos ?? []); setHelpTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setHelpLoading(false));
  }, [showHelp, helpSearch, helpSetting, token]);

  const icd10Ref = useRef(icd10);
  const cptRef = useRef(cpt);
  const serviceTypeRef = useRef(serviceType);
  icd10Ref.current = icd10;
  cptRef.current = cpt;
  serviceTypeRef.current = serviceType;

  const runSearch = useCallback(
    async (overrides?: { icd10?: string; cpt?: string; serviceType?: string }) => {
      const resolvedIcd10 = overrides?.icd10 ?? icd10Ref.current;
      const resolvedCpt = overrides?.cpt ?? cptRef.current;
      const resolvedServiceType = overrides?.serviceType ?? serviceTypeRef.current;
      if (!resolvedIcd10 && !resolvedCpt) { setError('Enter at least one ICD-10 or CPT code.'); return; }
      setError(''); setLoading(true); setSearched(true); setShowSecondary(false);
      try {
        const params = new URLSearchParams();
        if (resolvedIcd10) params.set('icd10', resolvedIcd10.trim());
        if (resolvedCpt) params.set('cpt', resolvedCpt.trim());
        if (resolvedServiceType) params.set('serviceType', resolvedServiceType);
        if (synthesize) params.set('synthesize', 'true');
        const resp = await fetch(`/api/criteria-tree?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        setResults(await resp.json() as TreeResult[]);
      } catch {
        setError('Failed to fetch criteria. Check that the server is running.');
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  function applyQuickCode(q: (typeof QUICK_CODES)[number]) {
    setIcd10(q.icd10 ?? '');
    setCpt(q.cpt ?? '');
    setServiceType(q.serviceType ?? '');
    setResults(null);
    setSearched(false);
  }

  function handleApplyCode(icd10Code?: string, cptCode?: string, serviceTypeOverride?: string) {
    const isFullCombo = icd10Code !== undefined && cptCode !== undefined && serviceTypeOverride !== undefined;
    const nextIcd10 = isFullCombo ? icd10Code : icd10Code ? (icd10Ref.current ? `${icd10Ref.current}, ${icd10Code}` : icd10Code) : icd10Ref.current;
    const nextCpt = cptCode ?? cptRef.current;
    const nextServiceType = serviceTypeOverride ?? serviceTypeRef.current;
    setIcd10(nextIcd10);
    if (cptCode !== undefined) setCpt(nextCpt);
    if (serviceTypeOverride !== undefined) setServiceType(nextServiceType);
    void runSearch({ icd10: nextIcd10, cpt: nextCpt, serviceType: nextServiceType });
  }

  function resetSearch() {
    setIcd10(''); setCpt(''); setServiceType('');
    setResults(null); setSearched(false); setError('');
  }

  const hasInput = icd10.trim() || cpt.trim();
  const primary = results?.filter(r => r.isPrimary !== false && (r.relevanceScore ?? 100) >= 80) ?? [];
  const secondary = results?.filter(r => !primary.includes(r)) ?? [];

  const renderResult = (result: TreeResult, i: number) => {
    const isSynthesized = result.policy.policyType === 'SYNTHESIZED';
    const sourcePolicies = (result.policy as unknown as Record<string,unknown>).sourcePolicies as Array<{cmsId:string|null;title:string}> | undefined;
    const sourcePolicyCount = (result.policy as unknown as Record<string,unknown>).sourcePolicyCount as number | undefined;
    return (
    <div key={`${i}-${icd10}-${cpt}`} className={cn(
      "rounded-2xl border shadow-sm animate-fade-up overflow-hidden",
      isSynthesized ? "border-violet-300 bg-white shadow-violet-100 ring-1 ring-violet-200" : "border-slate-200 bg-white"
    )}>
      {/* Synthesized banner */}
      {isSynthesized && (
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-white/80 shrink-0" />
            <span className="text-xs font-bold text-white">AI-Synthesized Criteria</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold text-white">
              merged from {sourcePolicyCount ?? '?'} regional policies
            </span>
          </div>
          {sourcePolicies && sourcePolicies.length > 0 && (
            <div className="flex items-center gap-1 text-[9px] text-white/60 truncate max-w-xs">
              Sources: {sourcePolicies.slice(0,4).map(p => p.cmsId || p.title.slice(0,15)).join(' · ')}
              {sourcePolicies.length > 4 && ` +${sourcePolicies.length - 4} more`}
            </div>
          )}
        </div>
      )}
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-slate-900 truncate">{result.criteriaSet.title}</span>
          {!isSynthesized && (result.relevanceScore ?? 100) >= 90 && (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700 uppercase tracking-wide">Best Match</span>
          )}
        </div>
        {result.criteriaSet.scopeSetting && (
          <span className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
            {result.criteriaSet.scopeSetting}
          </span>
        )}
      </div>
      <div className="p-5">
        <CriteriaTreeView
          tree={result.tree}
          policyTitle={result.policy.title}
          cmsId={result.policy.cmsId}
          scopeSetting={result.criteriaSet.scopeSetting}
          scopeRequestType={result.criteriaSet.scopeRequestType}
          cqlLibraryFhirId={result.criteriaSet.cqlLibraryFhirId}
        />
      </div>
    </div>
    );
  };

  // ── ALWAYS: dark left panel + right panel (form or results) ──────────────────
  return (
    <div className="flex h-full overflow-hidden" style={{ maxHeight: '100vh' }}>

      {/* ══ LEFT: persistent dark hero ════════════════════════════════════════ */}
      <div className="relative flex w-[32%] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-8 py-10">
        {/* Grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '44px 44px' }}
        />
        <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-600/15 blur-3xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/40">
            <SearchCheck size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-bold text-white">LucidReview</div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-indigo-300/60">UM Platform</div>
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1">
            <Sparkles size={11} className="text-indigo-400" />
            <span className="text-[11px] font-semibold text-indigo-300">Real-Time Coverage Check</span>
          </div>
          <h1 className="mb-3 text-3xl font-black leading-tight tracking-tight text-white">
            Coverage<br />
            <span className="text-indigo-400">Criteria</span><br />
            Explorer
          </h1>
          <p className="mb-7 max-w-xs text-sm text-slate-400 leading-relaxed">
            Look up authorization criteria for any diagnosis or procedure code.
          </p>
          <div className="space-y-3.5">
            {FEATURE_BULLETS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/8 ring-1 ring-white/10">
                  <Icon size={13} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust bar */}
        <div className="relative z-10 flex items-center gap-4">
          {['CMS NCD/LCD', 'ICD-10 Coded', 'CPT Indexed'].map(label => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <CheckCircle2 size={10} className="text-slate-600" />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ══ RIGHT: form (idle) OR results panel ══════════════════════════════ */}
      {!searched ? (
        /* ── IDLE: search form ─────────────────────────────────────────────── */
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
          <div className="flex h-full flex-col justify-center px-10 py-8 max-w-2xl w-full mx-auto animate-fade-up">

            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-900">Check Coverage Criteria</h2>
              <p className="mt-0.5 text-sm text-slate-500">Enter a diagnosis or procedure code to look up authorization criteria.</p>
            </div>

            <div className="mb-4 space-y-3">
              {/* ICD-10 */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">ICD-10 Diagnosis Code</label>
                <div className="relative">
                  <input
                    value={icd10}
                    onChange={e => setIcd10(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === 'Enter') void runSearch(); }}
                    placeholder="e.g. J96.00, I50.9"
                    autoComplete="off" spellCheck={false}
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 px-4 font-mono text-sm font-semibold text-slate-800 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {icd10 && <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold text-violet-600 uppercase">ICD-10</span>}
                </div>
              </div>
              {/* CPT */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">CPT / HCPCS Procedure Code</label>
                <div className="relative">
                  <input
                    value={cpt}
                    onChange={e => setCpt(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === 'Enter') void runSearch(); }}
                    placeholder="e.g. 27447, 93015"
                    autoComplete="off" spellCheck={false}
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 px-4 font-mono text-sm font-semibold text-slate-800 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {cpt && <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-600 uppercase">CPT</span>}
                </div>
              </div>
              {/* Service setting */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Service Setting</label>
                <div className="flex gap-1.5">
                  {SERVICE_TYPES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setServiceType(value)}
                      className={cn(
                        'flex-1 rounded-lg border py-2 text-[11px] font-semibold transition-all',
                        serviceType === value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 animate-fade-in">
                <AlertCircle size={14} className="shrink-0" />{error}
              </div>
            )}

            {/* CTA button */}
            <button
              onClick={() => void runSearch()}
              disabled={!hasInput}
              className="group relative mb-5 flex w-full overflow-hidden rounded-xl py-3 text-sm font-bold transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: hasInput ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 50%, #6366f1 100%)' : '#e2e8f0',
                boxShadow: hasInput ? '0 4px 24px -4px rgba(79,70,229,0.5), 0 1px 3px rgba(79,70,229,0.3), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
              }}
            >
              <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <div className={cn('flex w-full items-center gap-2.5 px-5', !hasInput && 'text-slate-400')}>
                <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', hasInput ? 'bg-white/20' : 'bg-slate-300')}>
                  <Search size={13} className={hasInput ? 'text-white' : 'text-slate-400'} />
                </div>
                <div className="flex-1 text-left">
                  <div className={cn('text-sm font-bold leading-none', hasInput ? 'text-white' : 'text-slate-400')}>Check Coverage</div>
                  {hasInput && <div className="mt-0.5 font-mono text-[11px] text-white/60 leading-none truncate">{[icd10, cpt].filter(Boolean).join(' · ')}{serviceType ? ` · ${serviceType}` : ''}</div>}
                </div>
                <ArrowRight size={16} className={cn('shrink-0 transition-transform group-hover:translate-x-0.5', hasInput ? 'text-white/70' : 'text-slate-400')} />
              </div>
            </button>

            {/* Quick scenarios */}
            <div>
              <div className="mb-3 flex items-center gap-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Quick Scenarios</p>
                <div className="h-px flex-1 bg-slate-200" />
                <button
                  onClick={() => setShowHelp(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600"
                  title="View all supported diagnosis + procedure combos"
                >
                  <HelpCircle size={10} />
                  All Combos
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {QUICK_CODES.map(q => {
                  const { Icon } = q;
                  return (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => applyQuickCode(q)}
                      className="group relative flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden text-left transition-all hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5"
                    >
                      {/* Color top bar */}
                      <div className={`h-1 w-full ${q.color}`} />
                      <div className="flex items-start gap-3 px-4 py-3.5">
                        {/* Icon */}
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${q.light}`}>
                          <Icon size={17} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 leading-snug group-hover:text-indigo-700 line-clamp-2">{q.label}</p>
                          <p className="mt-0.5 text-[9px] text-slate-400 truncate">{q.sub}</p>
                          <div className="mt-1 flex items-center gap-1">
                            <span className={`rounded px-1 py-0.5 font-mono text-[8px] font-semibold border ${q.light}`}>{q.icd10}</span>
                            <span className="font-mono text-[8px] text-slate-400">{q.cpt}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Help Modal — dynamic, fetches all 1000+ policy combos ── */}
            {showHelp && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowHelp(false)} />
                <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col" style={{ maxHeight: '85vh' }}>

                  {/* Modal header */}
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Coverage Criteria Library</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {helpLoading ? 'Loading…' : `${helpTotal.toLocaleString()} policy combos · click any row to load its criteria tree`}
                      </p>
                    </div>
                    <button onClick={() => setShowHelp(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                      <X size={16} />
                    </button>
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 bg-slate-50/60">
                    <div className="relative flex-1">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={helpSearch}
                        onChange={e => setHelpSearch(e.target.value)}
                        placeholder="Search policy, ICD-10, CPT code…"
                        className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
                      />
                    </div>
                    <div className="flex gap-1">
                      {[{v:'',l:'All'},{v:'OUTPATIENT',l:'Outpt'},{v:'INPATIENT',l:'Inpt'},{v:'DME',l:'DME'},{v:'HOME_HEALTH',l:'Home'}].map(({v,l}) => (
                        <button key={v} onClick={() => setHelpSetting(v)}
                          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${helpSetting===v ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scrollable list */}
                  <div className="flex-1 overflow-y-auto">
                    {helpLoading ? (
                      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-xs">Loading policy library…</span>
                      </div>
                    ) : helpCombos.length === 0 ? (
                      <div className="flex items-center justify-center py-16 text-slate-400 text-xs">No policies found</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                          <tr>
                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 w-16">Type</th>
                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Policy</th>
                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 w-24">ICD-10</th>
                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 w-24">CPT</th>
                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 w-24">Setting</th>
                          </tr>
                        </thead>
                        <tbody>
                          {helpCombos.map((c, i) => {
                            const settingColor = c.scopeSetting === 'OUTPATIENT' ? 'bg-emerald-100 text-emerald-700' :
                              c.scopeSetting === 'INPATIENT' ? 'bg-blue-100 text-blue-700' :
                              c.scopeSetting === 'DME' ? 'bg-amber-100 text-amber-700' :
                              'bg-violet-100 text-violet-700';
                            const typeColor = c.policyType === 'NCD' ? 'bg-blue-50 text-blue-700 ring-blue-200' :
                              c.policyType === 'LCD' ? 'bg-teal-50 text-teal-700 ring-teal-200' :
                              'bg-violet-50 text-violet-700 ring-violet-200';
                            return (
                              <tr key={i} onClick={() => {
                                setIcd10(c.icd10); setCpt(c.cpt); setServiceType(c.scopeSetting);
                                setShowHelp(false);
                                void runSearch({ icd10: c.icd10, cpt: c.cpt, serviceType: c.scopeSetting });
                              }}
                                className="border-b border-slate-50 hover:bg-indigo-50/60 cursor-pointer transition-colors group">
                                <td className="px-4 py-2.5">
                                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1 ring-inset ${typeColor}`}>{c.policyType}</span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="font-medium text-slate-800 group-hover:text-indigo-700 leading-snug line-clamp-1">{c.policyTitle}</div>
                                  {c.cmsId && <div className="font-mono text-[9px] text-slate-400 mt-0.5">{c.cmsId}</div>}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-slate-700">{c.icd10}</td>
                                <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-slate-700">{c.cpt}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${settingColor}`}>{c.scopeSetting.replace('_',' ')}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="border-t border-slate-100 px-5 py-2.5 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{helpTotal.toLocaleString()} total · {helpCombos.length} shown</span>
                    <span>Click any row to instantly load its criteria tree →</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── RESULTS: stays in same right panel, same dark left persists ──── */
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">

          {/* Compact search bar */}
          <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-2.5 flex items-center gap-2.5 flex-wrap">
            {/* ICD-10 */}
            <div className="relative">
              <input
                value={icd10}
                onChange={e => setIcd10(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') void runSearch(); }}
                placeholder="ICD-10"
                className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-slate-800 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
              />
              {icd10 && <span className="absolute right-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-violet-400" />}
            </div>
            {/* CPT */}
            <div className="relative">
              <input
                value={cpt}
                onChange={e => setCpt(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') void runSearch(); }}
                placeholder="CPT"
                className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-slate-800 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
              />
              {cpt && <span className="absolute right-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            </div>
            {/* Service type */}
            <select
              value={serviceType}
              onChange={e => setServiceType(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
            >
              {SERVICE_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
            {/* Search */}
            <button
              onClick={() => void runSearch()}
              disabled={loading || !hasInput}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-indigo-500/20 transition-all hover:bg-indigo-700 disabled:bg-slate-300 disabled:shadow-none"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              {loading ? 'Searching…' : 'Search'}
            </button>
            {/* Reset */}
            <button
              onClick={resetSearch}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <RotateCcw size={11} />
              Reset
            </button>
            {/* Synthesize toggle — glowing when active */}
            <div className="relative group/synth">
              <button
                onClick={() => { setSynthesize(s => !s); void runSearch({ icd10: icd10Ref.current, cpt: cptRef.current, serviceType: serviceTypeRef.current }); }}
                disabled={loading}
                className={cn(
                  'relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                  synthesize
                    ? 'bg-violet-600 text-white'
                    : 'border border-violet-200 bg-white text-violet-600 hover:bg-violet-50',
                )}
                style={synthesize ? {
                  boxShadow: '0 0 0 2px rgba(139,92,246,0.4), 0 0 16px rgba(139,92,246,0.5), 0 0 32px rgba(139,92,246,0.25)',
                  animation: 'synthesize-glow 2s ease-in-out infinite',
                } : undefined}
              >
                <Sparkles size={11} className={synthesize ? 'animate-pulse' : ''} />
                {loading && synthesize ? 'Synthesizing…' : synthesize ? '✦ Synthesized' : '✦ Synthesize'}
              </button>
              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 opacity-0 group-hover/synth:opacity-100 transition-opacity duration-150 z-50 w-56">
                <div className="rounded-lg bg-slate-900 px-3 py-2 text-center shadow-xl">
                  <p className="text-[11px] font-semibold text-white">AI Policy Synthesis</p>
                  <p className="mt-0.5 text-[10px] text-slate-400 leading-relaxed">
                    {synthesize
                      ? 'Showing 1 synthesized criteria tree merged from all matching policies'
                      : 'Click to generate 1 DT summarizing all matching policies'}
                  </p>
                  <div className="mt-1 flex items-center justify-center gap-1 text-[9px] text-violet-400">
                    <Sparkles size={8} />
                    Powered by Claude
                  </div>
                </div>
                <div className="mx-auto h-1.5 w-2 overflow-hidden">
                  <div className="h-2 w-2 rotate-45 bg-slate-900 translate-x-[2px]" />
                </div>
              </div>
            </div>
            {/* Inject glow keyframe */}
            <style>{`
              @keyframes synthesize-glow {
                0%, 100% { box-shadow: 0 0 0 2px rgba(139,92,246,0.4), 0 0 16px rgba(139,92,246,0.5), 0 0 32px rgba(139,92,246,0.25); }
                50% { box-shadow: 0 0 0 3px rgba(139,92,246,0.6), 0 0 24px rgba(139,92,246,0.7), 0 0 48px rgba(139,92,246,0.35); }
              }
            `}</style>
            {/* Result count */}
            {!loading && results !== null && (
              <span className="ml-auto text-[11px] text-slate-500">
                {synthesize && primary[0]?.policy.policyType === 'SYNTHESIZED'
                  ? <><span className="font-semibold text-violet-700">1 synthesized</span> · from {primary.length - 1} source{primary.length - 1 !== 1 ? 's' : ''}</>
                  : <><span className="font-semibold text-slate-700">{primary.length}</span> primary{secondary.length > 0 && <> · <span className="font-semibold text-slate-700">{secondary.length}</span> related</>}</>
                }
              </span>
            )}
            {error && (
              <span className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700">
                <AlertCircle size={11} />{error}
              </span>
            )}
          </div>

          {/* Results — full width */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="p-5 space-y-4">

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 mb-4">
                    <Loader2 size={24} className="text-indigo-500 animate-spin" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Fetching coverage criteria…</p>
                  <p className="mt-1 text-xs text-slate-400">{[icd10, cpt].filter(Boolean).join(' · ')}</p>
                </div>
              )}

              {/* No results */}
              {!loading && results !== null && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 mb-4">
                    <XCircle size={22} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">No coverage criteria found</p>
                  <p className="mt-1 text-xs text-slate-400 max-w-xs">Try a different code or run the CMS ingestion script to load more policies.</p>
                </div>
              )}

              {/* When synthesize is ON: show only the 1 synthesized DT */}
              {!loading && synthesize && primary.length > 0 && primary[0]?.policy.policyType === 'SYNTHESIZED' && (
                <div className="space-y-4">
                  {renderResult(primary[0]!, 0)}
                  {/* Collapsed source policies */}
                  {primary.length > 1 && (
                    <div className="mt-1">
                      <button onClick={() => setShowSecondary(s => !s)}
                        className="flex items-center gap-2 text-xs text-slate-500 transition-colors hover:text-violet-700">
                        <ChevronDown size={14} className={cn('text-slate-400 transition-transform', showSecondary && 'rotate-180')} />
                        {showSecondary ? 'Hide' : 'Show'} {primary.length - 1} source polic{primary.length - 1 === 1 ? 'y' : 'ies'} used for synthesis
                      </button>
                      {showSecondary && (
                        <div className="mt-4 space-y-4 opacity-70">{primary.slice(1).map((r, i) => renderResult(r, i + 1))}</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Normal mode: show all primary results */}
              {!loading && (!synthesize || primary[0]?.policy.policyType !== 'SYNTHESIZED') && primary.length > 0 && (
                <div className="space-y-4">{primary.map((r, i) => renderResult(r, i))}</div>
              )}

              {/* Secondary results (comorbidity context) — only in normal mode */}
              {!loading && !synthesize && secondary.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowSecondary(s => !s)}
                    className="flex items-center gap-2 text-xs text-slate-500 transition-colors hover:text-slate-800"
                  >
                    <ChevronDown size={14} className={cn('text-slate-400 transition-transform', showSecondary && 'rotate-180')} />
                    {showSecondary ? 'Hide' : 'Show'} {secondary.length} additional polic{secondary.length === 1 ? 'y' : 'ies'} where this code appears as a comorbidity
                  </button>
                  {showSecondary && (
                    <div className="mt-4 space-y-4 opacity-80">{secondary.map((r, i) => renderResult(r, primary.length + i))}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
