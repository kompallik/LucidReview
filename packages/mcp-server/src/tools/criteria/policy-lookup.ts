import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { config } from '../../config.js';

// Dynamic import for mysql2 to avoid hard dependency during testing
async function getConnection() {
  const mysql = await import('mysql2/promise');
  return mysql.createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
  });
}

export function registerPolicyLookup(server: McpServer) {
  server.tool(
    'policy_lookup',
    'Look up applicable coverage policies and their CQL criteria library IDs for given diagnosis codes and service type.',
    {
      diagnosisCodes: z
        .array(z.string())
        .describe('Array of ICD-10-CM diagnosis codes to search for'),
      serviceType: z
        .string()
        .describe('Service type (e.g. "Inpatient Admission")'),
    },
    async ({ diagnosisCodes, serviceType }) => {
      let conn;
      try {
        conn = await getConnection();

        // Query policies matching the diagnosis codes or service type
        const [policies] = await conn.execute(
          `SELECT p.id, p.policy_type, p.cms_id, p.title, p.status,
                  cs.id AS criteria_set_id, cs.criteria_set_id AS criteria_set_code,
                  cs.scope_setting, cs.scope_request_type,
                  cs.cql_library_fhir_id, cs.status AS criteria_status
           FROM policies p
           LEFT JOIN criteria_sets cs ON cs.policy_id = p.id AND cs.status = 'ACTIVE'
           WHERE p.status = 'ACTIVE'
             AND (
               JSON_OVERLAPS(p.sections_json->'$.diagnosisCodes', CAST(? AS JSON))
               OR p.title LIKE ?
               OR p.sections_json->'$.serviceTypes' LIKE ?
             )
           ORDER BY p.policy_type, p.title`,
          [
            JSON.stringify(diagnosisCodes),
            `%${serviceType}%`,
            `%${serviceType}%`,
          ],
        );

        // Group results by policy
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const policyMap = new Map<number, any>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const row of policies as any[]) {
          if (!policyMap.has(row.id)) {
            policyMap.set(row.id, {
              policyId: row.id,
              policyType: row.policy_type,
              cmsId: row.cms_id,
              title: row.title,
              criteriaSets: [],
            });
          }
          if (row.criteria_set_id) {
            policyMap.get(row.id).criteriaSets.push({
              criteriaSetId: row.criteria_set_code,
              scopeSetting: row.scope_setting,
              scopeRequestType: row.scope_request_type,
              cqlLibraryFhirId: row.cql_library_fhir_id,
              status: row.criteria_status,
            });
          }
        }

        const result = Array.from(policyMap.values());

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ policies: result }, null, 2),
            },
          ],
        };
      } finally {
        await conn?.end();
      }
    },
  );
}
