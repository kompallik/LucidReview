import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerGetCase(
  server: McpServer,
  client: { getCase(caseNumber: string): Promise<unknown> },
) {
  server.tool(
    'um_get_case',
    'Fetch case summary from the UM system by case number. Returns patient demographics, provider, facility, service type, dates, status, and urgency.',
    { caseNumber: z.string().describe('The UM case number (e.g. ARF-2026-001)') },
    async ({ caseNumber }) => {
      const data = await client.getCase(caseNumber);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
