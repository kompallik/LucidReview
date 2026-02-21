import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerGetClinicalInfo(
  server: McpServer,
  client: { getClinicalInfo(caseNumber: string): Promise<unknown> },
) {
  server.tool(
    'um_get_clinical_info',
    'Fetch clinical information for a case including ICD-10 diagnoses, CPT procedures, vitals, and lab results.',
    { caseNumber: z.string().describe('The UM case number') },
    async ({ caseNumber }) => {
      const data = await client.getClinicalInfo(caseNumber);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
