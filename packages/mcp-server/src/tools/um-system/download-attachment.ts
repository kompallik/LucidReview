import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerDownloadAttachment(
  server: McpServer,
  client: {
    downloadAttachment(
      caseNumber: string,
      attachmentId: string,
    ): Promise<unknown>;
  },
) {
  server.tool(
    'um_download_attachment',
    'Download a specific attachment by ID. Returns {base64Content, mimeType, fileName}. Use pdf_extract_text to process PDF content.',
    {
      caseNumber: z.string().describe('The UM case number'),
      attachmentId: z.string().describe('The attachment ID from um_get_attachments'),
    },
    async ({ caseNumber, attachmentId }) => {
      const data = await client.downloadAttachment(caseNumber, attachmentId);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
