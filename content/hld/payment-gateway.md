# Design a Payment Gateway

## NEXT THING TO SAY

I will design a payment gateway that accepts merchant payment requests, prevents duplicate charges, routes authorization, and records every decision for support and audit.

```text
Merchant
   |
Payment API
   |
Payment Service ---- Fraud Service
   |
Processor Connector
   |
Issuer / Network
```

## Step 0: 20-second framing

Success means authorization responses are fast, duplicate charges are prevented, and every payment decision is auditable.

## Section 1: Requirements and scope

Top **requirements**:

- Create payment authorizations.
- Capture, refund, and void payments.
- Prevent duplicate requests.
- Store payment state.
- Emit audit and monitoring events.

Safe default: if idempotency state is unknown, do not create a second charge.

Checkpoint question: Does this scope match what you want, or should I change priorities?

## Section 2: Quick capacity and growth

Assume many merchants, uneven traffic, and seasonal spikes. Big merchants can become hotspots.

I choose horizontal stateless API services because they scale predictably. Alternative: one large server is simpler, but I would only choose it for a small internal prototype.

Checkpoint question: Are these assumptions acceptable, or do you want different scale targets?

## Section 3: Core API contracts

- `POST /payments/authorizations`
- `POST /payments/{id}/capture`
- `POST /payments/{id}/refund`
- `GET /payments/{id}`

Use an idempotency key so retries do not create duplicate payments.

Checkpoint question: Should we focus more on write flows or read flows first?

## Section 4: Data model and access patterns

Entities:

- `Payment`
- `Merchant`
- `IdempotencyRecord`
- `AuditEvent`

I choose a relational database for core payment state because correctness and transactions matter. Alternative: a key-value store is useful for idempotency records when very high throughput matters.

**Tenant boundary**: every payment stores `merchant_id`, and every query includes it.

Checkpoint question: Do you want strict correctness here, or can we allow slightly stale reads?

## Section 5: High-level architecture

```text
Client
  |
API Gateway
  |
Auth + Rate Limit
  |
Payment Service
  |---- Idempotency Store
  |---- Payment Database
  |---- Fraud Service
  |---- Processor Connector
  |
Event Stream -> Audit / Notifications / Analytics
```

I choose synchronous processing for authorization because the merchant needs a decision. I choose asynchronous events for audit, notifications, and analytics because they should not slow the payment response.

Checkpoint question: Should I deep dive into duplicate prevention, processor failures, or audit next?

## Section 6: Key workflows

Authorization flow:

- Validate request.
- Authenticate merchant.
- Check idempotency.
- Run fraud check.
- Call processor.
- Store result.
- Emit event.

Failure handling:

- Timeout to processor: return safe pending state or retry depending on processor contract.
- Duplicate replay: return original result.
- Fraud unavailable: choose deny-by-default for high-risk transactions.

## Section 7: Deep dive

Multi-region:

- Reads can be local.
- Writes should start with one primary write region for correctness.
- Failover requires replay-safe events and idempotency records.

Boundary rules:

- Keep merchant data isolated by merchant and region.
- Store audit logs with retention policy.

## Section 8: Reliability, observability, security

Track logs, metrics, and traces for payment id, merchant id, latency, approval rate, duplicate rate, and processor errors.

Use strong authentication, authorization, encryption in transit, encryption at rest, and audit logs.

## Section 9: Tradeoffs and wrap

- **key decision**: synchronous authorization, asynchronous side effects.
- **tradeoff**: single write region is simpler but can add cross-region latency.
- **risk**: processor timeout can create ambiguity.
- **mitigation**: idempotency, reconciliation, and audit events.
