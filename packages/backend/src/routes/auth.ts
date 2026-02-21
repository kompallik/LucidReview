import type { FastifyInstance } from 'fastify';
import * as AuthService from '../services/auth.service.js';

export default async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post<{ Body: { email: string; password: string } }>(
    '/api/auth/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const user = await AuthService.loginUser(email, password);

      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const token = app.jwt.sign(
        { userId: user.id, email: user.email, role: user.role, sessionId: user.sessionId },
        { expiresIn: '8h' }
      );

      return reply.send({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    },
  );

  // POST /api/auth/logout — revoke the current session
  app.post(
    '/api/auth/logout',
    {
      preHandler: [
        async (req, rep) => {
          try {
            await req.jwtVerify();
          } catch {
            rep.status(401).send({ error: 'Unauthorized' });
          }
        },
      ],
      schema: {
        tags: ['Auth'],
        summary: 'Logout and revoke session',
      },
    },
    async (request, reply) => {
      const user = request.user as { sessionId?: string };
      if (user?.sessionId) {
        await AuthService.revokeSession(user.sessionId);
      }
      return reply.send({ success: true });
    },
  );

  // GET /api/auth/me — returns current user from token
  app.get(
    '/api/auth/me',
    {
      preHandler: [
        async (req, rep) => {
          try {
            await req.jwtVerify();
          } catch {
            rep.status(401).send({ error: 'Unauthorized' });
          }
        },
      ],
    },
    async (request, reply) => {
      return reply.send(request.user);
    },
  );
}
