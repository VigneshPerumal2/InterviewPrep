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

## Beginner Deep Dive: What Each Box Means

<div class="system-flow-demo">
  <div class="system-flow-title">Payment request travels through safety checks before money movement</div>
  <div class="flow-lane">
    <div class="flow-node">Merchant API Request</div>
    <div class="flow-node">Authentication + Rate Limit</div>
    <div class="flow-node">Idempotency Check</div>
    <div class="flow-node">Payment Service</div>
    <div class="flow-node">Processor Connector</div>
  </div>
  <div class="flow-packet"></div>
</div>

### Merchant API Request

The merchant sends a request like “authorize 40 dollars for this order.” This request should include amount, currency, merchant id, customer payment token, and an idempotency key.

I choose a clear API contract because payment bugs are expensive. If the request is vague, different teams will interpret it differently.

### Authentication and Rate Limit

Authentication proves the merchant is who they claim to be. Rate limiting protects the system from overload or abusive retry loops.

I choose to check this before touching payment state because invalid callers should not consume expensive fraud or processor capacity.

### Idempotency Check

Idempotency means the same retry should not create a second charge. The system stores a key and returns the original result if the same request arrives again.

This is one of the most important payment concepts. Mobile networks fail, merchant servers retry, and browsers can submit twice. The idempotency layer protects the customer from duplicate money movement.

### Payment Service

The payment service owns the payment state machine. It moves a payment from created, to authorized, to captured, refunded, voided, or failed.

I choose one owner for payment state because scattered state changes make debugging and audit much harder.

### Processor Connector

The connector talks to a payment processor, card network, or issuer-facing system. It converts our internal request into the external provider format.

I keep this behind a connector because providers change independently. If the processor API changes, the core payment service should not need a full rewrite.

### Failure, Multi-region, and Safe Fallback

**risks**: processor timeouts create ambiguous state. The processor may have approved the payment, but our service may not have received the response.

**decisions**: store a pending state, reconcile later, and use idempotency when retrying with the processor.

**security**: never log raw card data. Use tokens, encryption, and least-privilege access.

**compliance**: audit logs should record who requested the action, what decision happened, and when it happened.

For multi-region, I would start with local reads and a primary write region because payment writes need strong correctness. I would choose active-active writes only if the business requires very low global latency and accepts the complexity of conflict handling.

## Follow-up Interview Questions With Answers

**Q: Why not make everything asynchronous?**  
A: Authorization needs a fast decision because the merchant is waiting at checkout. I make audit, analytics, and notifications asynchronous because they should not slow the customer path.

**Q: What if the merchant retries after a timeout?**  
A: The merchant sends the same idempotency key. We return the stored result if we already completed it, or return a pending status if the original request is still processing.

**Q: What if fraud service is down?**  
A: I choose a safe fallback based on risk. For high-risk payments, deny or hold for review. For low-risk merchants, allow only if policy says that is acceptable.

**Q: What is the main tradeoff?**  
A: Strong correctness adds latency and operational complexity, but it prevents duplicate charges and gives reliable auditability.
