import type { DeterminationResult } from './determination.js';

export type AgentRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AgentRun {
  id: string;
  caseNumber: string;
  status: AgentRunStatus;
  modelId: string;
  promptVersion: string;
  totalTurns?: number;
  determination?: DeterminationResult;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  inputTokensTotal?: number;
  outputTokensTotal?: number;
}

export interface AgentTurn {
  id: string;
  runId: string;
  turnNumber: number;
  role: 'user' | 'assistant';
  content: unknown; // Raw Bedrock message content
  stopReason?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  createdAt: Date;
}

export interface AgentToolCall {
  id: string;
  runId: string;
  turnNumber: number;
  toolUseId: string;
  toolName: string;
  input: unknown;
  output: unknown;
  latencyMs?: number;
  error?: string;
  createdAt: Date;
}

export interface AgentRunTrace {
  run: AgentRun;
  turns: Array<{
    turn: AgentTurn;
    toolCalls: AgentToolCall[];
  }>;
}
