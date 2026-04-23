# Merchant Onboarding Platform

## NEXT THING TO SAY

I will design merchant onboarding as a workflow system with explicit states, validation gates, compliance checks, document management, and event-driven activation publishing.

```text
Merchant UI -> Merchant API -> Workflow Service -> Review
                                    |
                              Merchant Store
```

## Step 0: 20-second framing

Success means merchants can submit applications and track progress, reviewers can make informed decisions with full context, approved merchants get reliable configuration published to all downstream systems, and every state change is auditable for compliance.

## Section 1: Requirements and scope

**requirements**:

- Create and submit merchant applications with structured data.
- Upload and validate required documents (business registration, identity proof, bank details).
- Run automated compliance checks (sanctions screening, business category validation).
- Queue applications for manual review when automated checks are inconclusive.
- Publish approved merchant configuration to payment gateway, fraud, billing, and reporting systems.
- Track full state history for every application for audit and compliance.

Non-functional **requirements**:

- Auto-approved merchants activated within 2 hours.
- Manual review completed within 5 business days.
- 99.9 percent availability for the application submission path.
- Document uploads up to 25 megabytes per file.
- GDPR and data residency compliance for merchant personal data.

Safe default: unknown review state means merchant cannot process payments yet.

## Section 2: Quick capacity and growth

<div class="capacity-callout">
  <div class="capacity-metric"><strong>10,000</strong><span>New Apps/Day</span></div>
  <div class="capacity-metric"><strong>2 hrs</strong><span>Auto-Approve SLA</span></div>
  <div class="capacity-metric"><strong>5 days</strong><span>Manual Review SLA</span></div>
  <div class="capacity-metric"><strong>25 MB</strong><span>Max Doc Size</span></div>
</div>

Onboarding is lower traffic than payments but has strict audit and compliance needs. Peak periods coincide with business registration seasons and marketing campaigns that attract new merchants.

## Section 3: Core API contracts

```text
POST /merchants
  Body: legal_name, business_type, country, owner_name, owner_email,
        expected_monthly_volume, business_category, bank_account
  Response 201: merchant_id, status (draft)

PATCH /merchants/{id}
  Body: partial update fields
  Response: updated merchant object

POST /merchants/{id}/documents
  Body: multipart file upload, document_type (registration, identity, bank_proof)
  Response: document_id, upload_status

POST /merchants/{id}/submit
  Response: application_status (submitted), review_type (auto or manual)

GET /merchants/{id}/status
  Response: current_state, state_history, pending_actions, reviewer_notes
```

## Section 4: Data model and access patterns

<div class="schema-card">
  <div class="schema-card-header">merchant_applications</div>
  <div class="schema-field"><span class="schema-field-name">merchant_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge pk">PK</span></div>
  <div class="schema-field"><span class="schema-field-name">legal_name</span><span class="schema-field-type">VARCHAR</span></div>
  <div class="schema-field"><span class="schema-field-name">business_type</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">sole_proprietor, LLC, corporation</span></div>
  <div class="schema-field"><span class="schema-field-name">country</span><span class="schema-field-type">VARCHAR(2)</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">business_category</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-badge idx">IDX</span><span class="schema-field-note">MCC code</span></div>
  <div class="schema-field"><span class="schema-field-name">current_state</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-badge idx">IDX</span><span class="schema-field-note">draft, submitted, under_review, approved, rejected, active, suspended</span></div>
  <div class="schema-field"><span class="schema-field-name">risk_score</span><span class="schema-field-type">FLOAT</span><span class="schema-field-note">Automated risk assessment</span></div>
  <div class="schema-field"><span class="schema-field-name">reviewer_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge fk">FK</span></div>
  <div class="schema-field"><span class="schema-field-name">created_at</span><span class="schema-field-type">TIMESTAMP</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">updated_at</span><span class="schema-field-type">TIMESTAMP</span></div>
</div>

<div class="schema-card">
  <div class="schema-card-header">state_transitions (audit trail)</div>
  <div class="schema-field"><span class="schema-field-name">transition_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge pk">PK</span></div>
  <div class="schema-field"><span class="schema-field-name">merchant_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge idx">IDX</span><span class="schema-field-badge fk">FK</span></div>
  <div class="schema-field"><span class="schema-field-name">from_state</span><span class="schema-field-type">VARCHAR</span></div>
  <div class="schema-field"><span class="schema-field-name">to_state</span><span class="schema-field-type">VARCHAR</span></div>
  <div class="schema-field"><span class="schema-field-name">actor</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">system, reviewer email, or API caller</span></div>
  <div class="schema-field"><span class="schema-field-name">reason</span><span class="schema-field-type">TEXT</span></div>
  <div class="schema-field"><span class="schema-field-name">created_at</span><span class="schema-field-type">TIMESTAMP</span><span class="schema-field-badge idx">IDX</span></div>
</div>

I choose relational storage because workflow state and review records need correctness. Alternative: document storage is useful when application forms vary heavily by country.

## Section 5: High-level architecture

