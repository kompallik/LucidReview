import type { Knex } from 'knex';

const config: Knex.Config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 13306),
    user: process.env.DB_USER ?? 'lucidreview',
    password: process.env.DB_PASSWORD ?? 'lucidreview',
    database: process.env.DB_NAME ?? 'lucidreview',
  },
  migrations: {
    directory: './migrations',
    extension: 'ts',
    tableName: 'knex_migrations',
  },
  pool: {
    min: 2,
    max: 10,
  },
};

export default config;
