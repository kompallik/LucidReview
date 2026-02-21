import type { FastifyInstance } from 'fastify';
import * as AgentRunService from '../services/agent-run.service.js';
import { authenticate } from '../middleware/auth.js';

const agentRunObjectSchema = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    case_number: { type: 'string' },
    status: { type: 'string' },
    model_id: { type: 'string' },
    prompt_version: { type: 'string' },
    total_turns: { type: 'number' },
    determination: { type: 'string' },
    error: { type: 'string' },
    input_tokens_total: { type: 'number' },
    output_tokens_total: { type: 'number' },
    started_at: { type: 'string' },
    completed_at: { type: 'string' },
  },
};

export default async function agentRunsRoutes(app: FastifyInstance) {
  // GET /api/agent-runs/:runId — get a single agent run
  app.get<{ Params: { runId: string } }>(
    '/api/agent-runs/:runId',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Agent Runs'],
        summary: 'Get agent run status',
        description: 'Returns a single agent run by its ID.',
        params: {
          type: 'object',
          properties: {
            runId: { type: 'string', description: 'Agent run ID' },
          },
          required: ['runId'],
        },
        response: {
          200: {
            description: 'Agent run object',
            ...agentRunObjectSchema,
          },
          404: {
            description: 'Agent run not found',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { runId } = request.params;
      const run = await AgentRunService.getRun(runId);

      if (!run) {
        return reply.status(404).send({ error: 'Agent run not found' });
      }

      return reply.send(run);
    },
  );

  // GET /api/agent-runs/:runId/trace — full turn-by-turn trace with tool calls
  app.get<{ Params: { runId: string } }>(
    '/api/agent-runs/:runId/trace',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Agent Runs'],
        summary: 'Get full agent trace',
        description: 'Returns the full turn-by-turn trace with tool calls for an agent run.',
        params: {
          type: 'object',
          properties: {
            runId: { type: 'string', description: 'Agent run ID' },
          },
          required: ['runId'],
        },
        response: {
          200: {
            description: 'Agent run trace',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Agent run not found',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { runId } = request.params;
      const run = await AgentRunService.getRun(runId);

      if (!run) {
        return reply.status(404).send({ error: 'Agent run not found' });
      }

      const trace = await AgentRunService.getTrace(runId);
      return reply.send(trace);
    },
  );

  // DELETE /api/agent-runs/:runId — cancel a running agent
  app.delete<{ Params: { runId: string } }>(
    '/api/agent-runs/:runId',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Agent Runs'],
        summary: 'Cancel agent run',
        description: 'Cancels a running agent review.',
        params: {
          type: 'object',
          properties: {
            runId: { type: 'string', description: 'Agent run ID' },
          },
          required: ['runId'],
        },
        response: {
          200: {
            description: 'Cancellation result',
            type: 'object',
            additionalProperties: true,
            properties: {
              success: { type: 'boolean' },
            },
          },
          404: {
            description: 'Agent run not found',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { runId } = request.params;
      const run = await AgentRunService.getRun(runId);

      if (!run) {
        return reply.status(404).send({ error: 'Agent run not found' });
      }

      const result = await AgentRunService.cancelRun(runId);
      return reply.send(result);
    },
  );
}
