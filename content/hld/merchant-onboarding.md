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
