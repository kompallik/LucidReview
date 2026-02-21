#!/usr/bin/env npx tsx
/**
 * demo.ts
 *
 * Automated end-to-end demo of the LucidReview ARF-2026-001 flow.
 * Requires a running stack (docker compose up + pnpm dev).
 *
 * Usage: npx tsx scripts/demo.ts
 * Env:   BACKEND_URL (default http://localhost:3000)
 */

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';
const CASE_NUMBER = 'ARF-2026-001';
const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 120_000;

// ─── ANSI colors ──────────────────────────────────────────────────────────────

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function log(msg: string) {
  console.log(`${DIM}[${new Date().toISOString().slice(11, 19)}]${RESET} ${msg}`);
}

function heading(msg: string) {
  console.log(`\n${BOLD}${CYAN}${'='.repeat(60)}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${msg}${RESET}`);
  console.log(`${BOLD}${CYAN}${'='.repeat(60)}${RESET}\n`);
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => 'no body');
    throw new Error(`API ${options?.method ?? 'GET'} ${path} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

// ─── Step 1: Health check ─────────────────────────────────────────────────────

async function checkHealth(): Promise<void> {
  heading('Step 1: Health Check');
  try {
    const health = await apiFetch<{ status: string; services: Record<string, string> }>('/api/health');
    log(`Backend status: ${GREEN}${health.status}${RESET}`);
    for (const [service, status] of Object.entries(health.services)) {
      const color = status === 'up' || status === 'ok' ? GREEN : RED;
      log(`  ${service}: ${color}${status}${RESET}`);
    }
    const anyDown = Object.values(health.services).some(
      (s) => s !== 'up' && s !== 'ok' && s !== 'healthy',
    );
    if (anyDown) {
      console.error(`\n${RED}Some services are down. Aborting demo.${RESET}`);
      process.exit(1);
    }
    log(`${GREEN}All services healthy.${RESET}`);
  } catch (err: any) {
    console.error(`${RED}Health check failed: ${err.message}${RESET}`);
    console.error(`Make sure the stack is running: docker compose up -d && pnpm dev`);
    process.exit(1);
  }
}

// ─── Step 2: Trigger agent run ────────────────────────────────────────────────

async function triggerAgentRun(): Promise<string> {
  heading('Step 2: Trigger Agent Run');
  log(`POST /api/reviews/${CASE_NUMBER}/agent-run`);

  const result = await apiFetch<{ runId: string; status: string }>(
    `/api/reviews/${CASE_NUMBER}/agent-run`,
    { method: 'POST' },
  );

  log(`Run ID: ${BOLD}${result.runId}${RESET}`);
  log(`Status: ${YELLOW}${result.status ?? 'pending'}${RESET}`);
  return result.runId;
}

// ─── Step 3: Poll until completion ────────────────────────────────────────────

interface AgentRunResult {
  id: string;
  status: string;
  totalTurns: number;
  determination?: {
    decision: string;
    confidence: number;
    rationale?: string;
    criteriaResults?: Array<{
      criterionName: string;
      result: string;
      value?: string;
      evidence?: string;
    }>;
    missingData?: string[];
  };
  inputTokensTotal: number;
  outputTokensTotal: number;
  completedAt?: string;
  error?: string;
}

async function pollAgentRun(runId: string): Promise<AgentRunResult> {
  heading('Step 3: Poll Agent Run');
  const startTime = Date.now();
  let lastStatus = '';

  while (Date.now() - startTime < TIMEOUT_MS) {
    const run = await apiFetch<AgentRunResult>(`/api/agent-runs/${runId}`);

    if (run.status !== lastStatus) {
      lastStatus = run.status;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const color = run.status === 'completed' ? GREEN : run.status === 'failed' ? RED : YELLOW;
      log(`[${elapsed}s] Status: ${color}${run.status}${RESET} (${run.totalTurns} turns)`);
    }

    if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
      return run;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Agent run timed out after ${TIMEOUT_MS / 1000}s`);
}

// ─── Step 4: Display results ──────────────────────────────────────────────────

function displayResults(run: AgentRunResult): void {
  heading('Step 4: Agent Results');

  if (run.status === 'failed') {
    console.error(`${RED}Agent run failed: ${run.error ?? 'unknown error'}${RESET}`);
    return;
  }

  const det = run.determination;
  if (!det) {
    log(`${YELLOW}No determination produced.${RESET}`);
    return;
  }

  // Decision
  const decisionColor =
    det.decision === 'AUTO_APPROVE' ? GREEN :
    det.decision === 'DENY' ? RED : YELLOW;
  log(`Decision:   ${BOLD}${decisionColor}${det.decision}${RESET}`);
  log(`Confidence: ${BOLD}${Math.round(det.confidence * 100)}%${RESET}`);
  log(`Turns:      ${run.totalTurns}`);
  log(`Tokens:     ${run.inputTokensTotal} in / ${run.outputTokensTotal} out`);

  // Criteria results
  if (det.criteriaResults && det.criteriaResults.length > 0) {
    console.log('');
    log('Criteria Results:');
    const pad = Math.max(...det.criteriaResults.map((c) => c.criterionName.length));
    for (const c of det.criteriaResults) {
      const color = c.result === 'MET' ? GREEN : c.result === 'NOT_MET' ? RED : YELLOW;
      const value = c.value ? ` (${c.value})` : '';
      log(`  ${c.criterionName.padEnd(pad)}  ${color}${c.result.padEnd(7)}${RESET}${value}`);
    }
  }

  // Missing data
  if (det.missingData && det.missingData.length > 0) {
    console.log('');
    log(`${YELLOW}Missing Data:${RESET}`);
    for (const item of det.missingData) {
      log(`  - ${item}`);
    }
  }

  // Rationale
  if (det.rationale) {
    console.log('');
    log('Rationale:');
    const lines = det.rationale.split('\n');
    for (const line of lines) {
      log(`  ${DIM}${line}${RESET}`);
    }
  }
}

// ─── Step 5: Record determination ─────────────────────────────────────────────

async function recordDetermination(): Promise<void> {
  heading('Step 5: Record Reviewer Determination');
  log(`POST /api/reviews/${CASE_NUMBER}/determination`);

  await apiFetch(`/api/reviews/${CASE_NUMBER}/determination`, {
    method: 'POST',
    body: JSON.stringify({
      decision: 'AUTO_APPROVE',
      reviewerNotes: 'Demo: criteria met, auto-approved per policy.',
    }),
  });

  log(`${GREEN}Determination recorded: AUTO_APPROVE${RESET}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${BOLD}LucidReview E2E Demo${RESET}`);
  console.log(`Backend:    ${BACKEND_URL}`);
  console.log(`Case:       ${CASE_NUMBER}`);
  console.log(`Timeout:    ${TIMEOUT_MS / 1000}s`);

  try {
    await checkHealth();
    const runId = await triggerAgentRun();
    const run = await pollAgentRun(runId);
    displayResults(run);

    if (run.status === 'completed' && run.determination?.decision) {
      await recordDetermination();
    }

    heading('Demo Complete');
    log(`${GREEN}The ARF-2026-001 case has been fully reviewed and determined.${RESET}`);
    log(`View in UI: http://localhost:5173/reviews/${CASE_NUMBER}`);
  } catch (err: any) {
    console.error(`\n${RED}Demo failed: ${err.message}${RESET}`);
    process.exit(1);
  }
}

main();
