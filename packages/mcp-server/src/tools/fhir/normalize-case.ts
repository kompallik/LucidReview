import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { HapiFhirClient } from '../../adapters/hapi-fhir-client.js';
import type { DefaultUmToFhirAdapter } from '../../mapping/um-to-fhir-adapter.js';
import type { NlpEntity, UmCaseData, UmClinicalData } from '@lucidreview/shared';

export function registerNormalizeCase(
  server: McpServer,
  fhirClient: HapiFhirClient,
  adapter: DefaultUmToFhirAdapter,
) {
  server.tool(
    'fhir_normalize_case',
    'Normalize UM case data + NLP entities into FHIR resources and store them in the FHIR server. Returns the patient ID and all created resource IDs.',
    {
      caseData: z
        .record(z.unknown())
        .describe('Case data object from um_get_case'),
      clinicalData: z
        .record(z.unknown())
        .describe('Clinical data object from um_get_clinical_info'),
      nlpEntities: z
        .array(
          z.object({
            text: z.string(),
            type: z.enum(['problem', 'medication', 'lab', 'procedure', 'anatomy', 'sign_symptom']),
            code: z.string().optional(),
            codeSystem: z.string().optional(),
            codeDisplay: z.string().optional(),
            assertion: z.enum(['affirmed', 'negated', 'uncertain', 'hypothetical', 'historical']),
            temporality: z.enum(['recent', 'historical', 'future', 'unknown']).optional(),
            spans: z.array(z.object({ start: z.number(), end: z.number() })),
            confidence: z.number().optional(),
          }),
        )
        .optional()
        .describe('Optional NLP-extracted entities to include in the FHIR bundle'),
    },
    async ({ caseData, clinicalData, nlpEntities }) => {
      // Map UM case data to FHIR bundle
      const bundle = adapter.mapCaseToBundle(
        caseData as unknown as UmCaseData,
        clinicalData as unknown as UmClinicalData,
      );

      // Extract patient and encounter IDs from the bundle entries
      const patientEntry = bundle.entry?.find(
        (e) => e.resource?.resourceType === 'Patient',
      );
      const encounterEntry = bundle.entry?.find(
        (e) => e.resource?.resourceType === 'Encounter',
      );
      const patientId = patientEntry?.resource?.id ?? 'unknown';
      const encounterId = encounterEntry?.resource?.id ?? 'unknown';
      const patientRef = `Patient/${patientId}`;

      // Add NLP entities if provided
      if (nlpEntities && nlpEntities.length > 0) {
        const nlpEntries = adapter.mapNlpEntitiesToResources(
          nlpEntities as NlpEntity[],
          patientRef,
          encounterId,
          'DocumentReference/nlp-source',
        );
        bundle.entry = [...(bundle.entry ?? []), ...nlpEntries];
      }

      // Submit transaction to HAPI FHIR
      const result = await fhirClient.transaction(bundle);

      // Collect resource IDs from the response
      const resourceIds =
        result.entry?.map((e) => {
          const loc = e.response?.location ?? '';
          return loc;
        }) ?? [];

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                patientId,
                encounterId,
                resourceCount: resourceIds.length,
                resourceIds,
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
