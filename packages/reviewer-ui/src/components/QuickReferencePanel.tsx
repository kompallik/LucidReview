import { useState } from 'react';
import { ChevronDown, ChevronRight, Zap } from 'lucide-react';
import CodeLookup, { type Code, ICD10_CODES, CPT_CODES } from './CodeLookup.tsx';

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
  onApplyCode: (icd10?: string, cpt?: string) => void;
}

interface CategorySectionProps {
  cat: QuickCategory;
  onApplyCode: (icd10?: string, cpt?: string) => void;
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

      {/* Quick categories */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} className="text-amber-500" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Quick Reference
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
