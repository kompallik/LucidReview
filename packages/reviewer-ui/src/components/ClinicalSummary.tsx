import { Stethoscope, Activity, Pill, Building, FlaskConical, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/cn.ts';
import type { ClinicalFact } from '../api/client.ts';

const CATEGORY_CONFIG: Record<string, { icon: typeof Stethoscope; color: string }> = {
  Diagnosis: { icon: Stethoscope, color: 'text-red-500' },
  'Vital Signs': { icon: Activity, color: 'text-blue-500' },
  'Lab Result': { icon: FlaskConical, color: 'text-amber-500' },
  Procedure: { icon: FileText, color: 'text-teal-500' },
  Medication: { icon: Pill, color: 'text-purple-500' },
  Provider: { icon: Building, color: 'text-slate-500' },
};

function SourceTag({ source }: { source: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
        source === 'STRUCTURED'
          ? 'bg-blue-50 text-blue-600'
          : 'bg-purple-50 text-purple-600',
      )}
    >
      {source}
    </span>
  );
}

interface ClinicalSummaryProps {
  facts: ClinicalFact[];
}

export default function ClinicalSummary({ facts }: ClinicalSummaryProps) {
  // Group facts by category
  const grouped = facts.reduce<Record<string, ClinicalFact[]>>((acc, fact) => {
    const key = fact.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(fact);
    return acc;
  }, {});

  const categoryOrder = ['Diagnosis', 'Vital Signs', 'Lab Result', 'Procedure', 'Medication', 'Provider'];
  const orderedCategories = categoryOrder.filter((c) => grouped[c]);

  return (
    <div>
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">Clinical Summary</h3>
      </div>

      <div className="divide-y divide-slate-100">
        {orderedCategories.map((category) => {
          const config = CATEGORY_CONFIG[category] ?? { icon: FileText, color: 'text-slate-500' };
          const Icon = config.icon;
          const items = grouped[category]!;

          return (
            <div key={category} className="px-4 py-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={13} className={config.color} />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {category}
                </span>
              </div>

              <div className="ml-[21px] space-y-1">
                {items.map((fact, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-800">
                        {fact.code && (
                          <code className="font-mono text-[11px] text-slate-500 mr-1.5">{fact.code}</code>
                        )}
                        {fact.display}
                      </span>
                      {fact.value && (
                        <span className="ml-2 font-semibold text-slate-900">
                          {fact.value}
                          {fact.unit && <span className="font-normal text-slate-500 ml-0.5">{fact.unit}</span>}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {fact.date && (
                        <span className="text-[10px] text-slate-400">
                          {format(new Date(fact.date), 'MMM d HH:mm')}
                        </span>
                      )}
                      <SourceTag source={fact.source} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
