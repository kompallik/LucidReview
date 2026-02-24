import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('policies', (t) => {
    t.integer('cms_document_id').unsigned().nullable();
    t.json('icd10_covered').nullable();
    t.json('icd10_noncovered').nullable();
    t.json('hcpcs_codes').nullable();
    t.timestamp('last_synced_at').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('policies', (t) => {
    t.dropColumn('cms_document_id');
    t.dropColumn('icd10_covered');
    t.dropColumn('icd10_noncovered');
    t.dropColumn('hcpcs_codes');
    t.dropColumn('last_synced_at');
  });
}
