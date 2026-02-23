import { useState } from 'react';
import { ChevronDown, ChevronRight, Zap, Stethoscope } from 'lucide-react';
import CodeLookup, { type Code, ICD10_CODES, CPT_CODES } from './CodeLookup.tsx';

// Validated clinical combos: diagnosis + procedure + care setting
// All 22 verified to return at least 1 criteria decision tree
export const CLINICAL_COMBOS = [
  // ── Cardiac ──────────────────────────────────────────────────────────────
  { label: 'Heart Failure + Echo',           icd10: 'I50.9',   cpt: '93306', setting: 'INPATIENT',   category: 'Cardiac'      },
  { label: 'Acute MI + PCI/Stent',           icd10: 'I21.9',   cpt: '92928', setting: 'INPATIENT',   category: 'Cardiac'      },
  { label: 'A-Fib + Cardioversion',          icd10: 'I48.91',  cpt: '92960', setting: 'INPATIENT',   category: 'Cardiac'      },
  // ── Respiratory ──────────────────────────────────────────────────────────
  { label: 'ARF + BiPAP',                    icd10: 'J96.00',  cpt: '94660', setting: 'INPATIENT',   category: 'Respiratory'  },
  { label: 'COPD Exacerbation + BiPAP',      icd10: 'J44.1',   cpt: '94660', setting: 'INPATIENT',   category: 'Respiratory'  },
  { label: 'Sleep Apnea + CPAP',             icd10: 'G47.33',  cpt: 'E0601', setting: 'DME',          category: 'Respiratory'  },
  { label: 'COPD + Home Oxygen',             icd10: 'J44.9',   cpt: 'E1390', setting: 'HOME_HEALTH',  category: 'Respiratory'  },
  // ── Orthopedic ───────────────────────────────────────────────────────────
  { label: 'Hip OA + Total Hip (27130)',     icd10: 'M16.11',  cpt: '27130', setting: 'INPATIENT',   category: 'Orthopedic'   },
  { label: 'Knee OA + Total Knee (27447)',   icd10: 'M17.11',  cpt: '27447', setting: 'INPATIENT',   category: 'Orthopedic'   },
  { label: 'Back Pain + Facet Injection',    icd10: 'M54.50',  cpt: '64493', setting: 'OUTPATIENT',  category: 'Orthopedic'   },
  // ── Neurological ─────────────────────────────────────────────────────────
  { label: 'Stroke + Thrombectomy',          icd10: 'I63.9',   cpt: '37184', setting: 'INPATIENT',   category: 'Neurology'    },
  { label: 'Depression + Psychotherapy',     icd10: 'F32.9',   cpt: '90837', setting: 'OUTPATIENT',  category: 'Mental Health'},
  // ── Oncology ─────────────────────────────────────────────────────────────
  { label: 'Lung Cancer + Chemotherapy',     icd10: 'C34.90',  cpt: '96413', setting: 'OUTPATIENT',  category: 'Oncology'     },
  { label: 'Breast Cancer + IMRT',           icd10: 'C50.919', cpt: '77301', setting: 'OUTPATIENT',  category: 'Oncology'     },
  // ── Renal/Transplant ─────────────────────────────────────────────────────
  { label: 'ESRD + Hemodialysis',            icd10: 'N18.6',   cpt: '90935', setting: 'OUTPATIENT',  category: 'Renal'        },
  { label: 'Kidney Transplant',              icd10: 'Z94.0',   cpt: '50360', setting: 'INPATIENT',   category: 'Transplant'   },
  { label: 'Liver Failure + Transplant',     icd10: 'K72.10',  cpt: '47135', setting: 'INPATIENT',   category: 'Transplant'   },
  // ── Diabetes/GI ──────────────────────────────────────────────────────────
  { label: 'T2 Diabetes + Blood Glucose',    icd10: 'E11.9',   cpt: '82947', setting: 'OUTPATIENT',  category: 'Endocrine'    },
  { label: 'Diabetes + CGM Initiation',      icd10: 'E11.65',  cpt: '95250', setting: 'OUTPATIENT',  category: 'Endocrine'    },
  { label: 'Diverticulosis + Colonoscopy',   icd10: 'K57.30',  cpt: '45385', setting: 'OUTPATIENT',  category: 'GI'           },
  // ── Sepsis/Obesity ───────────────────────────────────────────────────────
  { label: 'Sepsis + Central Line',          icd10: 'A41.9',   cpt: '36555', setting: 'INPATIENT',   category: 'Sepsis'       },
  { label: 'Morbid Obesity + Bariatric',     icd10: 'E66.01',  cpt: '43644', setting: 'INPATIENT',   category: 'Endocrine'    },
] as const;

