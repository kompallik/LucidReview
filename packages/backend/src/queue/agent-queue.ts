/**
 * BullMQ queue for async agent review jobs.
 * Requires Redis (REDIS_URL env var, default: redis://localhost:6379).
 *
 * Job data: { runId: string; caseNumber: string }
 *
 * The worker instantiates AgentRunner and calls runner.runReview(caseNumber, runId),
 * using the pre-created runId from the DB.
 */
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '../db/connection.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const QUEUE_NAME = 'agent-review';

export interface AgentJobData {
  runId: string;
  caseNumber: string;
}

// Lazy singleton — only create connection when queue is used
let connection: IORedis | null = null;
let agentQueueInstance: Queue<AgentJobData> | null = null;
let agentWorkerInstance: Worker<AgentJobData> | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,        // don't auto-connect until first command
      enableOfflineQueue: false, // reject commands immediately if not connected
    });
    // Suppress unhandled 'error' events — Node throws if no listener is attached.
    // Actual operation errors are still caught by callers via try/catch.
    connection.on('error', () => {});
  }
  return connection;
}

export function getAgentQueue(): Queue<AgentJobData> {
  if (!agentQueueInstance) {
    agentQueueInstance = new Queue<AgentJobData>(QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return agentQueueInstance;
}

export function startAgentWorker(): Worker<AgentJobData> {
  if (agentWorkerInstance) return agentWorkerInstance;

  agentWorkerInstance = new Worker<AgentJobData>(
    QUEUE_NAME,
    async (job: Job<AgentJobData>) => {
      const { runId, caseNumber } = job.data;

      const { AgentRunner } = await import('../agent/agent-runner.js');
      const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
      const { Client: McpClient } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

      const bedrockClient = new BedrockRuntimeClient({
        region: process.env.AWS_REGION ?? 'us-east-1',
      });

      const transport = new StdioClientTransport({
        command: 'node',
        args: [process.env.MCP_SERVER_PATH ?? ''],
        // Explicitly forward DB + service env vars so the MCP subprocess
        // uses the same credentials as the backend (not its own defaults)
        env: {
          ...process.env,
          DB_HOST:     process.env.DB_HOST     ?? 'localhost',
          DB_PORT:     process.env.DB_PORT     ?? '13306',
          DB_USER:     process.env.DB_USER     ?? 'root',
          DB_PASSWORD: process.env.DB_PASSWORD ?? '',
          DB_NAME:     process.env.DB_NAME     ?? 'lucidreview',
        },
      });
      const mcpClient = new McpClient({ name: 'lucidreview-agent', version: '0.1.0' });
      await mcpClient.connect(transport);

      try {
        const runner = new AgentRunner({ db, bedrockClient, mcpClient: mcpClient as never });
        await runner.runReview(caseNumber, runId);
      } finally {
        await mcpClient.close().catch(() => {});
      }
    },
    {
      connection: getConnection(),
      concurrency: 3, // Process up to 3 jobs concurrently
    },
  );

  agentWorkerInstance.on('failed', async (job, err) => {
    if (job) {
      console.error(`Agent job ${job.id} failed for run ${job.data.runId}:`, err);
      await db('agent_runs')
        .where({ id: job.data.runId })
        .update({ status: 'failed', error: String(err), completed_at: new Date() })
        .catch(() => {});
    }
  });

  return agentWorkerInstance;
}

export async function removeAgentJob(runId: string): Promise<boolean> {
  try {
    const queue = getAgentQueue();
    const job = await queue.getJob(runId); // jobs use runId as jobId
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  } catch {
    return false; // Redis unavailable — best effort
  }
}

export async function addAgentJob(runId: string, caseNumber: string): Promise<void> {
  const queue = getAgentQueue();
  await queue.add('review', { runId, caseNumber }, { jobId: runId });
}

export async function closeQueue(): Promise<void> {
  await agentWorkerInstance?.close();
  await agentQueueInstance?.close();
  await connection?.quit();
  agentWorkerInstance = null;
  agentQueueInstance = null;
  connection = null;
}
