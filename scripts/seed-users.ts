#!/usr/bin/env npx tsx
/**
 * Seed default users into the LucidReview database.
 *
 * Usage:
 *   npx tsx scripts/seed-users.ts
 *   npx tsx scripts/seed-users.ts --password mypassword  (override default password)
 *
 * Default credentials (CHANGE IN PRODUCTION):
 *   nurse@lucidreview.dev   / LucidReview2026!
 *   md@lucidreview.dev      / LucidReview2026!
 *   admin@lucidreview.dev   / LucidReview2026!
 */
import { randomUUID } from 'node:crypto';

const DEFAULT_PASSWORD = process.argv.includes('--password')
  ? process.argv[process.argv.indexOf('--password') + 1]
  : 'LucidReview2026!';

const SEED_USERS = [
  { email: 'nurse@lucidreview.dev', name: 'Demo Nurse Reviewer', role: 'NURSE_REVIEWER' },
  { email: 'md@lucidreview.dev',    name: 'Demo MD Reviewer',    role: 'MD_REVIEWER'    },
  { email: 'admin@lucidreview.dev', name: 'Demo Admin',          role: 'ADMIN'          },
];

async function main() {
  const { default: knex } = await import('knex');
  const { hashPassword } = await import('../packages/backend/src/services/auth.service.js');

  const db = knex({
    client: 'mysql2',
    connection: {
      host:     process.env.DB_HOST     ?? '127.0.0.1',
      port:     Number(process.env.DB_PORT ?? 13306),
      user:     process.env.DB_USER     ?? 'document_ai_admin',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME     ?? 'lucidreview',
    },
  });

  try {
    const hash = await hashPassword(DEFAULT_PASSWORD);

    for (const u of SEED_USERS) {
      const existing = await db('users').where({ email: u.email }).first();
      if (existing) {
        await db('users').where({ email: u.email }).update({ password_hash: hash, name: u.name, role: u.role, active: true });
        console.log(`Updated: ${u.email} (${u.role})`);
      } else {
        await db('users').insert({ id: randomUUID(), ...u, active: true, password_hash: hash, created_at: new Date() });
        console.log(`Created: ${u.email} (${u.role})`);
      }
    }

    console.log(`\nDefault password: ${DEFAULT_PASSWORD}`);
    console.log('Change these credentials before deploying to production!');
  } finally {
    await db.destroy();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