// Top codes by UM volume — grouped for quick access
const QUICK_CATEGORIES = [
  {
    label: 'High-Volume Inpatient',
    icon: '🏥',
    codes: ICD10_CODES.filter(c =>
      ['J96.00', 'I50.9', 'A41.9', 'J44.1', 'J18.9', 'I21.9', 'I63.9', 'N18.6'].includes(c.code),
    ),
  },
  {
    label: 'Diabetes & DME',
    icon: '💉',
    codes: [
      ...ICD10_CODES.filter(c => c.category === 'Endocrine'),
      ...CPT_CODES.filter(c => ['E0601', 'A4253', 'K0001'].includes(c.code)),
    ],
  },
  {
    label: 'Cardiac Procedures',
    icon: '❤️',
    codes: [
      ...ICD10_CODES.filter(c => c.category === 'Cardiac'),
      ...CPT_CODES.filter(c => c.category === 'Cardiac'),
    ].slice(0, 8),
  },
  {
    label: 'Orthopedic Surgery',
    icon: '🦴',
    codes: [
      ...ICD10_CODES.filter(c => c.category === 'Musculoskeletal'),
      ...CPT_CODES.filter(c => c.category === 'Orthopedic'),
    ],
  },
  {
    label: 'Transplant',
    icon: '🔬',
    codes: [
      ...ICD10_CODES.filter(c => c.category === 'Transplant'),
      ...CPT_CODES.filter(c => c.category === 'Transplant'),
    ],
  },
  {
    label: 'Mental Health',
    icon: '🧠',
    codes: [
      ...ICD10_CODES.filter(c => c.category === 'Mental Health'),
      ...CPT_CODES.filter(c => c.category === 'Mental Health'),
    ],
  },
  {
    label: 'Oncology',
    icon: '🎗️',
    codes: [
      ...ICD10_CODES.filter(c => c.category === 'Oncology'),
      ...CPT_CODES.filter(c => c.category === 'Oncology'),
    ],
  },
];

type QuickCategory = (typeof QUICK_CATEGORIES)[number];

interface QuickReferencePanelProps {
  onApplyCode: (icd10?: string, cpt?: string, serviceType?: string) => void;
}

interface CategorySectionProps {
  cat: QuickCategory;
  onApplyCode: (icd10?: string, cpt?: string, serviceType?: string) => void;
}

function CategorySection({ cat, onApplyCode }: CategorySectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-sm">{cat.icon}</span>
        <span className="text-xs font-semibold text-slate-700 flex-1">{cat.label}</span>
        <span className="text-[10px] text-slate-400">{cat.codes.length}</span>
        {open ? (
          <ChevronDown size={12} className="text-slate-400" />
        ) : (
          <ChevronRight size={12} className="text-slate-400" />
        )}
      </button>

      {open && (
        <div className="divide-y divide-slate-50">
          {cat.codes.map(c => (
            <div
              key={c.code}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50/60 group"
            >
              <span
                className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${
                  c.type === 'ICD-10'
                    ? 'bg-violet-100 text-violet-700'
                    : c.type === 'CPT'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {c.code}
              </span>
              <span className="flex-1 text-[10px] text-slate-600 truncate">{c.description}</span>
              <button
                onClick={() =>
                  onApplyCode(
                    c.type === 'ICD-10' ? c.code : undefined,
                    c.type !== 'ICD-10' ? c.code : undefined,
                  )
                }
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-medium"
              >
                Use
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SETTING_BADGE: Record<string, string> = {
  INPATIENT:   'bg-blue-100 text-blue-700',
  OUTPATIENT:  'bg-emerald-100 text-emerald-700',
  DME:         'bg-amber-100 text-amber-700',
  HOME_HEALTH: 'bg-violet-100 text-violet-700',
};

function CombosSection({ onApplyCode }: { onApplyCode: (icd10?: string, cpt?: string, serviceType?: string) => void }) {
  const [open, setOpen] = useState(true);
  // Group by category
  const categories = [...new Set(CLINICAL_COMBOS.map(c => c.category))];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 mb-2 text-left"
      >
        <Stethoscope size={13} className="text-emerald-500 shrink-0" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex-1">
          Clinical Combos — Diag + Procedure + Setting
        </p>
        <span className="text-[10px] text-slate-400">{CLINICAL_COMBOS.length}</span>
        {open ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronRight size={12} className="text-slate-400" />}
      </button>

      {open && (
        <div className="space-y-3">
          {categories.map(cat => (
            <div key={cat}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">{cat}</p>
              <div className="space-y-0.5">
                {CLINICAL_COMBOS.filter(c => c.category === cat).map(combo => (
                  <div
                    key={combo.label}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-blue-50/60 group cursor-pointer"
                    onClick={() => onApplyCode(combo.icd10, combo.cpt, combo.setting)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-slate-700 truncate">{combo.label}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] font-mono text-slate-500">{combo.icd10}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-[9px] font-mono text-slate-500">{combo.cpt}</span>
                        <span className={`ml-1 rounded px-1 py-0.5 text-[8px] font-bold ${SETTING_BADGE[combo.setting] ?? 'bg-slate-100 text-slate-600'}`}>
                          {combo.setting.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <button
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-medium"
                    >
                      Try
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function QuickReferencePanel({ onApplyCode }: QuickReferencePanelProps) {
  const handleLookupSelect = (code: Code) => {
    onApplyCode(
      code.type === 'ICD-10' ? code.code : undefined,
      code.type !== 'ICD-10' ? code.code : undefined,
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Code lookup search */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <CodeLookup onSelectCode={handleLookupSelect} />
      </div>

      {/* Clinical combos — diagnosis + procedure + setting */}
      <CombosSection onApplyCode={onApplyCode} />

      {/* Quick categories — individual codes */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} className="text-amber-500" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Code Reference
          </p>
        </div>
        <div className="space-y-1.5">
          {QUICK_CATEGORIES.map(cat => (
            <CategorySection key={cat.label} cat={cat} onApplyCode={onApplyCode} />
          ))}
        </div>
      </div>
    </div>
  );
}
