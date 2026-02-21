import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // PAS (Prior Authorization Submission) requests
  await knex.schema.createTable('pas_requests', (t) => {
    t.string('id', 36).primary();
    t.string('claim_id', 200).nullable().comment('FHIR Claim.id from the submitted bundle');
    t.string('case_number', 50).nullable().index('idx_pas_case');
    t.json('request_bundle_json').notNullable().comment('Full FHIR Bundle submitted via PAS $submit');
    t.json('response_bundle_json').nullable().comment('FHIR Bundle with ClaimResponse');
    t.enum('status', ['pending', 'pended', 'approved', 'denied', 'error'])
      .notNullable()
      .defaultTo('pending');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  // CDS Hooks call log (for CRD)
  await knex.schema.createTable('cds_hooks_calls', (t) => {
    t.string('id', 36).primary();
    t.string('hook_type', 100).notNullable().comment('e.g. order-select, order-dispatch');
    t.string('hook_instance', 200).nullable();
    t.json('context_json').notNullable();
    t.json('response_json').nullable();
    t.integer('response_ms').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['hook_type', 'created_at'], 'idx_cds_type_time');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('cds_hooks_calls');
  await knex.schema.dropTableIfExists('pas_requests');
}
