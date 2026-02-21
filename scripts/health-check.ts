#!/usr/bin/env npx tsx
/**
 * health-check.ts
 *
 * Checks connectivity to all LucidReview infrastructure services.
 * Usage: npx tsx scripts/health-check.ts
 *
 * Env overrides:
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD
 *   HAPI_FHIR_URL
 *   REDIS_HOST, REDIS_PORT
 *   CTAKES_URL
 *   BACKEND_URL
 */

import { execSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT ?? '13306', 10);
const DB_USER = process.env.DB_USER ?? 'root';
const DB_PASSWORD = process.env.DB_PASSWORD ?? 'root_dev';
const HAPI_FHIR_URL = process.env.HAPI_FHIR_URL ?? 'http://localhost:8080/fhir';
const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
const REDIS_PORT = process.env.REDIS_PORT ?? '6379';
const CTAKES_URL = process.env.CTAKES_URL ?? 'http://localhost:8081';
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// ANSI colors
// ---------------------------------------------------------------------------
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

interface CheckResult {
  service: string;
  endpoint: string;
  status: 'UP' | 'DOWN' | 'WARN';
  detail: string;
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// Service checks
// ---------------------------------------------------------------------------
async function checkMySQL(): Promise<CheckResult> {
  const start = Date.now();
  const endpoint = `${DB_HOST}:${DB_PORT}`;
  try {
    // Try mysql2 programmatic ping if available, fall back to mysqladmin CLI
    try {
      const mysql2 = await import('mysql2/promise');
      const conn = await mysql2.createConnection({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        connectTimeout: 5000,
      });
      await conn.ping();
      const [rows] = await conn.query('SELECT VERSION() as v') as any;
      const version = rows[0]?.v ?? 'unknown';
      await conn.end();
      return { service: 'MySQL', endpoint, status: 'UP', detail: `v${version}`, latencyMs: Date.now() - start };
    } catch {
      // Fall back to CLI
      execSync(
        `mysqladmin ping -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p${DB_PASSWORD} --connect-timeout=5 2>/dev/null`,
        { timeout: 6000 },
      );
      return { service: 'MySQL', endpoint, status: 'UP', detail: 'ping ok (CLI)', latencyMs: Date.now() - start };
    }
  } catch (err: any) {
    return { service: 'MySQL', endpoint, status: 'DOWN', detail: err.message?.slice(0, 80) ?? 'connection failed', latencyMs: Date.now() - start };
  }
}

async function checkHapiFhir(): Promise<CheckResult> {
  const start = Date.now();
  const endpoint = HAPI_FHIR_URL;
  try {
    const res = await fetch(`${HAPI_FHIR_URL}/metadata`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const body = await res.json();
      const version = body.software?.version ?? 'unknown';
      return { service: 'HAPI FHIR', endpoint, status: 'UP', detail: `v${version}, FHIR ${body.fhirVersion ?? 'R4'}`, latencyMs: Date.now() - start };
    }
    return { service: 'HAPI FHIR', endpoint, status: 'DOWN', detail: `HTTP ${res.status}`, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { service: 'HAPI FHIR', endpoint, status: 'DOWN', detail: err.message?.slice(0, 80) ?? 'fetch failed', latencyMs: Date.now() - start };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = Date.now();
  const endpoint = `${REDIS_HOST}:${REDIS_PORT}`;
  try {
    const result = execSync(
      `redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} ping 2>/dev/null`,
      { timeout: 5000, encoding: 'utf-8' },
    ).trim();
    if (result === 'PONG') {
      // Get version
      let version = 'unknown';
      try {
        const info = execSync(
          `redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} info server 2>/dev/null`,
          { timeout: 3000, encoding: 'utf-8' },
        );
        const match = info.match(/redis_version:(\S+)/);
        if (match) version = match[1];
      } catch { /* ignore */ }
      return { service: 'Redis', endpoint, status: 'UP', detail: `v${version}`, latencyMs: Date.now() - start };
    }
    return { service: 'Redis', endpoint, status: 'DOWN', detail: `unexpected: ${result}`, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { service: 'Redis', endpoint, status: 'DOWN', detail: err.message?.slice(0, 80) ?? 'ping failed', latencyMs: Date.now() - start };
  }
}

async function checkCtakes(): Promise<CheckResult> {
  const start = Date.now();
  const endpoint = CTAKES_URL;
  try {
    const res = await fetch(`${CTAKES_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const body = await res.json();
      return { service: 'cTAKES NLP', endpoint, status: 'UP', detail: body.status ?? 'ok', latencyMs: Date.now() - start };
    }
    return { service: 'cTAKES NLP', endpoint, status: 'DOWN', detail: `HTTP ${res.status}`, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { service: 'cTAKES NLP', endpoint, status: 'DOWN', detail: err.message?.slice(0, 80) ?? 'fetch failed', latencyMs: Date.now() - start };
  }
}

async function checkBackend(): Promise<CheckResult> {
  const start = Date.now();
  const endpoint = BACKEND_URL;
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const body = await res.json();
      return { service: 'Backend', endpoint, status: 'UP', detail: body.version ?? 'ok', latencyMs: Date.now() - start };
    }
    return { service: 'Backend', endpoint, status: 'WARN', detail: `HTTP ${res.status}`, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { service: 'Backend', endpoint, status: 'DOWN', detail: err.message?.slice(0, 80) ?? 'fetch failed', latencyMs: Date.now() - start };
  }
}

// ---------------------------------------------------------------------------
// Render table
// ---------------------------------------------------------------------------
function statusColor(status: string): string {
  if (status === 'UP') return GREEN;
  if (status === 'WARN') return YELLOW;
  return RED;
}

function renderTable(results: CheckResult[]): void {
  const svcWidth = 12;
  const statusWidth = 6;
  const endpointWidth = 30;
  const latWidth = 8;
  const detailWidth = 40;

  const header = [
    'Service'.padEnd(svcWidth),
    'Status'.padEnd(statusWidth),
    'Endpoint'.padEnd(endpointWidth),
    'Latency'.padEnd(latWidth),
    'Detail',
  ].join('  ');

  const separator = '-'.repeat(svcWidth + statusWidth + endpointWidth + latWidth + detailWidth + 8);

  console.log(`\n${BOLD}${CYAN}LucidReview Infrastructure Health Check${RESET}\n`);
  console.log(`${DIM}${separator}${RESET}`);
  console.log(`${BOLD}${header}${RESET}`);
  console.log(`${DIM}${separator}${RESET}`);

  for (const r of results) {
    const sColor = statusColor(r.status);
    const row = [
      r.service.padEnd(svcWidth),
      `${sColor}${r.status.padEnd(statusWidth)}${RESET}`,
      `${DIM}${r.endpoint.padEnd(endpointWidth)}${RESET}`,
      `${DIM}${(r.latencyMs + 'ms').padEnd(latWidth)}${RESET}`,
      r.detail.slice(0, detailWidth),
    ].join('  ');
    console.log(row);
  }

  console.log(`${DIM}${separator}${RESET}`);

  const up = results.filter((r) => r.status === 'UP').length;
  const down = results.filter((r) => r.status === 'DOWN').length;
  const warn = results.filter((r) => r.status === 'WARN').length;
  console.log(
    `\n${GREEN}${up} up${RESET}` +
    (warn > 0 ? `, ${YELLOW}${warn} warn${RESET}` : '') +
    (down > 0 ? `, ${RED}${down} down${RESET}` : '') +
    ` of ${results.length} services\n`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const results = await Promise.all([
    checkMySQL(),
    checkHapiFhir(),
    checkRedis(),
    checkCtakes(),
    checkBackend(),
  ]);

  renderTable(results);

  const anyDown = results.some((r) => r.status === 'DOWN');
  if (anyDown) {
    process.exit(1);
  }
}

main();