<div class="flow-multi">
  <div class="flow-multi-title">Merchant onboarding workflow with compliance gates</div>
  <div class="flow-multi-label">Application intake</div>
  <div class="flow-multi-row">
    <div class="flow-node">Merchant Portal</div>
    <div class="flow-node">Application API</div>
    <div class="flow-node">Document Upload (S3)</div>
    <div class="flow-node">Validation Service</div>
  </div>
  <div class="flow-multi-label">Compliance and review</div>
  <div class="flow-multi-row">
    <div class="flow-node">Sanctions Screening</div>
    <div class="flow-node">Business Verification</div>
    <div class="flow-node">Risk Scoring</div>
    <div class="flow-node">Review Queue</div>
  </div>
  <div class="flow-multi-label">Activation and distribution</div>
  <div class="flow-multi-row">
    <div class="flow-node-success">Config Publisher</div>
    <div class="flow-node-success">Payment Gateway Config</div>
    <div class="flow-node-success">Fraud Service Config</div>
    <div class="flow-node-success">Billing Setup</div>
  </div>
</div>

## Section 6: Key workflows

<div class="sequence-steps">
  <div class="sequence-steps-title">Complete onboarding workflow from application to activation</div>
  <div class="seq-step"><div class="seq-step-content"><strong>Merchant creates application</strong><span>Enter legal name, business type, country, expected volume, bank details. Application saved as DRAFT. Merchant can edit until submission. <span class="seq-step-fail">Validation error → field-level feedback</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Upload required documents</strong><span>Business registration, identity proof, bank proof uploaded directly to object storage via signed URL. Metadata stored in database. File type and size validation on upload. <span class="seq-step-fail">Invalid file type → reject with clear error</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Submit for review</strong><span>Validate all required fields and documents are present. Run automated field checks. Transition from DRAFT to SUBMITTED. <span class="seq-step-fail">Missing documents → block submission with checklist</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Automated compliance checks</strong><span>Screen owner names against sanctions lists. Verify business registration number format. Check business category against restricted list. Compute risk score. <span class="seq-step-fail">Sanctions match → auto-reject with compliance flag</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Route to auto-approve or manual review</strong><span>Low-risk merchants (risk score below 0.3, common category, domestic) auto-approve. High-risk or inconclusive results go to manual review queue. <span class="seq-step-fail">Unclear risk → always route to manual review</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Manual reviewer evaluates</strong><span>Reviewer sees application, documents, risk reasons, and compliance check results. Reviewer approves, rejects, or requests additional information. Every action recorded with reviewer identity and timestamp. <span class="seq-step-fail">Reviewer timeout → aging alert after 3 days</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Publish merchant configuration</strong><span>On approval, publish merchant configuration to payment gateway, fraud service, billing, and reporting via event stream. Use outbox pattern to guarantee delivery. Transition to ACTIVE only after all critical systems confirm. <span class="seq-step-fail">Publish failure → outbox retry, do not activate</span></span></div></div>
</div>

### State machine

<div class="decision-tree">
  <div class="decision-tree-title">Valid merchant application state transitions</div>
  <div class="decision-row">
    <div class="decision-node question">DRAFT → SUBMITTED (all required fields and documents present)</div>
  </div>
  <div class="decision-row">
    <div class="decision-node question">SUBMITTED → UNDER_REVIEW (compliance checks complete)</div>
  </div>
  <div class="decision-row">
    <div class="decision-node yes">UNDER_REVIEW → APPROVED (reviewer or auto-approve)</div>
    <div class="decision-arrow">|</div>
    <div class="decision-node no">UNDER_REVIEW → REJECTED (reviewer with reason)</div>
  </div>
  <div class="decision-row">
    <div class="decision-node yes">APPROVED → ACTIVE (config published to all systems)</div>
    <div class="decision-arrow">|</div>
    <div class="decision-node no">REJECTED → DRAFT (merchant resubmits with fixes)</div>
  </div>
  <div class="decision-row">
    <div class="decision-node question">ACTIVE → SUSPENDED (compliance issue or fraud concern)</div>
  </div>
</div>

**Invalid transitions that the system must reject**: DRAFT directly to ACTIVE, REJECTED directly to ACTIVE, SUBMITTED directly to ACTIVE.

## Section 7: Deep dive

### KYC/KYB integration

Know Your Customer (KYC) and Know Your Business (KYB) checks verify the identity of the business owner and the legitimacy of the business.

**Integration points**:

- Identity verification API: verify owner name, date of birth, and government ID against official records.
- Business registry API: confirm registration number, legal name, and active status.
- Sanctions screening API: check names against OFAC, EU sanctions, and PEP (Politically Exposed Persons) lists.
- Bank account verification: validate bank routing and account number format by country.

**Failure handling**: If any external verification service is down, hold the application in SUBMITTED state and retry. Do not auto-approve with incomplete checks.

### Boundary rules

- Reviewers should see only assigned tenants or regions.
- Documents must follow retention and data residency rules.
- EU merchant documents stored and reviewed only in EU region.
- Document access requires role-based authorization and is audit-logged.

