import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CtakesClient } from '../../adapters/ctakes-client.js';

export function registerExtractEntities(
  server: McpServer,
  client: CtakesClient,
) {
  server.tool(
    'nlp_extract_clinical_entities',
    'Extract clinical entities (problems, medications, labs, procedures) from free text using NLP. Returns typed entities with codes, assertions (affirmed/negated/uncertain), and text spans.',
    {
      text: z
        .string()
        .describe(
          'Clinical text to analyze (e.g. extracted from a PDF document)',
        ),
    },
    async ({ text }) => {
      const result = await client.analyze(text);
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
