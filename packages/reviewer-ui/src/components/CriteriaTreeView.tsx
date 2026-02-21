import { useState } from 'react';
import { ChevronDown, ChevronRight, Activity, FlaskConical, Stethoscope, FileText, Shield, Cpu } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TreeNode {
  id: string;
  label: string;
  description?: string;
  type: 'AND' | 'OR' | 'LEAF';
  dataType?: 'vital' | 'lab' | 'diagnosis' | 'procedure' | 'coverage' | 'clinical_note';
  threshold?: {
    operator: '>' | '<' | '>=' | '<=' | '==' | 'in';
    value?: number | string | string[];
    unit?: string;
    loinc?: string;
    display?: string;
  };
  cqlExpression?: string;
  required: boolean;
  clinicalNotes?: string;
  children?: TreeNode[];
}

// ─── Data-type icon / label maps ─────────────────────────────────────────────

const DATA_TYPE_ICON: Record<string, React.ReactNode> = {
  vital: <Activity size={12} />,
  lab: <FlaskConical size={12} />,
  diagnosis: <Stethoscope size={12} />,
  procedure: <Cpu size={12} />,
  coverage: <Shield size={12} />,
  clinical_note: <FileText size={12} />,
};

const DATA_TYPE_LABEL: Record<string, string> = {
  vital: 'Vital',
  lab: 'Lab',
  diagnosis: 'Diagnosis',
  procedure: 'Procedure',
  coverage: 'Coverage',
  clinical_note: 'Clinical Note',
};

// ─── TreeNodeView (recursive) ────────────────────────────────────────────────

interface TreeNodeProps {
  node: TreeNode;
  depth?: number;
}

function TreeNodeView({ node, depth = 0 }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  const borderColor =
    node.type === 'AND' ? 'border-blue-400' :
    node.type === 'OR'  ? 'border-amber-400' :
    node.required       ? 'border-emerald-400' : 'border-slate-300';

  const typeBadge =
    node.type === 'AND' ? (
      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700">ALL of</span>
    ) : node.type === 'OR' ? (
      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700">ANY of</span>
    ) : null;

  return (
    <div className={`relative ${depth > 0 ? 'ml-5' : ''}`}>
      {/* Vertical connecting line */}
      {depth > 0 && (
        <div className="absolute -left-3 top-0 bottom-0 w-px bg-slate-200" />
      )}
      {depth > 0 && (
        <div className="absolute -left-3 top-4 w-3 h-px bg-slate-200" />
      )}

      <div className={`mb-2 rounded-lg border-l-4 ${borderColor} bg-white border border-slate-100 shadow-sm`}>
        <div
          className={`flex items-start gap-2 px-3 py-2.5 ${hasChildren ? 'cursor-pointer select-none' : ''}`}
          onClick={() => hasChildren && setExpanded((e) => !e)}
        >
          {/* Expand/collapse chevron */}
          <div className="mt-0.5 shrink-0 text-slate-400 w-4">
            {hasChildren ? (
              expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : null}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {typeBadge}
              {node.dataType && (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600">
                  {DATA_TYPE_ICON[node.dataType]}
                  {DATA_TYPE_LABEL[node.dataType]}
                </span>
              )}
              <span className="text-sm font-medium text-slate-800">{node.label}</span>
              {!node.required && (
                <span className="rounded px-1 py-0.5 text-[10px] bg-slate-100 text-slate-500">optional</span>
              )}
            </div>

            {node.description && (
              <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{node.description}</p>
            )}

            {/* Threshold badge */}
            {node.threshold && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-[11px] text-slate-700 font-mono">
                {node.threshold.display || (
                  <>
                    {node.threshold.operator}{' '}
                    {Array.isArray(node.threshold.value)
                      ? node.threshold.value.join(', ')
                      : node.threshold.value}
                    {node.threshold.unit && ` ${node.threshold.unit}`}
                  </>
                )}
                {node.threshold.loinc && (
                  <span className="ml-1 text-slate-400">LOINC {node.threshold.loinc}</span>
                )}
              </div>
            )}

            {node.cqlExpression && (
              <div className="mt-1 text-[10px] font-mono text-violet-600 bg-violet-50 rounded px-2 py-0.5">
                CQL: {node.cqlExpression}
              </div>
            )}

            {node.clinicalNotes && (
              <p className="mt-1 text-[11px] text-slate-400 italic">{node.clinicalNotes}</p>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="ml-2">
          {node.children!.map((child) => (
            <TreeNodeView key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CriteriaTreeView (top-level) ───────────────────────────────────────────

interface CriteriaTreeViewProps {
  tree: TreeNode;
  policyTitle?: string;
  cmsId?: string | null;
  scopeSetting?: string;
  scopeRequestType?: string;
  cqlLibraryFhirId?: string | null;
}

export default function CriteriaTreeView({
  tree,
  policyTitle,
  cmsId,
  scopeSetting,
  scopeRequestType,
  cqlLibraryFhirId,
}: CriteriaTreeViewProps) {
  return (
    <div>
      {/* Header metadata */}
      {policyTitle && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-0.5">
                Coverage Policy
              </p>
              <p className="text-sm font-semibold text-slate-800">{policyTitle}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-right shrink-0">
              {cmsId && (
                <span className="rounded-md bg-white border border-blue-200 px-2 py-0.5 text-[11px] text-blue-700 font-mono">
                  {cmsId}
                </span>
              )}
              {scopeSetting && (
                <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                  {scopeSetting}
                </span>
              )}
              {scopeRequestType && (
                <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                  {scopeRequestType}
                </span>
              )}
            </div>
          </div>
          {cqlLibraryFhirId && (
            <p className="mt-1 text-[11px] text-blue-500 font-mono">
              CQL: {cqlLibraryFhirId}
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" /> ALL of (AND)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> ANY of (OR)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Required criterion
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block" /> Optional criterion
        </span>
      </div>

      <TreeNodeView node={tree} depth={0} />
    </div>
  );
}
