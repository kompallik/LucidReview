CREATE DATABASE IF NOT EXISTS lucidreview;
USE lucidreview;

-- Agent execution tracking
CREATE TABLE agent_runs (
  id VARCHAR(36) PRIMARY KEY,
  case_number VARCHAR(50) NOT NULL,
  status ENUM('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
  model_id VARCHAR(100) NOT NULL,
  prompt_version VARCHAR(50),
  total_turns INT DEFAULT 0,
  determination JSON,
  error TEXT,
  input_tokens_total INT DEFAULT 0,
  output_tokens_total INT DEFAULT 0,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  INDEX idx_agent_runs_case (case_number),
  INDEX idx_agent_runs_status (status)
);

CREATE TABLE agent_turns (
  id VARCHAR(36) PRIMARY KEY,
  run_id VARCHAR(36) NOT NULL,
  turn_number INT NOT NULL,
  role ENUM('user','assistant') NOT NULL,
  content JSON NOT NULL,
  stop_reason VARCHAR(50),
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  latency_ms INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE,
  INDEX idx_turns_run (run_id, turn_number)
);

CREATE TABLE agent_tool_calls (
  id VARCHAR(36) PRIMARY KEY,
  run_id VARCHAR(36) NOT NULL,
  turn_number INT NOT NULL,
  tool_use_id VARCHAR(100) NOT NULL,
  tool_name VARCHAR(100) NOT NULL,
  input JSON NOT NULL,
  output JSON,
  latency_ms INT,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE,
  INDEX idx_tool_calls_run (run_id),
  INDEX idx_tool_calls_name (tool_name)
);

-- Reviews / cases
CREATE TABLE reviews (
  id VARCHAR(36) PRIMARY KEY,
  case_number VARCHAR(50) NOT NULL UNIQUE,
  status ENUM('pending','in_review','decided','appealed') NOT NULL DEFAULT 'pending',
  determination ENUM('AUTO_APPROVE','MD_REVIEW','DENY','MORE_INFO') NULL,
  urgency ENUM('STANDARD','URGENT','RETROSPECTIVE') NOT NULL DEFAULT 'STANDARD',
  service_type VARCHAR(200),
  primary_diagnosis_code VARCHAR(20),
  primary_diagnosis_display VARCHAR(500),
  patient_fhir_id VARCHAR(200),
  reviewer_id VARCHAR(36),
  override_reason TEXT,
  reviewer_notes TEXT,
  latest_run_id VARCHAR(36),
  decided_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reviews_status (status),
  INDEX idx_reviews_determination (determination),
  INDEX idx_reviews_reviewer (reviewer_id)
);

-- Policies
CREATE TABLE policies (
  id VARCHAR(36) PRIMARY KEY,
  policy_type ENUM('NCD','LCD','ARTICLE','INTERNAL') NOT NULL,
  cms_id VARCHAR(50),
  title VARCHAR(500) NOT NULL,
  effective_date DATE,
  retirement_date DATE,
  status ENUM('DRAFT','ACTIVE','RETIRED') NOT NULL DEFAULT 'DRAFT',
  source_url VARCHAR(1000),
  raw_html MEDIUMTEXT,
  sections_json JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_policies_type_status (policy_type, status),
  INDEX idx_policies_cms_id (cms_id)
);

-- Criteria sets
CREATE TABLE criteria_sets (
  id VARCHAR(36) PRIMARY KEY,
  criteria_set_id VARCHAR(200) NOT NULL UNIQUE,
  policy_id VARCHAR(36),
  title VARCHAR(500) NOT NULL,
  scope_setting ENUM('INPATIENT','OUTPATIENT','DME','HOME_HEALTH') NOT NULL,
  scope_request_type ENUM('ADMISSION','CONTINUED_STAY','PROCEDURE','SERVICE','MEDICATION','DME') NOT NULL,
  dsl_json JSON NOT NULL,
  status ENUM('DRAFT','ACTIVE','RETIRED') NOT NULL DEFAULT 'DRAFT',
  cql_library_fhir_id VARCHAR(200),
  questionnaire_fhir_id VARCHAR(200),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (policy_id) REFERENCES policies(id),
  INDEX idx_criteria_status (status)
);

-- Criteria test cases
CREATE TABLE criteria_test_cases (
  id VARCHAR(36) PRIMARY KEY,
  criteria_set_id VARCHAR(36) NOT NULL,
  test_name VARCHAR(200) NOT NULL,
  description TEXT,
  input_bundle_json JSON NOT NULL,
  expected_result ENUM('MET','NOT_MET','UNKNOWN') NOT NULL,
  last_run_at TIMESTAMP NULL,
  last_run_passed BOOLEAN,
  FOREIGN KEY (criteria_set_id) REFERENCES criteria_sets(id)
);

-- Users
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  role ENUM('NURSE_REVIEWER','MD_REVIEWER','ADMIN') NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Audit log
CREATE TABLE audit_log (
  id VARCHAR(36) PRIMARY KEY,
  case_number VARCHAR(50),
  event_type VARCHAR(100) NOT NULL,
  actor_type ENUM('SYSTEM','USER','LLM','CQL_ENGINE','NLP') NOT NULL,
  actor_id VARCHAR(200),
  detail_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_case (case_number),
  INDEX idx_audit_type_time (event_type, created_at)
);

-- Prompt versions
CREATE TABLE prompt_versions (
  id VARCHAR(36) PRIMARY KEY,
  version VARCHAR(50) NOT NULL UNIQUE,
  system_prompt TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed data
INSERT INTO users (id, email, name, role) VALUES
  ('usr-001', 'nurse@lucidreview.dev', 'Sarah Nurse', 'NURSE_REVIEWER'),
  ('usr-002', 'doctor@lucidreview.dev', 'Dr. James MD', 'MD_REVIEWER'),
  ('usr-003', 'admin@lucidreview.dev', 'Admin User', 'ADMIN');

INSERT INTO policies (id, policy_type, cms_id, title, status, sections_json) VALUES
  ('pol-001', 'INTERNAL', 'INTERNAL-ARF-001',
   'Acute Respiratory Failure - Inpatient Admission Criteria',
   'ACTIVE',
   '{"indications": "Acute respiratory failure with documented hypoxia (SpO2 < 90%) or hypercapnia requiring hospital-level monitoring and treatment.", "limitations": "Does not apply to chronic respiratory failure without acute exacerbation.", "documentation": "Must document O2 saturation within 6 hours of request, ABG results if available, and primary diagnosis code."}');

INSERT INTO criteria_sets (id, criteria_set_id, policy_id, title, scope_setting, scope_request_type, dsl_json, status, cql_library_fhir_id) VALUES
  ('cs-001', 'UM.INPATIENT.ADMISSION.ACUTE_RESP_FAILURE.v1', 'pol-001',
   'Acute Respiratory Failure Inpatient Admission',
   'INPATIENT', 'ADMISSION',
   '{"criteriaSetId": "UM.INPATIENT.ADMISSION.ACUTE_RESP_FAILURE.v1", "scope": {"setting": "inpatient", "requestType": "admission"}, "requires": [{"id": "has-resp-failure-dx", "fact": "RespiratoryFailureDiagnosis", "operator": "present", "description": "Active diagnosis of acute respiratory failure (J96.0x)"}, {"id": "low-o2-sat", "fact": "O2Sat", "operator": "<", "value": 90, "unit": "%", "lookback": "6h", "description": "O2 saturation below 90% within last 6 hours"}], "decision": {"approveIfAllMet": true, "escalateIfMissingData": true, "denyIfClearlyNotMet": false}}',
   'ACTIVE',
   'Library/UM_InpatientAdmission_AcuteRespFailure');

INSERT INTO prompt_versions (id, version, system_prompt, active, description) VALUES
  ('pv-001', 'v1.0.0',
   'You are LucidReview, a clinical utilization management review assistant. You help nurse reviewers and physician advisors evaluate prior authorization requests.\n\n## Workflow\n1. GATHER: Use um_get_case to fetch case details. Then um_get_clinical_info and um_get_member_coverage.\n2. ATTACHMENTS: Use um_get_attachments to list attachments. For each PDF, use um_download_attachment then pdf_extract_text.\n3. NLP: For each extracted document, use nlp_extract_clinical_entities.\n4. NORMALIZE: Use fhir_normalize_case to store data as FHIR resources.\n5. POLICY: Use policy_lookup to find applicable coverage policies.\n6. EVALUATE: For each policy with criteria, use cql_evaluate_criteria.\n7. DETERMINE: Use propose_determination to structure the final result.\n8. SYNTHESIZE: Produce a final summary with determination, criteria results, evidence references, and rationale.\n\n## Rules\n- NEVER fabricate clinical facts. Only cite data from tool responses.\n- If data is missing, mark criteria as UNKNOWN and recommend MD_REVIEW.\n- Prefer MD_REVIEW over DENY when data is incomplete or criteria are borderline.\n- Always cite specific FHIR resource IDs and evidence sources.',
   true,
   'Initial production system prompt v1');
