import { useState, useCallback, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import CriteriaTreeView, { type TreeNode } from '../components/CriteriaTreeView.tsx';
import QuickReferencePanel from '../components/QuickReferencePanel.tsx';

// Known common ICD-10 codes for quick selection
// Quick-select scenarios — outpatient procedure focus
const QUICK_CODES = [
  { label: 'Back Pain + Facet',   icd10: 'M54.50', cpt: '64493', serviceType: 'OUTPATIENT' },
  { label: 'Knee OA + TKA',       icd10: 'M17.11', cpt: '27447', serviceType: 'OUTPATIENT' },
  { label: 'Cataract + Surgery',  icd10: 'H25.9',  cpt: '66984', serviceType: 'OUTPATIENT' },
  { label: 'CAD + Stress Test',   icd10: 'I25.10', cpt: '93015', serviceType: 'OUTPATIENT' },
  { label: 'Depression + TMS',    icd10: 'F32.9',  cpt: '90867', serviceType: 'OUTPATIENT' },
  { label: 'Colonoscopy Screen',  icd10: 'Z12.11', cpt: '45378', serviceType: 'OUTPATIENT' },
];

interface TreeResult {
  relevanceScore?: number;
  isPrimary?: boolean;
  policy: { id: string; title: string; policyType: string; cmsId: string | null; sourceUrl: string | null };
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

export default function CoverageCheck() {
  const [icd10, setIcd10] = useState('');
  const [cpt, setCpt] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TreeResult[] | null>(null);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);

  const token = localStorage.getItem('lucidreview_token');

  // Keep a ref to the latest field values so the programmatic search path can
  // read them synchronously after a state update that hasn't flushed yet.
  const icd10Ref = useRef(icd10);
  const cptRef = useRef(cpt);
  const serviceTypeRef = useRef(serviceType);

  // Keep refs in sync with state
  icd10Ref.current = icd10;
  cptRef.current = cpt;
  serviceTypeRef.current = serviceType;

  // Core search logic — accepts optional override values so callers that just
  // set state can pass the new values directly without waiting for a re-render.
  const runSearch = useCallback(
    async (overrides?: { icd10?: string; cpt?: string; serviceType?: string }) => {
      const resolvedIcd10 = overrides?.icd10 ?? icd10Ref.current;
      const resolvedCpt = overrides?.cpt ?? cptRef.current;
      const resolvedServiceType = overrides?.serviceType ?? serviceTypeRef.current;

      if (!resolvedIcd10 && !resolvedCpt) {
        setError('Enter at least one ICD-10 or CPT code.');
        return;
      }
      setError('');
      setLoading(true);
      setSearched(true);
      setShowSecondary(false);
      try {
        const params = new URLSearchParams();
        if (resolvedIcd10) params.set('icd10', resolvedIcd10.trim());
        if (resolvedCpt) params.set('cpt', resolvedCpt.trim());
        if (resolvedServiceType) params.set('serviceType', resolvedServiceType);
        const resp = await fetch(`/api/criteria-tree?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: TreeResult[] = await resp.json();
        setResults(data);
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

  // Called by QuickReferencePanel when the user selects a code or clicks "Use".
  // We update state immediately AND pass the new values directly to runSearch so
  // the search fires with the right values without waiting for React to flush.
  function handleApplyCode(icd10Code?: string, cptCode?: string, serviceTypeOverride?: string) {
    // For clinical combos, replace rather than append ICD-10 (full combo sets all three)
    const isFullCombo = icd10Code !== undefined && cptCode !== undefined && serviceTypeOverride !== undefined;
    const nextIcd10 = isFullCombo
      ? icd10Code
      : icd10Code
        ? icd10Ref.current ? `${icd10Ref.current}, ${icd10Code}` : icd10Code
        : icd10Ref.current;

    const nextCpt = cptCode ?? cptRef.current;
    const nextServiceType = serviceTypeOverride ?? serviceTypeRef.current;

    setIcd10(nextIcd10);
    if (cptCode !== undefined) setCpt(nextCpt);
    if (serviceTypeOverride !== undefined) setServiceType(nextServiceType);

    void runSearch({ icd10: nextIcd10, cpt: nextCpt, serviceType: nextServiceType });
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-50">

      {/* ── HEADER: compact single-line bar like CaseReview ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
        <h1 className="text-base font-semibold text-slate-900 shrink-0">Coverage Criteria Check</h1>

        {/* Inputs inline */}
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <input
            value={icd10}
            onChange={e => setIcd10(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void runSearch(); }}
            placeholder="ICD-10 (e.g. I50.9)"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-40 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            value={cpt}
            onChange={e => setCpt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void runSearch(); }}
            placeholder="CPT (e.g. 93306)"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-32 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={serviceType}
            onChange={e => setServiceType(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Any Setting</option>
            <option value="INPATIENT">Inpatient</option>
            <option value="OUTPATIENT">Outpatient</option>
            <option value="DME">DME</option>
            <option value="HOME_HEALTH">Home Health</option>
          </select>
        </div>

        {/* Quick picks */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-400 shrink-0">Quick:</span>
          {QUICK_CODES.map(q => (
            <button
              key={q.label}
              type="button"
              onClick={() => applyQuickCode(q)}
              className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Error inline */}
        {error && (
          <span className="text-xs text-red-600 bg-red-50 rounded-md px-2 py-1 shrink-0">{error}</span>
        )}

        {/* Search button */}
        <button
          onClick={() => void runSearch()}
          disabled={loading || (!icd10.trim() && !cpt.trim())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 shrink-0 transition-colors"
        >
          <Search size={14} />
          {loading ? 'Searching...' : 'Check Coverage'}
        </button>
      </div>

      {/* ── BODY: two panels ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Quick Reference (fixed width, independently scrollable) */}
        <div className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-y-auto p-4 gap-4">
          <QuickReferencePanel onApplyCode={handleApplyCode} />
        </div>

        {/* RIGHT: Results (flex-1, scrollable) */}
        <div className="flex-1 overflow-y-auto p-6">

          {loading && (
            <div className="text-center py-12 text-sm text-slate-500">Loading criteria...</div>
          )}

          {!loading && searched && results !== null && results.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-slate-500 text-sm">No coverage criteria found for these codes.</p>
              <p className="text-slate-400 text-xs mt-1">
                Try a different ICD-10 code, or run the CMS ingestion to load more policies.
              </p>
            </div>
          )}

          {!loading && results && results.length > 0 && (() => {
            const primary = results.filter(r => r.isPrimary !== false && (r.relevanceScore ?? 100) >= 80);
            const secondary = results.filter(r => !primary.includes(r));

            const renderResult = (result: TreeResult, i: number) => (
              <div key={`${i}-${icd10}-${cpt}`} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {result.criteriaSet.title}
                  </span>
                  {(result.relevanceScore ?? 100) >= 90 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">Best Match</span>
                  )}
                </div>
                <CriteriaTreeView
                  tree={result.tree}
                  policyTitle={result.policy.title}
                  cmsId={result.policy.cmsId}
                  scopeSetting={result.criteriaSet.scopeSetting}
                  scopeRequestType={result.criteriaSet.scopeRequestType}
                  cqlLibraryFhirId={result.criteriaSet.cqlLibraryFhirId}
                />
              </div>
            );

            return (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  {primary.length} primary {primary.length === 1 ? 'match' : 'matches'}
                  {secondary.length > 0 && ` · ${secondary.length} related`}
                </p>

                {/* Primary results */}
                <div className="space-y-6">{primary.map((r, i) => renderResult(r, i))}</div>

                {/* Secondary / comorbidity results — collapsed by default */}
                {secondary.length > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowSecondary(s => !s)}
                      className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      <ChevronDown size={14} className={`transition-transform ${showSecondary ? 'rotate-180' : ''}`} />
                      {showSecondary ? 'Hide' : 'Show'} {secondary.length} additional polic{secondary.length === 1 ? 'y' : 'ies'} where this code appears as a comorbidity
                    </button>
                    {showSecondary && (
                      <div className="mt-4 space-y-6 opacity-80">
                        {secondary.map((r, i) => renderResult(r, primary.length + i))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Empty state before first search */}
          {!loading && !searched && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <p className="text-slate-400 text-sm">
                Enter codes above or pick from the Quick Reference panel to check coverage criteria.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
