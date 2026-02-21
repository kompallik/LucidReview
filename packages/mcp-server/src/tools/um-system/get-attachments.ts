import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerGetAttachments(
  server: McpServer,
  client: { getAttachments(caseNumber: string): Promise<unknown> },
) {
  server.tool(
    'um_get_attachments',
    'List all attachments for a case. Returns array of {attachmentId, fileName, mimeType, category, uploadedAt, sizeBytes}.',
    { caseNumber: z.string().describe('The UM case number') },
    async ({ caseNumber }) => {
      const data = await client.getAttachments(caseNumber);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
