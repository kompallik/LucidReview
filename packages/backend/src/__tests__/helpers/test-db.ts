import knex, { type Knex } from 'knex';

/**
 * Tables in dependency order (children first) for truncation.
 */
const TABLES = [
  'sessions',
  'criteria_test_cases',
  'criteria_sets',
  'agent_tool_calls',
  'agent_turns',
  'audit_log',
  'prompt_versions',
  'reviews',
  'policies',
  'agent_runs',
  'users',
] as const;

let _db: Knex | undefined;

/**
 * Get or create a Knex connection for tests.
 * Uses TEST_DB_* env vars with fallbacks to localhost:13306 / lucidreview_test.
 */
export function getTestDb(): Knex {
  if (!_db) {
    _db = knex({
      client: 'mysql2',
      connection: {
        host: process.env.TEST_DB_HOST ?? '127.0.0.1',
        port: Number(process.env.TEST_DB_PORT ?? 13306),
        user: process.env.TEST_DB_USER ?? 'root',
        password: process.env.TEST_DB_PASSWORD ?? 'root_dev',
        database: process.env.TEST_DB_NAME ?? 'lucidreview_test',
      },
      pool: { min: 1, max: 5 },
    });
  }
  return _db;
}

/**
 * Truncate all application tables (disables FK checks temporarily).
 * Call in beforeAll/beforeEach to reset state between test suites.
 */
export async function truncateAllTables(): Promise<void> {
  const db = getTestDb();
  await db.raw('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES) {
    await db.raw(`TRUNCATE TABLE \`${table}\``);
  }
  await db.raw('SET FOREIGN_KEY_CHECKS = 1');
}

/**
 * Destroy the Knex connection pool. Call in afterAll.
 */
export async function destroyTestDb(): Promise<void> {
  if (_db) {
    await _db.destroy();
    _db = undefined;
  }
}
