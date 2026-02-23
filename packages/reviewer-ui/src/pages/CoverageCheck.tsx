import { useState, useCallback, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import CriteriaTreeView, { type TreeNode } from '../components/CriteriaTreeView.tsx';
import QuickReferencePanel from '../components/QuickReferencePanel.tsx';

// Known common ICD-10 codes for quick selection
const QUICK_CODES = [
  { label: 'Acute Respiratory Failure', icd10: 'J96.00', cpt: '94660', serviceType: 'INPATIENT' },
  { label: 'Heart Failure', icd10: 'I50.9', serviceType: 'INPATIENT' },
  { label: 'Hip Osteoarthritis', icd10: 'M16.11', cpt: '27130', serviceType: 'OUTPATIENT' },
  { label: 'Type 2 Diabetes', icd10: 'E11.9', serviceType: 'OUTPATIENT' },
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

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    void runSearch();
  }

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
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Coverage Criteria Check</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter a diagnosis or procedure code to see the coverage criteria decision tree — no patient
          required.
        </p>
      </div>

      {/* Search form */}
      <form
        onSubmit={handleSearch}
        className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 mb-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ICD-10-CM Code(s)
            </label>
            <input
              value={icd10}
              onChange={e => setIcd10(e.target.value)}
              placeholder="e.g. J96.00, J44.1"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-0.5 text-[11px] text-slate-400">Comma-separate multiple codes</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">CPT/HCPCS Code</label>
            <input
              value={cpt}
              onChange={e => setCpt(e.target.value)}
              placeholder="e.g. 94660"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Care Setting</label>
            <div className="relative">
              <select
                value={serviceType}
                onChange={e => setServiceType(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="">Any</option>
                <option value="INPATIENT">Inpatient</option>
                <option value="OUTPATIENT">Outpatient</option>
                <option value="DME">DME</option>
                <option value="HOME_HEALTH">Home Health</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-md px-3 py-1.5">{error}</p>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-slate-400 self-center">Quick:</span>
            {QUICK_CODES.map(q => (
              <button
                key={q.label}
                type="button"
                onClick={() => applyQuickCode(q)}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
          >
            <Search size={14} />
            {loading ? 'Searching...' : 'Check Coverage'}
          </button>
        </div>
      </form>

      {/* Two-column layout: results (left) + quick reference panel (right) */}
      <div className="flex gap-6 items-start">
        {/* LEFT: criteria tree results */}
        <div className="flex-1 min-w-0">
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

        {/* RIGHT: quick reference panel — always visible */}
        <div className="w-80 shrink-0">
          <QuickReferencePanel onApplyCode={handleApplyCode} />
        </div>
      </div>
    </div>
  );
}
