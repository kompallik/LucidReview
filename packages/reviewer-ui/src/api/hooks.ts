import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, queryKeys, type DeterminationRequest } from './client.ts';
import {
  MOCK_REVIEWS,
  MOCK_REVIEW_DETAIL,
  MOCK_TRACE,
  MOCK_POLICIES,
} from './mock-data.ts';

// Wrap API calls with mock fallback for development
async function withMockFallback<T>(apiFn: () => Promise<T>, mockData: T): Promise<T> {
  try {
    return await apiFn();
  } catch {
    return mockData;
  }
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export function useReviews(params?: { status?: string }) {
  return useQuery({
    queryKey: queryKeys.reviews.list(params),
    queryFn: () => withMockFallback(() => api.reviews.list(params), MOCK_REVIEWS),
    refetchInterval: (query) => {
      // Poll every 10s if any review has a running agent
      const data = query.state.data;
      if (data?.some((r) => r.status === 'in_review')) return 10_000;
      return false;
    },
  });
}

export function useReviewDetail(caseNumber: string) {
  return useQuery({
    queryKey: queryKeys.reviews.detail(caseNumber),
    queryFn: () => withMockFallback(() => api.reviews.get(caseNumber), MOCK_REVIEW_DETAIL),
    enabled: !!caseNumber,
  });
}

// ─── Agent Runs ───────────────────────────────────────────────────────────────

export function useAgentTrace(runId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.agentRuns.trace(runId ?? ''),
    queryFn: () => withMockFallback(() => api.agentRuns.getTrace(runId!), MOCK_TRACE),
    enabled: !!runId,
    refetchInterval: (query) => {
      // Poll every 3s while run is in progress
      const trace = query.state.data;
      if (!trace) return false;
      const lastTurn = trace.turns[trace.turns.length - 1];
      if (lastTurn?.turn.stopReason !== 'end_turn') return 3_000;
      return false;
    },
  });
}

export function useRunAgent(caseNumber: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.reviews.runAgent(caseNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.detail(caseNumber) });
    },
  });
}

export function useCancelRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.agentRuns.cancel(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all });
    },
  });
}

// ─── Determination ────────────────────────────────────────────────────────────

export function useDecideReview(caseNumber: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DeterminationRequest) => api.reviews.decide(caseNumber, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.detail(caseNumber) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all });
    },
  });
}

// ─── Polling ──────────────────────────────────────────────────────────────────

export function usePolling(fn: () => void, interval: number, enabled: boolean) {
  const savedFn = useRef(fn);

  useEffect(() => {
    savedFn.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => savedFn.current(), interval);
    return () => clearInterval(id);
  }, [interval, enabled]);
}

// ─── Policies ─────────────────────────────────────────────────────────────────

export function usePolicies() {
  return useQuery({
    queryKey: queryKeys.policies.all,
    queryFn: () => withMockFallback(() => api.policies.list(), MOCK_POLICIES),
  });
}
