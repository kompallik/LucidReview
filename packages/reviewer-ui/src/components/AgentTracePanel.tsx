import { useState, useRef, useEffect } from 'react';
import {
  Database,
  FileText,
  Brain,
  Server,
  Code,
  BookOpen,
  CheckCircle,
  Wrench,
  ChevronDown,
  ChevronRight,
  Loader2,
  Clock,
  AlertCircle,
  MessageSquare,
  Eye,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/cn.ts';
import type { AgentTrace, AgentToolCall } from '../api/client.ts';

// ─── Tool Category Icons ──────────────────────────────────────────────────────

const TOOL_ICON_MAP: Record<string, { icon: typeof Wrench; color: string }> = {
  um_get_case: { icon: Database, color: 'text-blue-600 bg-blue-50' },
  um_get_clinical_info: { icon: Database, color: 'text-blue-600 bg-blue-50' },
  um_get_attachments: { icon: Database, color: 'text-blue-600 bg-blue-50' },
  um_download_attachment: { icon: Database, color: 'text-blue-600 bg-blue-50' },
  um_get_case_history: { icon: Database, color: 'text-blue-600 bg-blue-50' },
  um_get_case_notes: { icon: Database, color: 'text-blue-600 bg-blue-50' },
  um_get_member_coverage: { icon: Database, color: 'text-blue-600 bg-blue-50' },
  pdf_extract_text: { icon: FileText, color: 'text-orange-600 bg-orange-50' },
  nlp_extract_clinical_entities: { icon: Brain, color: 'text-purple-600 bg-purple-50' },
  fhir_normalize_case: { icon: Server, color: 'text-teal-600 bg-teal-50' },
  fhir_get_patient_summary: { icon: Server, color: 'text-teal-600 bg-teal-50' },
  cql_evaluate_criteria: { icon: Code, color: 'text-green-600 bg-green-50' },
  policy_lookup: { icon: BookOpen, color: 'text-slate-600 bg-slate-100' },
  propose_determination: { icon: CheckCircle, color: 'text-green-600 bg-green-50' },
};

function getToolDisplay(toolName: string) {
  return TOOL_ICON_MAP[toolName] ?? { icon: Wrench, color: 'text-slate-500 bg-slate-100' };
}

function formatToolName(name: string): string {
  return name
    .replace(/^(um_|pdf_|nlp_|fhir_|cql_)/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Tool Call Card ───────────────────────────────────────────────────────────

function ToolCallCard({
  call,
  onViewPdf,
}: {
  call: AgentToolCall;
  onViewPdf?: (fileName: string, base64Content: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { icon: Icon, color } = getToolDisplay(call.toolName);
  const hasError = !!call.error;

  // Check if this is a PDF attachment we can view
  const isPdfAttachment = call.toolName === 'um_download_attachment' && !hasError;
  const pdfOutput =
    isPdfAttachment && call.output && typeof call.output === 'object'
      ? (call.output as Record<string, unknown>)
      : null;
  const pdfBase64 =
    pdfOutput && typeof pdfOutput.base64Content === 'string'
      ? pdfOutput.base64Content
      : null;
  const pdfFileName =
    (pdfOutput && typeof pdfOutput.fileName === 'string' ? pdfOutput.fileName : null) ??
    (call.input && typeof call.input === 'object' && 'fileName' in (call.input as Record<string, unknown>)
      ? String((call.input as Record<string, unknown>).fileName)
      : 'attachment.pdf');

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        hasError ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white',
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', color)}>
          <Icon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">{call.toolName}</span>
            {hasError && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-600">
                <AlertCircle size={10} /> Error
              </span>
            )}
          </div>
          <div className="text-xs text-slate-700 font-medium truncate">
            {formatToolName(call.toolName)}
          </div>
        </div>
        {pdfBase64 && onViewPdf && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewPdf(pdfFileName, pdfBase64);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700 hover:bg-orange-100 transition-colors cursor-pointer"
            aria-label={`View PDF ${pdfFileName}`}
          >
            <Eye size={10} />
            View PDF
          </span>
        )}
        {call.latencyMs != null && (
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <Clock size={10} />
            {call.latencyMs}ms
          </span>
        )}
        {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-3 py-2 space-y-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Input</div>
            <pre className="rounded-md bg-slate-50 p-2 text-[11px] text-slate-700 overflow-x-auto max-h-48 overflow-y-auto font-mono leading-relaxed">
              {JSON.stringify(call.input, null, 2)}
            </pre>
          </div>
          {hasError ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-red-500 mb-1">Error</div>
              <pre className="rounded-md bg-red-50 p-2 text-[11px] text-red-700 overflow-x-auto font-mono">
                {call.error}
              </pre>
            </div>
          ) : (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Output</div>
              <pre className="rounded-md bg-slate-50 p-2 text-[11px] text-slate-700 overflow-x-auto max-h-64 overflow-y-auto font-mono leading-relaxed">
                {typeof call.output === 'string' ? call.output : JSON.stringify(call.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Agent Reasoning Bubble ───────────────────────────────────────────────────

function ReasoningBubble({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(content.length < 300);
  const isLong = content.length >= 300;

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
      <div className="flex items-start gap-2">
        <MessageSquare size={14} className="mt-0.5 text-blue-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'text-xs text-slate-700 leading-relaxed whitespace-pre-wrap',
              !expanded && 'line-clamp-3',
            )}
          >
            {content}
          </div>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface AgentTracePanelProps {
  trace: AgentTrace;
  isRunning?: boolean;
  onViewPdf?: (fileName: string, base64Content: string) => void;
}

export default function AgentTracePanel({ trace, isRunning, onViewPdf }: AgentTracePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevTurnCount = useRef(trace.turns.length);

  // Auto-scroll to bottom when new turns arrive
  useEffect(() => {
    if (trace.turns.length > prevTurnCount.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevTurnCount.current = trace.turns.length;
  }, [trace.turns.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Agent Trace</h3>
          <span className="text-xs text-slate-400">
            {trace.turns.length} turn{trace.turns.length !== 1 ? 's' : ''}
          </span>
        </div>
        {isRunning && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600 animate-clinical-pulse">
            <Loader2 size={12} className="animate-spin" />
            Running
          </span>
        )}
      </div>

      {/* Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto trace-scroll px-4 py-3 space-y-4">
        {trace.turns.map(({ turn, toolCalls }, i) => {
          const textContent = typeof turn.content === 'string' ? turn.content : null;

          return (
            <div key={turn.id} className="relative trace-line">
              {/* Turn indicator */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={cn(
                    'flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10px] font-bold z-10',
                    turn.role === 'assistant'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-300 text-slate-700',
                  )}
                >
                  {i + 1}
                </div>
                <span className="text-[10px] text-slate-400">
                  {formatDistanceToNow(new Date(turn.createdAt), { addSuffix: true })}
                </span>
                {turn.latencyMs != null && (
                  <span className="text-[10px] text-slate-300">
                    {turn.inputTokens + turn.outputTokens} tokens
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="ml-[30px] space-y-2">
                {textContent && <ReasoningBubble content={textContent} />}
                {toolCalls.map((tc) => (
                  <ToolCallCard key={tc.id} call={tc} onViewPdf={onViewPdf} />
                ))}
              </div>
            </div>
          );
        })}

        {isRunning && (
          <div className="flex items-center gap-2 ml-[30px] py-2">
            <Loader2 size={14} className="animate-spin text-blue-500" />
            <span className="text-xs text-slate-500">Agent is thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
}
