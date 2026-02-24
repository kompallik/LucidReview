/**
 * BullMQ queue for policy sync jobs.
 * Requires Redis (REDIS_URL env var, default: redis://localhost:6379).
 *
 * Job data: { syncType: 'status' | 'enrich' | 'full'; policyId?: string; triggeredBy: 'scheduler' | 'admin' }
 */
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '../db/connection.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const QUEUE_NAME = 'policy-sync';

export interface PolicySyncJobData {
  syncType: 'status' | 'enrich' | 'full';
  policyId?: string;
  triggeredBy: 'scheduler' | 'admin';
}

let connection: IORedis | null = null;
let policySyncQueueInstance: Queue<PolicySyncJobData> | null = null;
let policySyncWorkerInstance: Worker<PolicySyncJobData> | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    connection.on('error', () => {});
  }
  return connection;
}

export function getPolicySyncQueue(): Queue<PolicySyncJobData> {
  if (!policySyncQueueInstance) {
    policySyncQueueInstance = new Queue<PolicySyncJobData>(QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    });
  }
  return policySyncQueueInstance;
}

export function startPolicySyncWorker(): Worker<PolicySyncJobData> {
  if (policySyncWorkerInstance) return policySyncWorkerInstance;

  policySyncWorkerInstance = new Worker<PolicySyncJobData>(
    QUEUE_NAME,
    async (job: Job<PolicySyncJobData>) => {
      const { syncType, policyId, triggeredBy } = job.data;

      const ingestionService = await import('../services/policy-ingestion.service.js');

      const startedAt = new Date();
      let result: unknown;

      try {
        if (syncType === 'status') {
          result = await ingestionService.syncPolicyStatus();
        } else if (syncType === 'enrich' && policyId) {
          result = await ingestionService.enrichPolicy(policyId);
        } else if (syncType === 'full') {
          result = await ingestionService.fullSync();
        } else {
          throw new Error(`Unknown syncType: ${syncType}`);
        }

        // Log to audit_log
        await db('audit_log').insert({
          id: `psync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          action: `policy_sync_${syncType}`,
          actor_id: `system:${triggeredBy}`,
          resource_type: 'policy',
          resource_id: policyId ?? 'all',
          details: JSON.stringify({ result, durationMs: Date.now() - startedAt.getTime() }),
          created_at: new Date(),
        }).catch(() => {}); // Non-fatal
      } catch (err) {
        // Log error to audit_log
        await db('audit_log').insert({
          id: `psync-err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          action: `policy_sync_${syncType}_error`,
          actor_id: `system:${triggeredBy}`,
          resource_type: 'policy',
          resource_id: policyId ?? 'all',
          details: JSON.stringify({ error: String(err) }),
          created_at: new Date(),
        }).catch(() => {});
        throw err;
      }
    },
    {
      connection: getConnection(),
      concurrency: 5, // 5 concurrent enrich jobs
    },
  );

  policySyncWorkerInstance.on('failed', (job, err) => {
    if (job) {
      console.error(`Policy sync job ${job.id} (${job.data.syncType}) failed:`, err);
    }
  });

  return policySyncWorkerInstance;
}

/**
 * Add a repeatable weekly sync job if not already scheduled.
 */
export async function schedulePolicySync(): Promise<void> {
  try {
    const queue = getPolicySyncQueue();
    const repeatableJobs = await queue.getRepeatableJobs();
    const alreadyScheduled = repeatableJobs.some((j) => j.name === 'weekly-full-sync');

    if (!alreadyScheduled) {
      await queue.add(
        'weekly-full-sync',
        { syncType: 'full', triggeredBy: 'scheduler' },
        {
          repeat: { pattern: '0 2 * * 1' }, // Mondays at 2am
          jobId: 'weekly-full-sync',
        },
      );
      console.log('Scheduled weekly policy sync (Mondays 2am)');
    }
  } catch (err) {
    // Redis unavailable — best effort
    console.warn('Could not schedule policy sync (Redis unavailable?):', err);
  }
}

export async function closePolicySyncQueue(): Promise<void> {
  await policySyncWorkerInstance?.close();
  await policySyncQueueInstance?.close();
  policySyncWorkerInstance = null;
  policySyncQueueInstance = null;
  // Note: don't close connection here — shared with agent-queue in same process
}
