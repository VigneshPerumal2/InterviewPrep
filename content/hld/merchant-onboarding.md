# Merchant Onboarding Platform

## NEXT THING TO SAY

I will design merchant onboarding as a workflow system with clear states, validation, review, audit, and configuration publishing.

```text
Merchant UI -> Merchant API -> Workflow Service -> Review
                                    |
                              Merchant Store
```

## Step 0: 20-second framing

Success means merchants can submit applications, reviewers can make decisions, and approved merchants get reliable configuration.

## Section 1: Requirements and scope

**requirements**:

- Create merchant application.
- Upload required data.
- Submit for review.
- Track status.
- Publish approved configuration.

Safe default: unknown review state means merchant cannot process payments yet.

## Section 2: Quick capacity and growth

Onboarding is lower traffic than payments but has important audit and compliance needs.

## Section 3: Core API contracts

- `POST /merchants`
- `PATCH /merchants/{id}`
- `POST /merchants/{id}/submit`
- `GET /merchants/{id}/status`

## Section 4: Data model and access patterns

Entities: `Merchant`, `Application`, `ReviewDecision`, `Document`, `AuditEvent`.

I choose relational storage because workflow state and review records need correctness. Alternative: document storage is useful when application forms vary heavily.

## Section 5: High-level architecture

```text
Onboarding UI
   |
Merchant API
   |
Workflow Service
   |---- Document Store
   |---- Merchant Database
   |---- Review Queue
   |
Config Publisher
```

## Section 6: Key workflows

Submit workflow:

- Validate fields.
- Store application.
- Create review task.
- Notify reviewer.
- Audit the transition.

## Section 7: Deep dive

Boundary rules:

- Reviewers should see only assigned tenants or regions.
- Documents must follow retention and data residency rules.

## Section 8: Reliability, observability, security

Use role-based access, encryption, audit logs, status dashboards, and safe rollout of new form fields.

## Section 9: Tradeoffs and wrap

- **key decision**: explicit workflow states.
- **tradeoff**: strict workflow adds complexity but improves correctness.
- **risk**: stuck applications.
- **mitigation**: monitoring and aging alerts.

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

I choose structured fields because compliance checks and risk checks need consistent data. Free text is harder to validate.

### Document Upload

Documents can include business registration, identity proof, bank proof, or tax documents. The system should store files in object storage and metadata in a database.

I choose object storage because documents are large files. The database should store references, not the file bytes.

### Risk and Compliance Checks

Checks can verify identity, business legitimacy, restricted categories, sanctions lists, and expected transaction volume.

**compliance** matters here because onboarding decides who is allowed to use the payment network.

### Review Queue

Some merchants need human review. A reviewer should see the application, documents, risk reasons, and history.

I choose a review queue because not every decision should be automated. Human review is safer for unclear or high-risk cases.

### Activation

Activation publishes merchant configuration so payment systems know the merchant is allowed to process payments.

This should be event-driven because many systems need the new merchant state: payment gateway, fraud, billing, reporting, and support tools.

### Failure, Multi-region, and Safe Fallback

**risks**: partial activation, missing documents, stale merchant status, and accidental approval.

**decisions**: use an explicit state machine, audit every state change, and deny payment processing until activation is fully complete.

For multi-region, document storage must respect data residency rules. A merchant in one region may need documents stored and reviewed only in that region.

## Follow-up Interview Questions With Answers

**Q: Why use a state machine?**  
A: It prevents invalid jumps such as moving from draft directly to active without review.

**Q: What if activation event fails?**  
A: Store the activation event in an outbox table and retry until downstream systems receive it.

**Q: What is the safe default?**  
A: If merchant status is unknown, do not allow payment processing.
