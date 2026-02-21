import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerGetCaseHistory(
  server: McpServer,
  client: { getCaseHistory(caseNumber: string): Promise<unknown> },
) {
  server.tool(
    'um_get_case_history',
    'Fetch the history/audit trail for a case. Returns array of {timestamp, action, actor, notes}.',
    { caseNumber: z.string().describe('The UM case number') },
    async ({ caseNumber }) => {
      const data = await client.getCaseHistory(caseNumber);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
