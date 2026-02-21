import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.string('password_hash', 255).nullable();
  });

  await knex.schema.createTable('sessions', (t) => {
    t.string('id', 36).primary();
    t.string('user_id', 36).notNullable();
    t.boolean('revoked').notNullable().defaultTo(false);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('expires_at').notNullable();
    t.foreign('user_id').references('users.id').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('password_hash');
  });
}
