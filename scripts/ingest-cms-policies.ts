#!/usr/bin/env node
/**
 * CMS Policy Ingestion CLI
 *
 * Usage:
 *   npx tsx scripts/ingest-cms-policies.ts --type NCD --id 20.4
 *   npx tsx scripts/ingest-cms-policies.ts --type LCD --id L33797
 *   npx tsx scripts/ingest-cms-policies.ts --sync-all
 *
 * Environment:
 *   DATABASE_URL or DB_* vars from packages/backend/.env
 */

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const syncAll = args.includes('--sync-all');
const type = getArg('--type')?.toUpperCase() as 'NCD' | 'LCD' | undefined;
const id = getArg('--id');

async function main() {
  // Dynamic import so this script can be run with tsx from the repo root
  const { ingestNcdFromCms, ingestLcdFromCms, syncActivePolicies } = await import(
    '../packages/backend/src/services/policy-ingestion.service.js'
  );

  if (syncAll) {
    console.log('Starting full CMS policy sync...');
    const result = await syncActivePolicies();
    console.log(`Sync complete: ${result.ingested} created, ${result.updated} updated, ${result.errors.length} errors`);
    if (result.errors.length > 0) {
      console.error('Errors:');
      for (const e of result.errors) {
        console.error(`  ${e.id}: ${e.error}`);
      }
    }
    process.exit(result.errors.length > 0 ? 1 : 0);
  }

  if (!type || !id) {
    console.error('Usage: ingest-cms-policies --type NCD|LCD --id <id>');
    console.error('       ingest-cms-policies --sync-all');
    process.exit(1);
  }

  console.log(`Ingesting ${type} ${id}...`);
  const result = type === 'NCD' ? await ingestNcdFromCms(id) : await ingestLcdFromCms(id);
  console.log(`${result.action === 'created' ? 'Created' : 'Updated'}: [${result.id}] ${result.title}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
