import knex from 'knex';
import { config } from '../config.js';

export const db = knex({
  client: 'mysql2',
  connection: {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    timezone: 'UTC',
    typeCast(field: any, next: () => any) {
      // Parse TINY(1) as boolean
      if (field.type === 'TINY' && field.length === 1) {
        return field.string() === '1';
      }
      return next();
    },
  },
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    directory: './migrations',
    extension: 'ts',
    tableName: 'knex_migrations',
  },
});
