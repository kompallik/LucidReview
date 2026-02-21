import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerGetMemberCoverage(
  server: McpServer,
  client: { getMemberCoverage(memberId: string): Promise<unknown> },
) {
  server.tool(
    'um_get_member_coverage',
    'Fetch member insurance coverage details including plan info, benefits, and coverage dates.',
    { memberId: z.string().describe('The member ID (e.g. MBR-123456)') },
    async ({ memberId }) => {
      const data = await client.getMemberCoverage(memberId);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
