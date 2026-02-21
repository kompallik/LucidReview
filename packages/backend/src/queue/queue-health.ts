import { getAgentQueue } from './agent-queue.js';

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export async function getQueueStats(): Promise<QueueStats> {
  try {
    const queue = getAgentQueue();
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
  }
}
