# Real-Time Fraud Detection

## NEXT THING TO SAY

I will design fraud detection as a low-latency decision service that uses rules, features, and model scoring, while preserving auditability for every decision.

```text
Payment Service -> Fraud API -> Rules + Model
                       |
                  Feature Store
```

## Step 0: 20-second framing

Success means fast decisions, explainable reason codes, and safe behavior when data is missing.

## Section 1: Requirements and scope

**requirements**:

- Score a transaction.
- Return approve, review, or decline.
- Include reason codes.
- Support model versioning.
- Store audit records.

Safe default: if fraud data is unavailable for high-risk traffic, send to review or decline based on policy.

## Section 2: Quick capacity and growth

Fraud checks sit on the payment path, so response time matters. Popular merchants can create hotspots.

## Section 3: Core API contracts

`POST /fraud/decisions` accepts transaction details and returns action, score, reason codes, and model version.

## Section 4: Data model and access patterns

Entities:

- `FraudDecision`
- `RiskFeature`
- `FraudRule`
- `ModelVersion`

I choose a low-latency key-value store for hot features because decisions need fast reads. Alternative: relational storage is better for rule management and governance.

## Section 5: High-level architecture

```text
Payment Service
   |
Fraud Decision API
   |---- Feature Cache
   |---- Rules Engine
   |---- Model Service
   |
Decision Log -> Audit Store
```

## Section 6: Key workflows

Decision flow:

- Receive transaction.
- Fetch features.
- Evaluate rules.
- Score model.
- Return decision and reasons.
- Write audit event.

Failure behavior:

- Feature cache down: read source store if possible.
- Model unavailable: use rules-only fallback.
- Policy unknown: safe fallback based on risk level.

## Section 7: Deep dive

Multi-region:

- Keep feature reads local where possible.
- Replicate model versions carefully.
- Respect data residency for customer and merchant data.

## Section 8: Reliability, observability, security

Monitor decision time, model errors, feature freshness, approve/review/decline rates, and rule changes.

## Section 9: Tradeoffs and wrap

- **key decision**: rules plus model gives explainability and flexibility.
- **tradeoff**: more components mean more operational work.
- **risk**: stale features.
- **mitigation**: freshness checks and safe fallback.
