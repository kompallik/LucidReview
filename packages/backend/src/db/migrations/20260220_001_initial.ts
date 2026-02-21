import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // agent_runs
  await knex.schema.createTable('agent_runs', (t) => {
    t.string('id', 36).primary();
    t.string('case_number', 50).notNullable().index('idx_agent_runs_case');
    t.enum('status', ['pending', 'running', 'completed', 'failed', 'cancelled'])
      .notNullable()
      .defaultTo('pending')
      .index('idx_agent_runs_status');
    t.string('model_id', 100).notNullable();
    t.string('prompt_version', 50).nullable();
    t.integer('total_turns').defaultTo(0);
    t.json('determination').nullable();
    t.text('error').nullable();
    t.integer('input_tokens_total').defaultTo(0);
    t.integer('output_tokens_total').defaultTo(0);
    t.timestamp('started_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('completed_at').nullable();
  });

  // agent_turns
  await knex.schema.createTable('agent_turns', (t) => {
    t.string('id', 36).primary();
    t.string('run_id', 36).notNullable();
    t.integer('turn_number').notNullable();
    t.enum('role', ['user', 'assistant']).notNullable();
    t.json('content').notNullable();
    t.string('stop_reason', 50).nullable();
    t.integer('input_tokens').defaultTo(0);
    t.integer('output_tokens').defaultTo(0);
    t.integer('latency_ms').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.foreign('run_id').references('agent_runs.id').onDelete('CASCADE');
    t.index(['run_id', 'turn_number'], 'idx_turns_run');
  });

  // agent_tool_calls
  await knex.schema.createTable('agent_tool_calls', (t) => {
    t.string('id', 36).primary();
    t.string('run_id', 36).notNullable();
    t.integer('turn_number').notNullable();
    t.string('tool_use_id', 100).notNullable();
    t.string('tool_name', 100).notNullable();
    t.json('input').notNullable();
    t.json('output').nullable();
    t.integer('latency_ms').nullable();
    t.text('error').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.foreign('run_id').references('agent_runs.id').onDelete('CASCADE');
    t.index(['run_id'], 'idx_tool_calls_run');
    t.index(['tool_name'], 'idx_tool_calls_name');
  });

  // reviews
  await knex.schema.createTable('reviews', (t) => {
    t.string('id', 36).primary();
    t.string('case_number', 50).notNullable().unique();
    t.enum('status', ['pending', 'in_review', 'decided', 'appealed'])
      .notNullable()
      .defaultTo('pending')
      .index('idx_reviews_status');
    t.enum('determination', ['AUTO_APPROVE', 'MD_REVIEW', 'DENY', 'MORE_INFO'])
      .nullable()
      .index('idx_reviews_determination');
    t.enum('urgency', ['STANDARD', 'URGENT', 'RETROSPECTIVE'])
      .notNullable()
      .defaultTo('STANDARD');
    t.string('service_type', 200).nullable();
    t.string('primary_diagnosis_code', 20).nullable();
    t.string('primary_diagnosis_display', 500).nullable();
    t.string('patient_fhir_id', 200).nullable();
    t.string('reviewer_id', 36).nullable().index('idx_reviews_reviewer');
    t.text('override_reason').nullable();
    t.text('reviewer_notes').nullable();
    t.string('latest_run_id', 36).nullable();
    t.timestamp('decided_at').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  // policies
  await knex.schema.createTable('policies', (t) => {
    t.string('id', 36).primary();
    t.enum('policy_type', ['NCD', 'LCD', 'ARTICLE', 'INTERNAL']).notNullable();
    t.string('cms_id', 50).nullable().index('idx_policies_cms_id');
    t.string('title', 500).notNullable();
    t.date('effective_date').nullable();
    t.date('retirement_date').nullable();
    t.enum('status', ['DRAFT', 'ACTIVE', 'RETIRED'])
      .notNullable()
      .defaultTo('DRAFT');
    t.string('source_url', 1000).nullable();
    t.text('raw_html', 'mediumtext').nullable();
    t.json('sections_json').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    t.index(['policy_type', 'status'], 'idx_policies_type_status');
  });

  // criteria_sets
  await knex.schema.createTable('criteria_sets', (t) => {
    t.string('id', 36).primary();
    t.string('criteria_set_id', 200).notNullable().unique();
    t.string('policy_id', 36).nullable();
    t.string('title', 500).notNullable();
    t.enum('scope_setting', ['INPATIENT', 'OUTPATIENT', 'DME', 'HOME_HEALTH']).notNullable();
    t.enum('scope_request_type', [
      'ADMISSION', 'CONTINUED_STAY', 'PROCEDURE', 'SERVICE', 'MEDICATION', 'DME',
    ]).notNullable();
    t.json('dsl_json').notNullable();
    t.enum('status', ['DRAFT', 'ACTIVE', 'RETIRED'])
      .notNullable()
      .defaultTo('DRAFT')
      .index('idx_criteria_status');
    t.string('cql_library_fhir_id', 200).nullable();
    t.string('questionnaire_fhir_id', 200).nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    t.foreign('policy_id').references('policies.id');
  });

  // criteria_test_cases
  await knex.schema.createTable('criteria_test_cases', (t) => {
    t.string('id', 36).primary();
    t.string('criteria_set_id', 36).notNullable();
    t.string('test_name', 200).notNullable();
    t.text('description').nullable();
    t.json('input_bundle_json').notNullable();
    t.enum('expected_result', ['MET', 'NOT_MET', 'UNKNOWN']).notNullable();
    t.timestamp('last_run_at').nullable();
    t.boolean('last_run_passed').nullable();
    t.foreign('criteria_set_id').references('criteria_sets.id');
  });

  // users
  await knex.schema.createTable('users', (t) => {
    t.string('id', 36).primary();
    t.string('email', 255).notNullable().unique();
    t.string('name', 200).notNullable();
    t.enum('role', ['NURSE_REVIEWER', 'MD_REVIEWER', 'ADMIN']).notNullable();
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  // audit_log
  await knex.schema.createTable('audit_log', (t) => {
    t.string('id', 36).primary();
    t.string('case_number', 50).nullable().index('idx_audit_case');
    t.string('event_type', 100).notNullable();
    t.enum('actor_type', ['SYSTEM', 'USER', 'LLM', 'CQL_ENGINE', 'NLP']).notNullable();
    t.string('actor_id', 200).nullable();
    t.json('detail_json').notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['event_type', 'created_at'], 'idx_audit_type_time');
  });

  // prompt_versions
  await knex.schema.createTable('prompt_versions', (t) => {
    t.string('id', 36).primary();
    t.string('version', 50).notNullable().unique();
    t.text('system_prompt').notNullable();
    t.boolean('active').notNullable().defaultTo(false);
    t.text('description').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('criteria_test_cases');
  await knex.schema.dropTableIfExists('criteria_sets');
  await knex.schema.dropTableIfExists('agent_tool_calls');
  await knex.schema.dropTableIfExists('agent_turns');
  await knex.schema.dropTableIfExists('audit_log');
  await knex.schema.dropTableIfExists('prompt_versions');
  await knex.schema.dropTableIfExists('reviews');
  await knex.schema.dropTableIfExists('policies');
  await knex.schema.dropTableIfExists('agent_runs');
  await knex.schema.dropTableIfExists('users');
}
