import { useState, useMemo } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';

interface Code {
  code: string;
  type: 'ICD-10' | 'CPT' | 'HCPCS';
  description: string;
  category?: string;
}

// Top ICD-10 codes most commonly seen in UM authorization requests
const ICD10_CODES: Code[] = [
  // Respiratory
  { code: 'J96.00', type: 'ICD-10', description: 'Acute respiratory failure, unspecified', category: 'Respiratory' },
  { code: 'J96.01', type: 'ICD-10', description: 'Acute respiratory failure with hypoxia', category: 'Respiratory' },
  { code: 'J44.1',  type: 'ICD-10', description: 'COPD with acute exacerbation', category: 'Respiratory' },
  { code: 'J44.0',  type: 'ICD-10', description: 'COPD with acute lower respiratory infection', category: 'Respiratory' },
  { code: 'J18.9',  type: 'ICD-10', description: 'Pneumonia, unspecified organism', category: 'Respiratory' },
  { code: 'J45.901',type: 'ICD-10', description: 'Unspecified asthma, uncomplicated', category: 'Respiratory' },
  // Cardiac
  { code: 'I50.9',  type: 'ICD-10', description: 'Heart failure, unspecified', category: 'Cardiac' },
  { code: 'I50.20', type: 'ICD-10', description: 'Systolic (congestive) heart failure, unspecified', category: 'Cardiac' },
  { code: 'I21.9',  type: 'ICD-10', description: 'Acute myocardial infarction, unspecified', category: 'Cardiac' },
  { code: 'I20.0',  type: 'ICD-10', description: 'Unstable angina', category: 'Cardiac' },
  { code: 'I48.91', type: 'ICD-10', description: 'Unspecified atrial fibrillation', category: 'Cardiac' },
  { code: 'I10',    type: 'ICD-10', description: 'Essential (primary) hypertension', category: 'Cardiac' },
  // Neurological
  { code: 'I63.9',  type: 'ICD-10', description: 'Cerebral infarction, unspecified', category: 'Neurological' },
  { code: 'G20',    type: 'ICD-10', description: "Parkinson's disease", category: 'Neurological' },
  { code: 'G35',    type: 'ICD-10', description: 'Multiple sclerosis', category: 'Neurological' },
  { code: 'G30.9',  type: 'ICD-10', description: "Alzheimer's disease, unspecified", category: 'Neurological' },
  // Diabetes/Endocrine
  { code: 'E11.9',  type: 'ICD-10', description: 'Type 2 diabetes mellitus without complications', category: 'Endocrine' },
  { code: 'E10.9',  type: 'ICD-10', description: 'Type 1 diabetes mellitus without complications', category: 'Endocrine' },
  { code: 'E11.65', type: 'ICD-10', description: 'Type 2 diabetes with hyperglycemia', category: 'Endocrine' },
  { code: 'E66.01', type: 'ICD-10', description: 'Morbid (severe) obesity due to excess calories', category: 'Endocrine' },
  // Renal
  { code: 'N18.6',  type: 'ICD-10', description: 'End stage renal disease', category: 'Renal' },
  { code: 'N18.5',  type: 'ICD-10', description: 'Chronic kidney disease, stage 5', category: 'Renal' },
  { code: 'N39.0',  type: 'ICD-10', description: 'Urinary tract infection, site not specified', category: 'Renal' },
  // Musculoskeletal
  { code: 'M16.11', type: 'ICD-10', description: 'Primary osteoarthritis, right hip', category: 'Musculoskeletal' },
  { code: 'M17.11', type: 'ICD-10', description: 'Primary osteoarthritis, right knee', category: 'Musculoskeletal' },
  { code: 'M54.50', type: 'ICD-10', description: 'Low back pain, unspecified', category: 'Musculoskeletal' },
  { code: 'M80.00', type: 'ICD-10', description: 'Osteoporosis with pathological fracture', category: 'Musculoskeletal' },
  // Sepsis/Infection
  { code: 'A41.9',  type: 'ICD-10', description: 'Sepsis, unspecified organism', category: 'Sepsis' },
  { code: 'A41.01', type: 'ICD-10', description: 'Sepsis due to Methicillin susceptible Staph aureus', category: 'Sepsis' },
  // Transplant
  { code: 'Z94.0',  type: 'ICD-10', description: 'Kidney transplant status', category: 'Transplant' },
  { code: 'Z94.1',  type: 'ICD-10', description: 'Heart transplant status', category: 'Transplant' },
  { code: 'K72.10', type: 'ICD-10', description: 'Acute and subacute hepatic failure without coma', category: 'Transplant' },
  // Cancer
  { code: 'C34.90', type: 'ICD-10', description: 'Malignant neoplasm of bronchus and lung, unspecified', category: 'Oncology' },
  { code: 'C50.919',type: 'ICD-10', description: 'Malignant neoplasm of unspecified site of unspecified female breast', category: 'Oncology' },
  { code: 'C61',    type: 'ICD-10', description: 'Malignant neoplasm of prostate', category: 'Oncology' },
  { code: 'C80.1',  type: 'ICD-10', description: 'Malignant (primary) neoplasm, unspecified', category: 'Oncology' },
  // Mental Health
  { code: 'F32.9',  type: 'ICD-10', description: 'Major depressive disorder, single episode, unspecified', category: 'Mental Health' },
  { code: 'F33.9',  type: 'ICD-10', description: 'Major depressive disorder, recurrent, unspecified', category: 'Mental Health' },
  { code: 'F20.9',  type: 'ICD-10', description: 'Schizophrenia, unspecified', category: 'Mental Health' },
  { code: 'F41.1',  type: 'ICD-10', description: 'Generalized anxiety disorder', category: 'Mental Health' },
];

