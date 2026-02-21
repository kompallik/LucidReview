import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { HapiFhirClient } from '../../adapters/hapi-fhir-client.js';

interface CriteriaResult {
  name: string;
  result: 'MET' | 'NOT_MET' | 'UNKNOWN';
  value: unknown;
}

export function registerEvaluateCql(
  server: McpServer,
  fhirClient: HapiFhirClient,
) {
  server.tool(
    'cql_evaluate_criteria',
    'Evaluate a CQL criteria library against a patient in the FHIR server. Returns individual criteria results (MET/NOT_MET/UNKNOWN) and whether all criteria are met.',
    {
      libraryId: z.string().describe('The FHIR Library resource ID containing the CQL criteria'),
      patientId: z.string().describe('The FHIR Patient resource ID to evaluate against'),
    },
    async ({ libraryId, patientId }) => {
      const params = await fhirClient.evaluateLibrary(libraryId, patientId);

      const results: CriteriaResult[] = [];
      const missingData: string[] = [];

      // Parse the Parameters response from CQL evaluation
      for (const param of params.parameter ?? []) {
        if (!param.name) continue;

        // Skip internal CQL parameters
        if (param.name.startsWith('_') || param.name === 'Patient') continue;

        let result: 'MET' | 'NOT_MET' | 'UNKNOWN';
        let value: unknown = null;

        if (param.valueBoolean !== undefined) {
          result = param.valueBoolean ? 'MET' : 'NOT_MET';
          value = param.valueBoolean;
        } else if (param.resource) {
          result = 'MET';
          value = param.resource;
        } else {
          result = 'UNKNOWN';
          missingData.push(param.name);
        }

        results.push({ name: param.name, result, value });
      }

      const allCriteriaMet = results.length > 0 && results.every((r) => r.result === 'MET');

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                libraryId,
                patientId,
                results,
                allCriteriaMet,
                missingData,
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
