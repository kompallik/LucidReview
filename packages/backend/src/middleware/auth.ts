import type { FastifyRequest, FastifyReply } from 'fastify';
import { isSessionValid } from '../services/auth.service.js';

// Augment FastifyRequest to carry user payload
declare module 'fastify' {
  interface FastifyRequest {
    user?: { userId: string; email: string; role: string; sessionId?: string };
  }
}

/**
 * Prehandler that verifies the JWT and attaches user to request.
 * Relies on @fastify/jwt being registered on the Fastify instance.
 * Also checks session revocation when a sessionId is present in the token.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
    // Check session revocation if the token contains a sessionId.
    // Tokens without sessionId (legacy) are allowed through.
    const user = request.user as { sessionId?: string } | undefined;
    if (user?.sessionId) {
      const valid = await isSessionValid(user.sessionId).catch(() => true);
      if (!valid) {
        return reply.status(401).send({ error: 'Session expired or revoked' });
      }
    }
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

/**
 * Factory that returns a prehandler checking the user has one of the required roles.
 * Must be used after `authenticate`.
 */
export function requireRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user as { role?: string } | undefined;
    if (!user?.role || !roles.includes(user.role)) {
      reply.status(403).send({ error: 'Forbidden: insufficient role' });
    }
  };
}
