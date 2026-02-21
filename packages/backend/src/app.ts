import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyError, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { config } from './config.js';
import reviewsRoutes from './routes/reviews.js';
import agentRunsRoutes from './routes/agent-runs.js';
import policiesRoutes from './routes/policies.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import crdRoutes from './routes/crd.js';
import dtrRoutes from './routes/dtr.js';
import pasRoutes from './routes/pas.js';
import criteriaTreeRoutes from './routes/criteria-tree.js';

async function appPlugin(app: FastifyInstance) {
  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false, // Disabled for API — enable for UI-serving
  });

  // CORS
  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // JWT
  await app.register(jwt, {
    secret: config.jwtSecret,
  });

  // Rate limiting (in-memory store)
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // OpenAPI docs
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'LucidReview API',
        description: 'LLM-augmented Utilization Management Criteria Engine',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });

  // Route plugins
  await app.register(authRoutes);
  await app.register(reviewsRoutes);
  await app.register(agentRunsRoutes);
  await app.register(policiesRoutes);
  await app.register(adminRoutes);
  await app.register(crdRoutes);
  await app.register(dtrRoutes);
  await app.register(pasRoutes);
  await app.register(criteriaTreeRoutes);

  // Global error handler
  app.setErrorHandler((err: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
    if (err.validation) {
      return reply.status(400).send({ error: 'Validation error', details: err.validation });
    }
    if (err.statusCode && err.statusCode < 500) {
      return reply.status(err.statusCode).send({ error: err.message });
    }
    app.log.error(err, 'Unhandled error');
    return reply.status(500).send({ error: 'Internal server error' });
  });

  app.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(404).send({ error: 'Not found' });
  });
}

export default appPlugin;

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: 'info' },
    genReqId: () => randomUUID(),
    bodyLimit: 2 * 1024 * 1024, // 2MB body limit
  });

  await app.register(appPlugin);
  await app.ready();

  return app;
}
