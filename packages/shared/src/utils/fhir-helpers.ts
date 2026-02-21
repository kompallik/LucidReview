/**
 * Build a minimal FHIR Bundle entry for transaction bundles.
 */
export function buildTransactionEntry(
  resource: fhir4.Resource,
  method: 'PUT' | 'POST' = 'POST'
): fhir4.BundleEntry {
  const url =
    method === 'PUT' && resource.id
      ? `${resource.resourceType}/${resource.id}`
      : resource.resourceType;

  return {
    resource: resource as fhir4.BundleEntry['resource'],
    request: {
      method,
      url,
    },
  };
}

/**
 * Build a FHIR Provenance resource to record agent activity.
 */
export function buildProvenance(
  targetRef: string,
  agentDisplay: string,
  reason?: string
): fhir4.Provenance {
  const provenance: fhir4.Provenance = {
    resourceType: 'Provenance',
    target: [{ reference: targetRef }],
    recorded: new Date().toISOString(),
    agent: [
      {
        who: { display: agentDisplay },
      },
    ],
  };

  if (reason) {
    provenance.reason = [{ text: reason }];
  }

  return provenance;
}

/**
 * Extract a display string from a FHIR CodeableConcept.
 * Prefers the concept's text, then the first coding's display, then the first coding's code.
 */
export function getCodeDisplay(concept: fhir4.CodeableConcept): string {
  if (concept.text) return concept.text;
  const coding = concept.coding?.[0];
  if (!coding) return '';
  return coding.display ?? coding.code ?? '';
}

/**
 * Find a specific coding by system URI within a CodeableConcept.
 */
export function findCoding(
  concept: fhir4.CodeableConcept,
  system: string
): fhir4.Coding | undefined {
  return concept.coding?.find((c) => c.system === system);
}
