import { createHmac } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

/**
 * The test JWT secret must match config.jwtSecret used in app.ts.
 * Default: 'lucidreview-dev-secret-change-in-prod'
 */
const TEST_JWT_SECRET =
  process.env.JWT_SECRET ?? 'lucidreview-dev-secret-change-in-prod';

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate a valid HS256 JWT for integration tests.
 * Uses Node's built-in crypto — no dependency on @fastify/jwt or app.jwt.
 */
export function generateTestToken(
  _app: FastifyInstance | undefined,
  payload: { userId: string; email: string; role: string } = {
    userId: 'test-user-id',
    email: 'test@hospital.org',
    role: 'ADMIN',
  },
): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claims = base64url(JSON.stringify({ ...payload, iat: now, exp: now + 3600 }));
  const signingInput = `${header}.${claims}`;
  const sig = base64url(
    createHmac('sha256', TEST_JWT_SECRET).update(signingInput).digest(),
  );
  return `${signingInput}.${sig}`;
}

/**
 * Returns Authorization headers with a valid Bearer token.
 * The _app parameter is kept for API compatibility but is no longer used.
 */
export function authHeaders(
  app?: FastifyInstance,
  payload?: { userId: string; email: string; role: string },
): Record<string, string> {
  return { Authorization: `Bearer ${generateTestToken(app, payload)}` };
}
