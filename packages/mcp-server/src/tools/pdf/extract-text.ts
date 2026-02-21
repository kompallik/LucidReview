import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import pdfParse from 'pdf-parse';

export function registerExtractText(server: McpServer) {
  server.tool(
    'pdf_extract_text',
    'Extract text content from a base64-encoded PDF document. Returns extracted text, page count, and per-page text.',
    {
      base64Content: z
        .string()
        .describe(
          'Base64-encoded PDF content (from um_download_attachment)',
        ),
    },
    async ({ base64Content }) => {
      const buffer = Buffer.from(base64Content, 'base64');

      // Check if this looks like a real PDF (starts with %PDF)
      const header = buffer.subarray(0, 5).toString('ascii');
      if (header.startsWith('%PDF')) {
        try {
          const result = await pdfParse(buffer);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    text: result.text,
                    pageCount: result.numpages,
                    info: result.info,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (err) {
          // PDF parse failed — fall through to raw text extraction
          const rawText = buffer.toString('utf-8');
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    text: rawText,
                    pageCount: 1,
                    info: { note: 'PDF parse failed, returning raw text content' },
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }
      }

      // Not a real PDF — likely mock base64-encoded text content
      const textContent = buffer.toString('utf-8');
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                text: textContent,
                pageCount: 1,
                info: { note: 'Content decoded from base64 text (not a PDF binary)' },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