// Top CPT/HCPCS codes commonly seen in UM
const CPT_CODES: Code[] = [
  // E&M
  { code: '99213', type: 'CPT', description: 'Office or other outpatient visit, level 3', category: 'E&M' },
  { code: '99214', type: 'CPT', description: 'Office or other outpatient visit, level 4', category: 'E&M' },
  { code: '99233', type: 'CPT', description: 'Subsequent hospital care, level 3', category: 'E&M' },
  { code: '99232', type: 'CPT', description: 'Subsequent hospital care, level 2', category: 'E&M' },
  // Cardiac
  { code: '93306', type: 'CPT', description: 'Echocardiography, transthoracic, complete', category: 'Cardiac' },
  { code: '93015', type: 'CPT', description: 'Cardiovascular stress test', category: 'Cardiac' },
  { code: '92928', type: 'CPT', description: 'Percutaneous transcatheter placement of intracoronary stent', category: 'Cardiac' },
  { code: '33533', type: 'CPT', description: 'CABG using arterial graft, single', category: 'Cardiac' },
  // Orthopedic
  { code: '27447', type: 'CPT', description: 'Total knee replacement', category: 'Orthopedic' },
  { code: '27130', type: 'CPT', description: 'Total hip arthroplasty', category: 'Orthopedic' },
  { code: '29827', type: 'CPT', description: 'Arthroscopy, shoulder, with rotator cuff repair', category: 'Orthopedic' },
  { code: '22612', type: 'CPT', description: 'Arthrodesis, posterior, lumbar spine', category: 'Orthopedic' },
  // Respiratory
  { code: '94660', type: 'CPT', description: 'CPAP/BiPAP ventilation initiation and management', category: 'Respiratory' },
  { code: '31500', type: 'CPT', description: 'Intubation, endotracheal, emergency procedure', category: 'Respiratory' },
  // Neurology
  { code: '61510', type: 'CPT', description: 'Craniotomy for excision of brain tumor', category: 'Neurology' },
  { code: '63030', type: 'CPT', description: 'Laminotomy with decompression of nerve root, lumbar', category: 'Neurology' },
  // Oncology
  { code: '96413', type: 'CPT', description: 'Chemotherapy administration, IV infusion, up to 1 hour', category: 'Oncology' },
  { code: '77301', type: 'CPT', description: 'Intensity modulated radiotherapy plan', category: 'Oncology' },
  { code: '19307', type: 'CPT', description: 'Mastectomy, modified radical', category: 'Oncology' },
  // Dialysis
  { code: '90935', type: 'CPT', description: 'Hemodialysis, one evaluation', category: 'Renal' },
  { code: '90945', type: 'CPT', description: 'Dialysis procedure other than hemodialysis', category: 'Renal' },
  // DME
  { code: 'E0601', type: 'HCPCS', description: 'Continuous airway pressure device (CPAP)', category: 'DME' },
  { code: 'E1390', type: 'HCPCS', description: 'Oxygen concentrator, single delivery port', category: 'DME' },
  { code: 'K0001', type: 'HCPCS', description: 'Standard wheelchair', category: 'DME' },
  { code: 'A4253', type: 'HCPCS', description: 'Blood glucose test or reagent strips', category: 'DME' },
  // Mental Health
  { code: '90837', type: 'CPT', description: 'Psychotherapy, 60 minutes with patient', category: 'Mental Health' },
  { code: '90834', type: 'CPT', description: 'Psychotherapy, 45 minutes with patient', category: 'Mental Health' },
  { code: '90853', type: 'CPT', description: 'Group psychotherapy', category: 'Mental Health' },
  // Transplant
  { code: '50360', type: 'CPT', description: 'Renal allotransplantation, implantation of graft', category: 'Transplant' },
  { code: '33945', type: 'CPT', description: 'Heart transplant, with or without recipient cardiectomy', category: 'Transplant' },
];

const ALL_CODES = [...ICD10_CODES, ...CPT_CODES];

interface CodeLookupProps {
  onSelectCode?: (code: Code) => void;
}

export default function CodeLookup({ onSelectCode }: CodeLookupProps) {
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState<'ALL' | 'ICD-10' | 'CPT' | 'HCPCS'>('ALL');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return ALL_CODES.filter(
      c =>
        (activeType === 'ALL' || c.type === activeType) &&
        (
          c.code.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          (c.category?.toLowerCase().includes(q) ?? false)
        ),
    ).slice(0, 12);
  }, [query, activeType]);

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
        Code Lookup
      </p>

      {/* Type filter pills */}
      <div className="flex gap-1 mb-2">
        {(['ALL', 'ICD-10', 'CPT', 'HCPCS'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
              activeType === t
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="relative mb-2">
        <Search size={12} className="absolute left-2.5 top-2 text-slate-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search code or description..."
          className="w-full rounded-lg border border-slate-200 pl-7 pr-7 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {results.map(c => (
            <button
              key={c.code}
              onClick={() => onSelectCode?.(c)}
              className="w-full text-left flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-blue-50 transition-colors group"
            >
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                  c.type === 'ICD-10'
                    ? 'bg-violet-100 text-violet-700'
                    : c.type === 'CPT'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {c.type}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-800">{c.code}</span>
                  <ArrowRight
                    size={10}
                    className="text-slate-300 group-hover:text-blue-400 transition-colors"
                  />
                </div>
                <p className="text-[10px] text-slate-500 truncate">{c.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {query && results.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-3">
          No codes found for &ldquo;{query}&rdquo;
        </p>
      )}
    </div>
  );
}

export type { Code };
export { ICD10_CODES, CPT_CODES };
