#!/usr/bin/env npx tsx
/**
 * upload-cql.ts
 *
 * PUTs CQL Library resources to HAPI FHIR server.
 * Reads all *.Library.json files from the libraries directory.
 * Usage: npx tsx scripts/upload-cql.ts
 * Env:   HAPI_FHIR_URL (default http://localhost:8080/fhir)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const HAPI_FHIR_URL = process.env.HAPI_FHIR_URL ?? 'http://localhost:8080/fhir';
const LIBRARIES_DIR = resolve(
  import.meta.dirname ?? new URL('.', import.meta.url).pathname,
  '../packages/backend/src/fhir/libraries',
);

async function waitForHapiFhir(): Promise<void> {
  console.log('Checking HAPI FHIR availability...');
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${HAPI_FHIR_URL}/metadata`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        console.log('HAPI FHIR is ready.');
        return;
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
}

async function uploadLibrary(filePath: string, fileName: string): Promise<boolean> {
  const content = readFileSync(filePath, 'utf-8');
  const library = JSON.parse(content);
  const libraryId = library.id;

  if (!libraryId) {
    console.error(`  ❌ No id field in ${fileName}, skipping.`);
    return false;
  }

  const url = `${HAPI_FHIR_URL}/Library/${libraryId}`;
  console.log(`\n📚 Uploading: ${fileName} → ${url}`);

  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/fhir+json' },
    body: content,
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`  ❌ FAILED (${res.status}): ${fileName}`);
    console.error(`     ${body.slice(0, 500)}`);
    return false;
  }

  const result = await res.json();
  console.log(`  ✅ ${res.status} — Library/${result.id} (v${result.version ?? 'unknown'})`);
  return true;
}

async function main(): Promise<void> {
  console.log(`HAPI FHIR URL:  ${HAPI_FHIR_URL}`);
  console.log(`Libraries dir:  ${LIBRARIES_DIR}`);

  await waitForHapiFhir();

  // Find all Library JSON files
  const files = readdirSync(LIBRARIES_DIR).filter((f) => f.endsWith('.Library.json'));
  if (files.length === 0) {
    console.log('No Library JSON files found.');
    return;
  }

  console.log(`Found ${files.length} library resource(s) to upload.`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    try {
      const ok = await uploadLibrary(join(LIBRARIES_DIR, file), file);
      if (ok) success++;
      else failed++;
    } catch (err) {
      failed++;
      console.error(`  ❌ Error uploading ${file}:`, err);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Upload complete: ${success} succeeded, ${failed} failed.`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
