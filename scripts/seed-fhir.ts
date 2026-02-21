#!/usr/bin/env npx tsx
/**
 * seed-fhir.ts
 *
 * POSTs the test FHIR bundles to HAPI FHIR server.
 * Usage: npx tsx scripts/seed-fhir.ts
 * Env:   HAPI_FHIR_URL (default http://localhost:8080/fhir)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const HAPI_FHIR_URL = process.env.HAPI_FHIR_URL ?? 'http://localhost:8080/fhir';
const BUNDLES_DIR = resolve(
  import.meta.dirname ?? new URL('.', import.meta.url).pathname,
  '../packages/backend/src/fhir/bundles',
);

async function postBundle(filePath: string, fileName: string): Promise<void> {
  const bundle = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(bundle);

  const resourceCount = parsed.entry?.length ?? 0;
  console.log(`\n📦 Posting bundle: ${fileName} (${resourceCount} resources)`);

  const res = await fetch(HAPI_FHIR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/fhir+json' },
    body: bundle,
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`  ❌ FAILED (${res.status}): ${fileName}`);
    console.error(`     ${body.slice(0, 500)}`);
    return;
  }

  const result = await res.json();
  const entries = result.entry ?? [];
  let success = 0;
  let failed = 0;

  for (const entry of entries) {
    const status = entry.response?.status ?? 'unknown';
    const location = entry.response?.location ?? 'unknown';
    if (status.startsWith('2')) {
      success++;
      console.log(`  ✅ ${status} — ${location}`);
    } else {
      failed++;
      console.error(`  ❌ ${status} — ${location}`);
    }
  }

  console.log(`  Summary: ${success} succeeded, ${failed} failed`);
}

async function main(): Promise<void> {
  console.log(`HAPI FHIR URL: ${HAPI_FHIR_URL}`);
  console.log(`Bundles dir:   ${BUNDLES_DIR}`);

  // Wait for HAPI FHIR to be ready
  console.log('\nChecking HAPI FHIR availability...');
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${HAPI_FHIR_URL}/metadata`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        console.log('HAPI FHIR is ready.');
        break;
      }
    } catch {
      // ignore
    }
    if (i === maxRetries - 1) {
      console.error(`HAPI FHIR not available after ${maxRetries} retries. Aborting.`);
      process.exit(1);
    }
    console.log(`  Waiting for HAPI FHIR... (attempt ${i + 1}/${maxRetries})`);
    await new Promise((r) => setTimeout(r, 3000));
  }

  // Find all JSON bundle files
  const files = readdirSync(BUNDLES_DIR).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('No bundle files found.');
    return;
  }

  console.log(`Found ${files.length} bundle(s) to seed.`);

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const file of files) {
    try {
      await postBundle(join(BUNDLES_DIR, file), file);
      totalSuccess++;
    } catch (err) {
      totalFailed++;
      console.error(`  ❌ Error posting ${file}:`, err);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Seeding complete: ${totalSuccess} bundles posted, ${totalFailed} failed.`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main();