## Section 8: Reliability, observability, security

**Key metrics**: application-to-activation time (P50, P99), auto-approve rate, review queue depth, aging applications (submitted but not reviewed in 3+ days), rejection rate by category.

Use role-based access, encryption, audit logs, status dashboards, and safe rollout of new form fields.

## Section 9: Tradeoffs and wrap

- **key decision**: explicit workflow states with a state machine.
- **key decision**: outbox pattern for reliable config publishing.
- **tradeoff**: strict workflow adds complexity but prevents dangerous invalid transitions like DRAFT → ACTIVE.
- **tradeoff**: automated compliance checks reduce review time but require ongoing maintenance of screening lists.
- **risk**: stuck applications with no reviewer action.
- **mitigation**: aging alerts at 3 days, escalation at 5 days, auto-assignment rotation.
- **risk**: partial activation where some downstream systems receive config but others do not.
- **mitigation**: outbox retry and activation gate that requires confirmation from all critical systems.

## Beginner Deep Dive: Merchant Onboarding Platform

<div class="system-flow-demo">
  <div class="system-flow-title">Onboarding moves a merchant through checks before payment access is enabled</div>
  <div class="flow-lane">
    <div class="flow-node">Merchant Application</div>
    <div class="flow-node">Document Upload</div>
    <div class="flow-node">Risk + Compliance Checks</div>
    <div class="flow-node">Review Queue</div>
    <div class="flow-node">Activation</div>
  </div>
  <div class="flow-packet"></div>
</div>

### Merchant Application

This is the form where a business enters legal name, address, owner details, bank information, expected volume, and product category.

I choose structured fields because compliance checks and risk checks need consistent data. Free text is harder to validate programmatically.

**MCC codes**: Merchant Category Codes classify what the business sells. Some categories (gambling, adult content, cryptocurrency) are restricted or prohibited by card networks. The onboarding system must validate the category and apply additional scrutiny for high-risk categories.

### Document Upload

Documents can include business registration, identity proof, bank proof, or tax documents. The system should store files in object storage and metadata in a database.

I choose object storage because documents are large binary files. The database should store references (object key, content type, upload time, virus scan status), not the file bytes.

**Upload flow**: Client requests a signed upload URL from the API. Client uploads directly to object storage using the signed URL. The API stores metadata after confirming upload completion. This keeps large files off the API servers.

### Risk and Compliance Checks

Checks can verify identity, business legitimacy, restricted categories, sanctions lists, and expected transaction volume.

**compliance** matters here because onboarding decides who is allowed to use the payment network. Allowing a sanctioned entity onto the network is a serious legal violation.

**Automated risk scoring**: Combine signals like business age, category risk, country risk, expected volume, and sanctions check results into a composite score. Merchants below a threshold auto-approve. Merchants above a threshold go to manual review.

### Review Queue

Some merchants need human review. A reviewer should see the application, documents, risk reasons, and history all in one screen.

I choose a review queue because not every decision should be automated. Human review is safer for unclear or high-risk cases. The queue should support assignment, aging alerts, and reviewer notes.

### Activation

Activation publishes merchant configuration so payment systems know the merchant is allowed to process payments.

This should be event-driven because many systems need the new merchant state: payment gateway, fraud, billing, reporting, and support tools. Using an outbox pattern guarantees the activation event is published even if the event stream is temporarily down.

### Failure, Multi-region, and Safe Fallback

**risks**: partial activation, missing documents, stale merchant status, and accidental approval of a sanctioned entity.

**decisions**: use an explicit state machine, audit every state change, and deny payment processing until activation is fully complete across all critical downstream systems.

For multi-region, document storage must respect data residency rules. A merchant in one region may need documents stored and reviewed only in that region.

## Follow-up Interview Questions With Answers

**Q: Why use a state machine?**  
A: It prevents invalid jumps such as moving from draft directly to active without review. The state machine makes every possible transition explicit and testable. It also makes the audit trail meaningful because every transition has a defined from-state, to-state, actor, and timestamp.

**Q: What if activation event fails?**  
A: Store the activation event in an outbox table within the same database transaction as the state change to APPROVED. A background worker reads the outbox and publishes to downstream systems. Retry until all critical systems confirm receipt. The merchant transitions to ACTIVE only after all confirmations.

**Q: What is the safe default?**  
A: If merchant status is unknown or in any non-ACTIVE state, do not allow payment processing. The payment gateway should reject transactions from merchants that are not confirmed ACTIVE.

**Q: How do you handle re-submission after rejection?**  
A: A rejected application transitions back to DRAFT. The merchant can update fields and documents, then resubmit. The new submission goes through the full review cycle again. The history of the previous rejection and its reasons is preserved for the reviewer.

**Q: How do you handle different onboarding requirements by country?**  
A: Use a configuration-driven approach where each country has a required-documents list, required-fields list, and applicable compliance checks. The workflow engine loads the country configuration and validates accordingly. Adding a new country means adding configuration, not code changes.
