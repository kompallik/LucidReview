import { randomUUID } from 'crypto';
import {
  ConverseCommand,
  type Message,
  type Tool,
} from '@aws-sdk/client-bedrock-runtime';
import { mcpToolsToBedrockConfig } from './tool-translator.js';
import { getActivePromptWithVersion, FALLBACK_SYSTEM_PROMPT } from './system-prompt.js';

// ---------------------------------------------------------------------------
// Types for injected dependencies (loose to allow mocking in tests)
// ---------------------------------------------------------------------------

interface BedrockClient {
  send(command: unknown): Promise<ConverseResponse>;
}

interface ConverseResponse {
  output?: {
    message?: {
      role: string;
      content: ContentBlock[];
    };
  };
  stopReason?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

interface ContentBlock {
  text?: string;
  toolUse?: {
    toolUseId: string;
    name: string;
    input: Record<string, unknown>;
  };
}

interface McpClientLike {
  listTools(): Promise<{
    tools: Array<{
      name: string;
      description?: string;
      inputSchema: Record<string, unknown>;
    }>;
  }>;
  callTool(params: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<{ content: Array<{ type: string; text?: string }> }>;
  close(): Promise<void>;
}

interface DbLike {
  (tableName: string): {
    insert(row: unknown): Promise<unknown>;
    where(condition: Record<string, unknown>): {
      update(data: Record<string, unknown>): Promise<unknown>;
      first(): Promise<unknown>;
    };
  };
}

export interface AgentRunnerDeps {
  db: DbLike;
  bedrockClient: BedrockClient;
  mcpClient: McpClientLike;
  modelId?: string;
  maxTurns?: number;
}

export interface RunResult {
  runId: string;
  status: 'completed' | 'failed';
  determination?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// AgentRunner — orchestrates the Bedrock Converse loop with MCP tool calls
// ---------------------------------------------------------------------------

export class AgentRunner {
  private db: DbLike;
  private bedrockClient: BedrockClient;
  private mcpClient: McpClientLike;
  private modelId: string;
  private maxTurns: number;

  constructor(deps: AgentRunnerDeps) {
    this.db = deps.db;
    this.bedrockClient = deps.bedrockClient;
    this.mcpClient = deps.mcpClient;
    this.modelId = deps.modelId ?? 'us.anthropic.claude-sonnet-4-6';
    this.maxTurns = deps.maxTurns ?? 30;
  }

  async runReview(caseNumber: string, existingRunId?: string): Promise<RunResult> {
    const runId = existingRunId ?? randomUUID();
    let determination: unknown = undefined;

    try {
      // 2. Get MCP tool schemas and convert to Bedrock format
      const { tools: mcpTools } = await this.mcpClient.listTools();
      const bedrockTools = mcpToolsToBedrockConfig(mcpTools);

      // 3. Load system prompt and version (fall back to hardcoded prompt if DB unavailable)
      let systemPrompt = FALLBACK_SYSTEM_PROMPT;
      let promptVersion: string | null = null;
      try {
        const promptResult = await getActivePromptWithVersion();
        systemPrompt = promptResult.prompt;
        promptVersion = promptResult.version;
      } catch {
        // keep fallback
      }

      // 1. Create or update the run record to 'running'
      if (existingRunId) {
        await this.db('agent_runs').where({ id: runId }).update({
          status: 'running',
          model_id: this.modelId,
          prompt_version: promptVersion,
          started_at: new Date(),
        });
      } else {
        await this.db('agent_runs').insert({
          id: runId,
          case_number: caseNumber,
          status: 'running',
          model_id: this.modelId,
          prompt_version: promptVersion,
          started_at: new Date(),
        });
      }

      // 4. Initialize conversation with user message
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            {
              text: `Review UM case number: ${caseNumber}. Follow the workflow steps to gather data, evaluate criteria, and propose a determination.`,
            },
          ],
        },
      ];

      let turnNumber = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      // 5. Main agent loop
      for (let turn = 0; turn < this.maxTurns; turn++) {
        // Check if cancelled between turns
        const currentRun = await this.db('agent_runs').where({ id: runId }).first() as { status: string } | undefined;
        if (currentRun?.status === 'cancelled') {
          break;
        }

        turnNumber++;

        const command = new ConverseCommand({
          modelId: this.modelId,
          messages,
          system: [{ text: systemPrompt }],
          toolConfig: { tools: bedrockTools as Tool[] },
          inferenceConfig: { maxTokens: 4096, temperature: 0.1 },
        });

        const response = await this.bedrockClient.send(command);
        const assistantMessage = response.output?.message;
        const stopReason = response.stopReason;
        const usage = response.usage ?? {};
        totalInputTokens += usage.inputTokens ?? 0;
        totalOutputTokens += usage.outputTokens ?? 0;

        // Persist assistant turn
        await this.db('agent_turns').insert({
          id: randomUUID(),
          run_id: runId,
          turn_number: turnNumber,
          role: 'assistant',
          content: JSON.stringify(assistantMessage?.content ?? []),
          stop_reason: stopReason,
          input_tokens: usage.inputTokens ?? 0,
          output_tokens: usage.outputTokens ?? 0,
          created_at: new Date(),
        });

        // Add assistant message to conversation history
        if (assistantMessage) {
          messages.push(assistantMessage as Message);
        }

        // If model says it's done, break
        if (stopReason === 'end_turn') {
          break;
        }

        // 6. Handle tool use: call MCP tools and feed results back
        if (stopReason === 'tool_use' && assistantMessage?.content) {
          const toolResultContent: unknown[] = [];

          for (const block of assistantMessage.content) {
            if (block.toolUse) {
              const { toolUseId, name, input } = block.toolUse;

              // Call the MCP tool
              const toolResult = await this.mcpClient.callTool({
                name,
                arguments: input ?? {},
              });

              // Capture propose_determination result
              if (name === 'propose_determination') {
                try {
                  const resultText = toolResult.content?.find(
                    (c) => c.type === 'text',
                  )?.text;
                  if (resultText) {
                    determination = JSON.parse(resultText);
                  }
                } catch {
                  // Parse failed — continue without determination
                }
              }

              // Persist tool call record
              await this.db('agent_tool_calls').insert({
                id: randomUUID(),
                run_id: runId,
                turn_number: turnNumber,
                tool_use_id: toolUseId,
                tool_name: name,
                input: JSON.stringify(input ?? {}),
                output: JSON.stringify(toolResult.content ?? []),
                created_at: new Date(),
              });

              toolResultContent.push({
                toolResult: {
                  toolUseId,
                  content: toolResult.content ?? [],
                },
              });
            }
          }

          // Add tool results as user message
          messages.push({
            role: 'user' as const,
            content: toolResultContent,
          } as Message);
        }
      }

      // 7. Mark run as completed
      await this.db('agent_runs').where({ id: runId }).update({
        status: 'completed',
        determination: determination ? JSON.stringify(determination) : null,
        total_turns: turnNumber,
        input_tokens_total: totalInputTokens,
        output_tokens_total: totalOutputTokens,
        completed_at: new Date(),
      });

      return { runId, status: 'completed', determination };
    } catch (err) {
      // 8. Mark run as failed
      const errorMessage = err instanceof Error ? err.message : String(err);
      try {
        await this.db('agent_runs').where({ id: runId }).update({
          status: 'failed',
          error: errorMessage,
          completed_at: new Date(),
        });
      } catch {
        // DB update best-effort
      }

      return { runId, status: 'failed', error: errorMessage };
    }
  }
}
