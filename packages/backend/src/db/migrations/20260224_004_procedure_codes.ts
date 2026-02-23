import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('criteria_sets', (t) => {
    // JSON array of CPT/HCPCS procedure codes this criteria set applies to
    // e.g. ["27130","27447"] for Total Joint Arthroplasty
    t.json('procedure_codes').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('criteria_sets', (t) => {
    t.dropColumn('procedure_codes');
  });
}
