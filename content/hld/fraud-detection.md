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

## Beginner Deep Dive: Real-time Fraud Detection

<div class="system-flow-demo">
  <div class="system-flow-title">Fraud decision combines request data, history, rules, and model score</div>
  <div class="flow-lane">
    <div class="flow-node">Payment Request</div>
    <div class="flow-node">Feature Lookup</div>
    <div class="flow-node">Rules Engine</div>
    <div class="flow-node">Model Score</div>
    <div class="flow-node">Decision + Reason</div>
  </div>
  <div class="flow-packet"></div>
</div>

### Feature Lookup

A feature is a useful fact about the transaction. Examples: merchant risk level, customer country, device history, recent failed payments, and transaction amount compared with normal behavior.

I choose a feature cache because fraud decisions must be fast. Reading every fact from slow databases during checkout would increase latency.

### Rules Engine

A rule is a human-readable condition such as “block if the card country and merchant country are unusual and the amount is high.” Rules are easier to explain than machine learning scores.

I choose rules for clear policy enforcement and compliance review. The alternative is only using a model, which may be more flexible but harder to explain.

### Model Score

A model score estimates risk based on historical patterns. The model should return a score and ideally the main reasons.

I choose model scoring after basic validation because we should not spend model capacity on invalid or unauthorized requests.

### Decision and Reason Codes

The output should not be only allow or block. It should include a reason such as suspicious velocity, invalid merchant, high-risk country, or manual review needed.

Reason codes help support, audit, and model improvement.

### Failure, Multi-region, and Safe Fallback

**risks**: stale features, model timeout, false positives, and false negatives.

**decisions**: use timeouts, return manual review for uncertain high-risk cases, and keep a rule fallback if the model is unavailable.

**security**: fraud data may contain sensitive signals, so access must be limited and audited.

For multi-region, feature reads should be local where possible. Model deployment should be versioned per region. If a region has stale data, the system should prefer a conservative decision for high-risk transactions.

## Follow-up Interview Questions With Answers

**Q: Why use both rules and machine learning?**  
A: Rules are explainable and good for policy. Models are better at finding complex patterns. Using both gives control and adaptability.

**Q: What happens if fraud service is slow?**  
A: The payment service uses a timeout. Depending on risk, it can deny, approve low-risk traffic, or send the transaction to manual review.

**Q: How do you avoid hurting good customers?**  
A: Track false positives, use reason codes, allow manual review, and tune thresholds per merchant or region.
