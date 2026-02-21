import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerGetCaseNotes(
  server: McpServer,
  client: { getCaseNotes(caseNumber: string): Promise<unknown> },
) {
  server.tool(
    'um_get_case_notes',
    'Fetch reviewer and clinical notes for a case. Returns array of {noteId, author, timestamp, text, noteType}.',
    { caseNumber: z.string().describe('The UM case number') },
    async ({ caseNumber }) => {
      const data = await client.getCaseNotes(caseNumber);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
