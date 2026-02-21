#!/usr/bin/env npx tsx
/**
 * setup.ts
 *
 * Combined setup script that seeds FHIR bundles and uploads CQL libraries.
 * Usage: npx tsx scripts/setup.ts
 * Env:   HAPI_FHIR_URL (default http://localhost:8080/fhir)
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const scriptsDir = import.meta.dirname ?? new URL('.', import.meta.url).pathname;

function run(script: string, label: string): void {
  const scriptPath = resolve(scriptsDir, script);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`▶ ${label}`);
  console.log(`${'='.repeat(60)}\n`);

  execSync(`npx tsx ${scriptPath}`, {
    stdio: 'inherit',
    env: process.env,
  });
}

async function main(): Promise<void> {
  console.log('LucidReview FHIR Setup');
  console.log(`HAPI_FHIR_URL: ${process.env.HAPI_FHIR_URL ?? 'http://localhost:8080/fhir'}`);

  try {
    run('seed-fhir.ts', 'Step 1/2: Seeding FHIR test bundles');
    run('upload-cql.ts', 'Step 2/2: Uploading CQL libraries');

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ Setup complete! FHIR server is ready.');
    console.log(`${'='.repeat(60)}`);
  } catch (err) {
    console.error('\n❌ Setup failed. See errors above.');
    process.exit(1);
  }
}

main();
