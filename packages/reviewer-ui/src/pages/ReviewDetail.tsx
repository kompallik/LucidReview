import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import {
  ArrowLeft,
  Play,
  Loader2,
  XCircle,
  Calendar,
  User,
  Building,
  Stethoscope,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import AgentTracePanel from '../components/AgentTracePanel.tsx';
import CriteriaChecklist from '../components/CriteriaChecklist.tsx';
import ClinicalSummary from '../components/ClinicalSummary.tsx';
import DeterminationPanel from '../components/DeterminationPanel.tsx';
import DeterminationBadge from '../components/DeterminationBadge.tsx';
import UrgencyBadge from '../components/UrgencyBadge.tsx';
import ErrorBoundary from '../components/ErrorBoundary.tsx';
import EvidencePanel, { type EvidenceItem } from '../components/EvidencePanel.tsx';
import PdfViewer from '../components/PdfViewer.tsx';
import { useToast } from '../components/Toast.tsx';
import { useReviewDetail, useAgentTrace, useRunAgent, useDecideReview, useCancelRun, usePolling } from '../api/hooks.ts';
import { cn } from '../lib/cn.ts';
import type { DeterminationResult } from '../api/client.ts';

// ─── Patient Header ───────────────────────────────────────────────────────────

function PatientHeader({
  review,
}: {
  review: NonNullable<ReturnType<typeof useReviewDetail>['data']>;
}) {
  return (
    <div className="border-b border-slate-200 bg-white px-6 py-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            to="/reviews"
            className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-base font-semibold text-slate-900 font-mono">
                {review.caseNumber}
              </h1>
              <UrgencyBadge urgency={review.urgency} />
              <DeterminationBadge determination={review.determination} size="md" />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              {review.primaryDiagnosisDisplay && (
                <span className="flex items-center gap-1">
                  <Stethoscope size={12} />
                  {review.primaryDiagnosisCode && (
                    <code className="font-mono text-slate-400">{review.primaryDiagnosisCode}</code>
                  )}
                  {review.primaryDiagnosisDisplay}
                </span>
              )}
              {review.serviceType && (
                <span className="flex items-center gap-1">
                  <Building size={12} />
                  {review.serviceType}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {review.createdAt ? (() => { try { const d = new Date(review.createdAt); return isNaN(d.getTime()) ? '—' : format(d, 'MMM d, yyyy HH:mm'); } catch { return '—'; } })() : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── No Agent Run State ───────────────────────────────────────────────────────

function NoAgentRun({ caseNumber, onStarted, onError }: {
  caseNumber: string;
  onStarted: (runId: string) => void;
  onError: (msg: string) => void;
}) {
  const runAgent = useRunAgent(caseNumber);

  const handleRun = () => {
    runAgent.mutate(undefined, {
      onSuccess: (data) => onStarted(data.runId),
      onError: (err) => onError(err.message),
    });
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
        <Play size={28} className="text-blue-600 ml-1" />
      </div>
      <h2 className="text-sm font-semibold text-slate-900 mb-1">No AI Review Yet</h2>
      <p className="text-xs text-slate-500 mb-4 max-w-xs">
        Run the AI agent to analyze this case against coverage criteria and generate a determination.
      </p>
      <button
        onClick={handleRun}
        disabled={runAgent.isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
      >
        {runAgent.isPending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Play size={16} />
        )}
        Run AI Review
      </button>
      {runAgent.isError && (
        <p className="mt-3 text-xs text-red-600">{runAgent.error.message}</p>
      )}
    </div>
  );
}

// ─── Token Cost Summary ───────────────────────────────────────────────────────

function TokenSummary({ run }: { run: NonNullable<ReturnType<typeof useReviewDetail>['data']>['latestRun'] }) {
  if (!run) return null;
  const totalTokens = run.inputTokensTotal + run.outputTokensTotal;
  const duration = run.completedAt
    ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null;

  return (
    <div className="flex items-center gap-4 text-[10px] text-slate-400">
      <span>{run.totalTurns} turns</span>
      <span>{totalTokens.toLocaleString()} tokens</span>
      {duration != null && <span>{duration}s</span>}
      <span className="font-mono">{run.modelId.split('/').pop()}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReviewDetail() {
  const { caseNumber } = useParams<{ caseNumber: string }>();
  const { toast } = useToast();
  const [traceCollapsed, setTraceCollapsed] = useState(false);
  const [startingRunId, setStartingRunId] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<{
    items: EvidenceItem[];
    description: string;
  } | null>(null);
  const [pdfViewerState, setPdfViewerState] = useState<{
    fileName: string;
    base64Content: string;
  } | null>(null);

  const { data: review, isLoading: reviewLoading, refetch: refetchReview } = useReviewDetail(caseNumber ?? '');
  const { data: trace, isLoading: traceLoading, refetch: refetchTrace } = useAgentTrace(review?.latestRunId);
  const decideReview = useDecideReview(caseNumber ?? '');
  const cancelRun = useCancelRun();

  const isRunning = review?.latestRun?.status === 'running' || (!!startingRunId && !latestRun);

  // Poll review + trace while agent is running
  const pollFn = useCallback(() => {
    refetchReview();
    refetchTrace();
  }, [refetchReview, refetchTrace]);

  usePolling(pollFn, 5_000, isRunning);

  if (reviewLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-slate-500">Review not found</p>
        <Link to="/reviews" className="mt-2 text-xs text-blue-600 hover:underline">
          Back to queue
        </Link>
      </div>
    );
  }

  const latestRun = review.latestRun;
  const isCompleted = latestRun?.status === 'completed';
  const isDecided = review.status === 'decided';
  const determination = latestRun?.determination as DeterminationResult | undefined;

  const handleViewEvidence = (criterionId: string, criterionName: string) => {
    const criterion = determination?.criteriaResults?.find((c) => c.criterionId === criterionId);
    if (!criterion) return;
    const items: EvidenceItem[] = [];
    if (criterion.fhirReference || criterion.evidence) {
      items.push({
        fhirRef: criterion.fhirReference ?? criterionId,
        extractedBy: criterion.source === 'NLP' ? 'NLP' : 'STRUCTURED',
        assertion:
          criterion.result === 'MET'
            ? 'AFFIRMED'
            : criterion.result === 'NOT_MET'
              ? 'NEGATED'
              : 'UNCERTAIN',
        valueSeen: criterion.value,
        effectiveTime: criterion.observedAt,
        sourceDocExcerpt: criterion.evidence,
      });
    }
    setSelectedEvidence({ items, description: criterionName });
  };

  const handleViewPdf = (fileName: string, base64Content: string) => {
    setPdfViewerState({ fileName, base64Content });
  };

  return (
    <div className="flex flex-col h-full">
      <PatientHeader review={review} />

      {!latestRun && !startingRunId ? (
        <NoAgentRun
          caseNumber={review.caseNumber}
          onStarted={(runId) => {
            setStartingRunId(runId);
            toast(`AI Review started for #${review.caseNumber}`, 'success');
          }}
          onError={(msg) => toast(`Agent run failed: ${msg}`, 'error')}
        />
      ) : !latestRun ? (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <Loader2 size={28} className="animate-spin text-blue-500 mb-4" />
          <p className="text-sm font-medium text-slate-700">Starting AI Review...</p>
          <p className="text-xs text-slate-400 mt-1">Initializing agent. The trace will appear momentarily.</p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* ─── Left Panel (60%) ─── */}
          <div className="flex w-[60%] flex-col border-r border-slate-200 overflow-hidden">
            {/* Agent Trace */}
            <div className={cn('flex flex-col border-b border-slate-200', traceCollapsed ? '' : 'flex-1')}>
              <button
                onClick={() => setTraceCollapsed(!traceCollapsed)}
                className="flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-200"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">Agent Trace</span>
                  <TokenSummary run={latestRun} />
                </div>
                <div className="flex items-center gap-2">
                  {isRunning && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelRun.mutate(latestRun.id);
                      }}
                      className="flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-100"
                    >
                      <XCircle size={10} />
                      Cancel
                    </button>
                  )}
                  {traceCollapsed ? (
                    <ChevronDown size={14} className="text-slate-400" />
                  ) : (
                    <ChevronUp size={14} className="text-slate-400" />
                  )}
                </div>
              </button>

              {!traceCollapsed && (
                <div className="flex-1 overflow-hidden">
                  {traceLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 size={20} className="animate-spin text-slate-400" />
                    </div>
                  ) : trace ? (
                    <ErrorBoundary fallbackTitle="Agent trace failed to render">
                      <AgentTracePanel trace={trace} isRunning={isRunning} onViewPdf={handleViewPdf} />
                    </ErrorBoundary>
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No trace data available
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clinical Summary (shown when trace is collapsed, or scrollable below) */}
            {traceCollapsed && determination?.clinicalSummary && (
              <div className="flex-1 overflow-y-auto border-b border-slate-200 bg-white">
                <ClinicalSummary facts={determination.clinicalSummary} />
              </div>
            )}
          </div>

          {/* ─── Right Panel (40%) ─── */}
          <div className="flex w-[40%] flex-col overflow-y-auto bg-white">
            {/* Determination */}
            <ErrorBoundary fallbackTitle="Determination panel failed to render">
              <DeterminationPanel
                determination={determination}
                isDecided={isDecided}
                onDecide={(req) =>
                  decideReview.mutate(req, {
                    onSuccess: () => toast('Determination saved', 'success'),
                    onError: (err) => toast(`Failed to save: ${err.message}`, 'error'),
                  })
                }
                isSubmitting={decideReview.isPending}
              />
            </ErrorBoundary>

            {/* Criteria checklist */}
            {determination?.criteriaResults && determination.criteriaResults.length > 0 && (
              <div className="border-t border-slate-200">
                <ErrorBoundary fallbackTitle="Criteria checklist failed to render">
                  <CriteriaChecklist criteria={determination.criteriaResults} onViewEvidence={handleViewEvidence} />
                </ErrorBoundary>
              </div>
            )}

            {/* Clinical summary (always visible in right panel) */}
            {determination?.clinicalSummary && determination.clinicalSummary.length > 0 && (
              <div className="border-t border-slate-200">
                <ClinicalSummary facts={determination.clinicalSummary} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Evidence slide-over panel */}
      {selectedEvidence && (
        <EvidencePanel
          evidence={selectedEvidence.items}
          criterionDescription={selectedEvidence.description}
          onClose={() => setSelectedEvidence(null)}
        />
      )}

      {/* PDF viewer modal */}
      {pdfViewerState && (
        <PdfViewer
          fileName={pdfViewerState.fileName}
          base64Content={pdfViewerState.base64Content}
          onClose={() => setPdfViewerState(null)}
        />
      )}
    </div>
  );
}
