import { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import CriteriaTreeView, { type TreeNode } from '../components/CriteriaTreeView.tsx';

// Known common ICD-10 codes for quick selection
const QUICK_CODES = [
  { label: 'Acute Respiratory Failure', icd10: 'J96.00', cpt: '94660', serviceType: 'INPATIENT' },
  { label: 'Heart Failure', icd10: 'I50.9', serviceType: 'INPATIENT' },
  { label: 'Hip Osteoarthritis', icd10: 'M16.11', cpt: '27130', serviceType: 'OUTPATIENT' },
  { label: 'Type 2 Diabetes', icd10: 'E11.9', serviceType: 'OUTPATIENT' },
];

interface TreeResult {
  policy: { id: string; title: string; policyType: string; cmsId: string | null; sourceUrl: string | null };
  criteriaSet: { id: string; criteriaSetId: string; title: string; scopeSetting: string; scopeRequestType: string; cqlLibraryFhirId: string | null };
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

  const token = localStorage.getItem('lucidreview_token');

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!icd10 && !cpt) { setError('Enter at least one ICD-10 or CPT code.'); return; }
    setError('');
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (icd10) params.set('icd10', icd10.trim());
      if (cpt) params.set('cpt', cpt.trim());
      if (serviceType) params.set('serviceType', serviceType);
      const resp = await fetch(`/api/criteria-tree?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: TreeResult[] = await resp.json();
      setResults(data);
    } catch {
      setError('Failed to fetch criteria. Check that the server is running.');
    } finally {
      setLoading(false);
    }
  }

  function applyQuickCode(q: typeof QUICK_CODES[number]) {
    setIcd10(q.icd10 || '');
    setCpt(q.cpt || '');
    setServiceType(q.serviceType || '');
    setResults(null);
    setSearched(false);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Coverage Criteria Check</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter a diagnosis or procedure code to see the coverage criteria decision tree — no patient required.
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">ICD-10-CM Code(s)</label>
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
              <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
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

      {/* Results */}
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

      {!loading && results && results.length > 0 && (
        <div className="space-y-6">
          <p className="text-xs text-slate-500">
            {results.length} criteria set{results.length !== 1 ? 's' : ''} found
          </p>
          {results.map((result, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {result.criteriaSet.title}
                </span>
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
          ))}
        </div>
      )}
    </div>
  );
}
