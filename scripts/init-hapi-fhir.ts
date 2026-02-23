#!/usr/bin/env node
/**
 * Initialize HAPI FHIR with required resources.
 * Run this every time HAPI FHIR starts (it's idempotent).
 * Usage: npx tsx scripts/init-hapi-fhir.ts
 */

const HAPI_URL = process.env.HAPI_FHIR_URL ?? 'http://localhost:8080/fhir';

async function upsertResource(resourceType: string, id: string, resource: object): Promise<void> {
  const resp = await fetch(`${HAPI_URL}/${resourceType}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/fhir+json' },
    body: JSON.stringify({ ...resource, resourceType, id }),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    console.warn(`  ⚠ ${resourceType}/${id}: HTTP ${resp.status} — ${err.slice(0, 100)}`);
  } else {
    console.log(`  ✓ ${resourceType}/${id}`);
  }
}

async function main(): Promise<void> {
  console.log(`Initializing HAPI FHIR at ${HAPI_URL}…\n`);

  // Wait for HAPI to be ready
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${HAPI_URL}/metadata`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) break;
    } catch { /* retry */ }
    if (i === 29) throw new Error('HAPI FHIR not ready after 30 tries');
    await new Promise(r => setTimeout(r, 2000));
  }

  // Upload the ARF CQL Library (the real one from our bundle)
  const fs = await import('node:fs');
  const path = await import('node:path');
  const ROOT = path.resolve('/Users/kkompalli/Prototypes/LucidReview');

  const libPath = `${ROOT}/packages/backend/src/fhir/libraries/UM-InpatientAdmission-AcuteRespFailure-v1.Library.json`;
  if (fs.existsSync(libPath)) {
    const lib = JSON.parse(fs.readFileSync(libPath, 'utf8'));
    lib.id = 'UM-InpatientAdmission-AcuteRespFailure';
    lib.name = 'UM_InpatientAdmission_AcuteRespFailure';
    lib.version = '1.0.0';
    await upsertResource('Library', lib.id, lib);
  }

  // Upload stub CQL libraries for all INTERNAL criteria
  // These are minimal FHIR Library resources that the cql_evaluate_criteria tool
  // can find by ID. They don't contain real CQL — the agent evaluates criteria
  // from clinical data and the dsl_json tree.
  const INTERNAL_LIBRARIES = [
    { id: 'CHF-InpatientAdmission-v1',       name: 'CHFInpatientAdmission',     title: 'Heart Failure Inpatient Admission Criteria' },
    { id: 'Sepsis-InpatientAdmission-v1',     name: 'SepsisInpatientAdmission',  title: 'Sepsis Inpatient Admission Criteria (SSC 2021)' },
    { id: 'CAP-InpatientAdmission-v1',        name: 'CAPInpatientAdmission',     title: 'Community-Acquired Pneumonia Inpatient Criteria (IDSA/ATS)' },
    { id: 'COPD-InpatientAdmission-v1',       name: 'COPDInpatientAdmission',    title: 'COPD Exacerbation Inpatient Criteria (GOLD 2024)' },
    { id: 'STEMI-InpatientAdmission-v1',      name: 'STEMIInpatientAdmission',   title: 'ACS/STEMI Inpatient Admission Criteria (ACC/AHA)' },
    { id: 'Stroke-InpatientAdmission-v1',     name: 'StrokeInpatientAdmission',  title: 'Acute Ischemic Stroke Inpatient Criteria (AHA/ASA)' },
    { id: 'Hip-InpatientAdmission-v1',        name: 'HipInpatientAdmission',     title: 'Hip Fracture/THA Inpatient Admission Criteria (AAOS)' },
    { id: 'AFib-InpatientAdmission-v1',       name: 'AFibInpatientAdmission',    title: 'Atrial Fibrillation Inpatient Criteria (ACC/AHA/HRS 2023)' },
    { id: 'DKA-InpatientAdmission-v1',        name: 'DKAInpatientAdmission',     title: 'DKA/HHS Inpatient Criteria (ADA 2023)' },
    { id: 'UTI-InpatientAdmission-v1',        name: 'UTIInpatientAdmission',     title: 'Complicated UTI/Pyelonephritis Inpatient Criteria (IDSA)' },
    { id: 'InpatientGeneral-v1',              name: 'InpatientGeneralAdmission', title: 'General Inpatient Medical Necessity Criteria' },
  ];

  for (const lib of INTERNAL_LIBRARIES) {
    await upsertResource('Library', lib.id, {
      status: 'active',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/library-type', code: 'logic-library' }] },
      name: lib.name,
      title: lib.title,
      version: '1.0.0',
      url: `http://lucidreview.dev/fhir/Library/${lib.id}`,
      description: `Coverage criteria library for ${lib.title}. Criteria evaluated from clinical data and CMS policy guidelines.`,
      // Stub CQL content: a simple library declaration so HAPI can find it
      content: [{
        contentType: 'text/cql',
        data: btoa(`library "${lib.name}" version '1.0.0'\nusing FHIR version '4.0.1'`),
      }],
    });
  }

  console.log('\n✓ HAPI FHIR initialization complete');
}

main().catch(err => { console.error(err); process.exit(1); });
