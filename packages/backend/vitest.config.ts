import { defineConfig } from 'vitest/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.test if present — provides TEST_DB_* credentials for integration tests
function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const testEnv = loadEnvFile(resolve(__dirname, '.env.test'));

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    env: testEnv,
  },
});
