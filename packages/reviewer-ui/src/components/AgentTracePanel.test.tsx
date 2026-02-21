import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach } from 'vitest';
import AgentTracePanel from './AgentTracePanel.tsx';
import type { AgentTrace, AgentToolCall } from '../api/client.ts';

afterEach(cleanup);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToolCall(overrides: Partial<AgentToolCall> = {}): AgentToolCall {
  return {
    id: 'tc-1',
    runId: 'run-1',
    turnNumber: 0,
    toolName: 'um_get_case',
    input: { caseNumber: 'ARF-2026-001' },
    output: { caseNumber: 'ARF-2026-001', patient: { name: 'John Doe' } },
    latencyMs: 230,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTrace(
  toolCalls: AgentToolCall[] = [],
  textContent?: string,
): AgentTrace {
  return {
    turns:
      toolCalls.length > 0 || textContent
        ? [
            {
              turn: {
                id: 't-1',
                runId: 'run-1',
                turnNumber: 0,
                role: 'assistant' as const,
                content: textContent ?? 'Reviewing case...',
                stopReason: 'tool_use',
                inputTokens: 450,
                outputTokens: 85,
                latencyMs: 1200,
                createdAt: new Date().toISOString(),
              },
              toolCalls,
            },
          ]
        : [],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AgentTracePanel', () => {
  it('renders empty state when trace has no turns', () => {
    const emptyTrace: AgentTrace = { turns: [] };
    render(<AgentTracePanel trace={emptyTrace} />);

    expect(screen.getByText('Agent Trace')).toBeInTheDocument();
    // Turn count is rendered as "{count} turn{s}" with spaces in JSX
    expect(screen.getByText(/0\s*turns/)).toBeInTheDocument();
  });

  it('renders turn count correctly for single turn', () => {
    const trace = makeTrace([makeToolCall()]);
    render(<AgentTracePanel trace={trace} />);

    expect(screen.getByText(/1\s*turn$/)).toBeInTheDocument();
  });

  it('renders tool call cards with correct tool names', () => {
    const trace = makeTrace([
      makeToolCall({ id: 'tc-1', toolName: 'um_get_case' }),
      makeToolCall({ id: 'tc-2', toolName: 'pdf_extract_text' }),
      makeToolCall({ id: 'tc-3', toolName: 'cql_evaluate_criteria' }),
    ]);
    render(<AgentTracePanel trace={trace} />);

    // Raw tool names (monospace labels)
    expect(screen.getByText('um_get_case')).toBeInTheDocument();
    expect(screen.getByText('pdf_extract_text')).toBeInTheDocument();
    expect(screen.getByText('cql_evaluate_criteria')).toBeInTheDocument();

    // Formatted display names
    expect(screen.getByText('Get Case')).toBeInTheDocument();
    expect(screen.getByText('Extract Text')).toBeInTheDocument();
    expect(screen.getByText('Evaluate Criteria')).toBeInTheDocument();
  });

  it('expands a tool call to show input and output', async () => {
    const user = userEvent.setup();
    const trace = makeTrace([
      makeToolCall({
        input: { caseNumber: 'ARF-2026-001' },
        output: { patient: 'John Doe' },
      }),
    ]);
    render(<AgentTracePanel trace={trace} />);

    // Input/Output labels should not be visible initially
    expect(screen.queryByText('Input')).not.toBeInTheDocument();
    expect(screen.queryByText('Output')).not.toBeInTheDocument();

    // Click the tool call card button to expand
    const toolButton = screen.getByText('um_get_case').closest('button')!;
    await user.click(toolButton);

    // Now Input and Output should be visible
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
  });

  it('collapses a tool call when clicked again', async () => {
    const user = userEvent.setup();
    const trace = makeTrace([makeToolCall()]);
    render(<AgentTracePanel trace={trace} />);

    const toolButton = screen.getByText('um_get_case').closest('button')!;

    // Expand
    await user.click(toolButton);
    expect(screen.getByText('Input')).toBeInTheDocument();

    // Collapse
    await user.click(toolButton);
    expect(screen.queryByText('Input')).not.toBeInTheDocument();
  });

  it('shows error state for failed tool call', () => {
    const trace = makeTrace([
      makeToolCall({
        error: 'Connection timeout to UM system',
        output: null,
      }),
    ]);
    render(<AgentTracePanel trace={trace} />);

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('shows error details when expanded', async () => {
    const user = userEvent.setup();
    const trace = makeTrace([
      makeToolCall({
        error: 'Connection timeout to UM system',
        output: null,
      }),
    ]);
    render(<AgentTracePanel trace={trace} />);

    const toolButton = screen.getByText('um_get_case').closest('button')!;
    await user.click(toolButton);

    expect(screen.getByText('Connection timeout to UM system')).toBeInTheDocument();
  });

  it('shows latency for tool calls', () => {
    const trace = makeTrace([makeToolCall({ latencyMs: 450 })]);
    render(<AgentTracePanel trace={trace} />);

    expect(screen.getByText('450ms')).toBeInTheDocument();
  });

  it('shows running indicator when isRunning is true', () => {
    const trace = makeTrace([makeToolCall()]);
    render(<AgentTracePanel trace={trace} isRunning />);

    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Agent is thinking...')).toBeInTheDocument();
  });

  it('does not show running indicator when isRunning is false', () => {
    const trace = makeTrace([makeToolCall()]);
    render(<AgentTracePanel trace={trace} isRunning={false} />);

    expect(screen.queryByText('Running')).not.toBeInTheDocument();
    expect(screen.queryByText('Agent is thinking...')).not.toBeInTheDocument();
  });

  it('renders reasoning bubble for text content', () => {
    const trace = makeTrace([], 'I will begin reviewing the case by gathering clinical data.');
    render(<AgentTracePanel trace={trace} />);

    expect(
      screen.getByText('I will begin reviewing the case by gathering clinical data.'),
    ).toBeInTheDocument();
  });
});
