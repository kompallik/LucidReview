import Fastify, { type FastifyInstance } from 'fastify';

/**
 * Build a Fastify app instance configured for testing.
 *
 * Uses Fastify's built-in inject() for lightweight HTTP testing
 * without actually binding to a port.
 *
 * NOTE: This imports from src/app.ts which will be created by the
 * backend-engineer. The app module should export a function that
 * registers all plugins and routes on a Fastify instance.
 */
export async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Silence logs during tests
  });

  // Import and register the app plugin (routes, middleware, etc.)
  // The backend-engineer will create src/app.ts exporting a Fastify plugin.
  const { default: appPlugin } = await import('../../app.js');
  await app.register(appPlugin);

  await app.ready();
  return app;
}
