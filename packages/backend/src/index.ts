import { createApp } from './app.js';
import { config } from './config.js';

async function main(): Promise<void> {
  const app = await createApp();

  // Start BullMQ worker to process agent review jobs
  // Worker connects to Redis lazily — if Redis is unavailable it logs and retries
  const { startAgentWorker, closeQueue } = await import('./queue/agent-queue.js');
  const worker = startAgentWorker();
  worker.on('error', (err) => {
    app.log.error({ err }, 'BullMQ worker error');
  });

  const { startPolicySyncWorker, schedulePolicySync, closePolicySyncQueue } = await import('./queue/policy-sync-queue.js');
  const policySyncWorker = startPolicySyncWorker();
  policySyncWorker.on('error', (err) => {
    app.log.error({ err }, 'Policy sync worker error');
  });
  await schedulePolicySync();

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`LucidReview backend listening on http://0.0.0.0:${config.port}`);

  function shutdown(signal: string) {
    console.log(`Received ${signal}, shutting down gracefully...`);
    Promise.all([app.close(), closeQueue(), closePolicySyncQueue()]).then(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
