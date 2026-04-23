# Design a Payment Gateway

## NEXT THING TO SAY

I will design a payment gateway that accepts merchant payment requests, prevents duplicate charges, routes authorization through processors, and records every decision for support and audit. I will start with a simple correct design, then scale only where the requirements force it.

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

Success means authorization responses are fast, duplicate charges are prevented, and every payment decision is auditable for compliance and support.

## Section 1: Requirements and scope

Top **requirements**:

- Create payment authorizations.
- Capture, refund, and void payments.
- Prevent duplicate requests using idempotency keys.
- Store the complete payment state machine.
- Emit audit and monitoring events for every state change.

Non-functional **requirements**:

- P99 authorization latency under 500 milliseconds.
- 99.99 percent availability for the authorization path.
- Zero duplicate money movement. A retry must never create a second charge.
- All decisions auditable and queryable for at least 7 years.
- Support for thousands of merchants with uneven traffic patterns.

Out of scope: merchant dashboard UI, billing and invoicing, chargeback dispute management, card tokenization vault.

Safe default: if idempotency state is unknown, do not create a second charge. Return a safe pending status instead.

Checkpoint question: Does this scope match what you want, or should I change priorities?

## Section 2: Quick capacity and growth

<div class="capacity-callout">
  <div class="capacity-metric"><strong>10,000</strong><span>Peak Auth TPS</span></div>
  <div class="capacity-metric"><strong>350ms</strong><span>P50 Latency</span></div>
  <div class="capacity-metric"><strong>500ms</strong><span>P99 Latency</span></div>
  <div class="capacity-metric"><strong>99.99%</strong><span>Availability</span></div>
</div>

**Traffic shape**: Payment traffic is bursty. Average may be 2,000 TPS, but Black Friday or payroll spikes can hit 10,000 TPS for sustained periods. A single large merchant can produce 30 percent of total traffic.

**Storage math**: Each payment record including metadata, audit fields, and idempotency data is roughly 3 kilobytes. At 100 million transactions per day, that is about 300 gigabytes per day raw, or roughly 2 terabytes per year after indexing and replication overhead.

**Database sizing**: At 10,000 TPS with average query time of 5 milliseconds, we need roughly 50 active database connections. PostgreSQL handles this well with connection pooling. Above 20,000 TPS, consider sharding by merchant group.

I choose horizontal stateless API services because they scale predictably. Alternative: one large server is simpler, but I would only choose it for a small internal prototype.

Checkpoint question: Are these assumptions acceptable, or do you want different scale targets?

## Section 3: Core API contracts

```text
POST /payments/authorizations
  Headers: Idempotency-Key, Authorization (Bearer token), Content-Type
  Body:
    merchant_id       string    required
    amount            integer   required (minor units, e.g. cents)
    currency          string    required (ISO 4217, e.g. "USD")
    payment_token     string    required (tokenized card reference)
    order_reference   string    optional (merchant order ID)
    metadata          object    optional (merchant custom fields)
  Response 201:
    payment_id        string
    status            string    (authorized, declined, pending)
    processor_code    string    (processor response code)
    created_at        string    (ISO 8601)
  Errors:
    400  Invalid request (missing fields, bad currency)
    401  Authentication failed
    409  Idempotency conflict (same key, different body)
    429  Rate limited
    502  Processor unavailable
```

```text
POST /payments/{id}/capture
  Body: amount (optional partial capture)
  Response: payment_id, status (captured), captured_amount

POST /payments/{id}/refund
  Body: amount (optional partial refund), reason
  Response: payment_id, status (refunded), refunded_amount

GET /payments/{id}
  Response: full payment object with state history
```

Use an idempotency key so retries do not create duplicate payments. The key must be unique per merchant per request intent.

Checkpoint question: Should we focus more on write flows or read flows first?

## Section 4: Data model and access patterns

<div class="schema-card">
  <div class="schema-card-header">payments</div>
  <div class="schema-field"><span class="schema-field-name">payment_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge pk">PK</span></div>
  <div class="schema-field"><span class="schema-field-name">merchant_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge idx">IDX</span><span class="schema-field-badge fk">FK</span></div>
  <div class="schema-field"><span class="schema-field-name">amount</span><span class="schema-field-type">BIGINT</span><span class="schema-field-note">Minor units (cents)</span></div>
  <div class="schema-field"><span class="schema-field-name">currency</span><span class="schema-field-type">VARCHAR(3)</span><span class="schema-field-note">ISO 4217</span></div>
  <div class="schema-field"><span class="schema-field-name">status</span><span class="schema-field-type">VARCHAR(20)</span><span class="schema-field-badge idx">IDX</span><span class="schema-field-note">authorized, captured, declined, pending, failed</span></div>
  <div class="schema-field"><span class="schema-field-name">payment_token</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">Tokenized card reference, never raw PAN</span></div>
  <div class="schema-field"><span class="schema-field-name">processor_code</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">Processor response code</span></div>
  <div class="schema-field"><span class="schema-field-name">idempotency_key</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-badge idx">IDX</span><span class="schema-field-note">Unique per merchant</span></div>
  <div class="schema-field"><span class="schema-field-name">created_at</span><span class="schema-field-type">TIMESTAMP</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">updated_at</span><span class="schema-field-type">TIMESTAMP</span></div>
</div>

<div class="schema-card">
  <div class="schema-card-header">idempotency_records</div>
  <div class="schema-field"><span class="schema-field-name">idempotency_key</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-badge pk">PK</span></div>
  <div class="schema-field"><span class="schema-field-name">merchant_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge pk">PK</span></div>
  <div class="schema-field"><span class="schema-field-name">request_hash</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">SHA-256 of request body</span></div>
  <div class="schema-field"><span class="schema-field-name">status</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">in_progress, completed, failed</span></div>
  <div class="schema-field"><span class="schema-field-name">response_body</span><span class="schema-field-type">JSONB</span><span class="schema-field-note">Stored response for replay</span></div>
  <div class="schema-field"><span class="schema-field-name">expires_at</span><span class="schema-field-type">TIMESTAMP</span><span class="schema-field-badge idx">IDX</span><span class="schema-field-note">TTL for cleanup</span></div>
</div>

<div class="schema-card">
  <div class="schema-card-header">audit_events</div>
  <div class="schema-field"><span class="schema-field-name">event_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge pk">PK</span></div>
  <div class="schema-field"><span class="schema-field-name">payment_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge idx">IDX</span><span class="schema-field-badge fk">FK</span></div>
  <div class="schema-field"><span class="schema-field-name">merchant_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">action</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">authorize, capture, refund, void, decline</span></div>
  <div class="schema-field"><span class="schema-field-name">actor</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">API caller identity</span></div>
  <div class="schema-field"><span class="schema-field-name">metadata</span><span class="schema-field-type">JSONB</span></div>
  <div class="schema-field"><span class="schema-field-name">created_at</span><span class="schema-field-type">TIMESTAMP</span><span class="schema-field-badge idx">IDX</span></div>
</div>

I choose a relational database for core payment state because correctness and transactions matter. Payments require ACID guarantees: a payment should not be both authorized and failed simultaneously.

**Partition strategy**: Composite key of `merchant_id` plus a shard bucket derived from `payment_id`. Pure merchant-based partitioning creates hotspots because a few large merchants generate most traffic.

**Tenant boundary**: every payment stores `merchant_id`, and every query includes it. This prevents cross-tenant data leakage and enables per-merchant indexing.

Checkpoint question: Do you want strict correctness here, or can we allow slightly stale reads?

## Section 5: High-level architecture

<div class="flow-multi">
  <div class="flow-multi-title">Payment gateway architecture with synchronous and asynchronous paths</div>
  <div class="flow-multi-label">Synchronous authorization path (latency-sensitive)</div>
  <div class="flow-multi-row">
    <div class="flow-node">API Gateway + Auth</div>
    <div class="flow-node">Rate Limiter</div>
    <div class="flow-node">Idempotency Check</div>
    <div class="flow-node">Payment Service</div>
    <div class="flow-node">Processor Connector</div>
  </div>
  <div class="flow-multi-label">Asynchronous side effects (not on critical path)</div>
  <div class="flow-multi-row">
    <div class="flow-node-success">Event Stream</div>
    <div class="flow-node-success">Audit Writer</div>
    <div class="flow-node-success">Notification Service</div>
    <div class="flow-node-success">Analytics Pipeline</div>
    <div class="flow-node-success">Reconciliation</div>
  </div>
</div>

I choose synchronous processing for authorization because the merchant needs a fast decision at checkout. I choose asynchronous events for audit, notifications, and analytics because they should not slow the payment response.

**Why separate the processor connector**: External processors change independently. Different processors have different APIs, timeout behaviors, and retry contracts. Keeping this behind an adapter means the core payment service does not need a rewrite when we add a new processor.

**Why event stream for side effects**: If the audit writer is slow or the notification service is down, the authorization response should not wait. The event stream buffers reliably and lets each consumer process at its own pace.

Checkpoint question: Should I deep dive into duplicate prevention, processor failures, or audit next?

## Section 6: Key workflows

<div class="sequence-steps">
  <div class="sequence-steps-title">Authorization flow — step by step with failure handling</div>
  <div class="seq-step"><div class="seq-step-content"><strong>API Gateway receives request</strong><span>TLS termination, request parsing, authentication check. Verify merchant API key is valid and has authorization permissions. <span class="seq-step-fail">Invalid key → 401</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Rate limiter checks merchant quota</strong><span>Token bucket per merchant per endpoint. Large merchants get higher limits. <span class="seq-step-fail">Over limit → 429 with Retry-After header</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Idempotency layer checks for duplicate</strong><span>Lookup by (merchant_id, idempotency_key). If found with matching request hash, return stored response immediately. If found with different hash, reject with 409. If not found, insert a record with status in_progress. <span class="seq-step-fail">Different hash → 409</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Payment validator checks business rules</strong><span>Amount must be positive. Currency must be supported. Merchant must be active. Payment token must be valid format. <span class="seq-step-fail">Invalid → 400 with field-level errors</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Fraud service evaluates risk</strong><span>Call fraud API with transaction details. Fraud returns approve, review, or decline with reason codes. If fraud service times out after 100 milliseconds, use fallback policy. <span class="seq-step-fail">Timeout → deny high-risk, allow low-risk per policy</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Processor connector sends authorization</strong><span>Convert internal format to processor API format. Send with 3-second timeout. Processor returns approval code, decline reason, or timeout. <span class="seq-step-fail">Timeout → store PENDING, schedule reconciliation</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Payment service stores result atomically</strong><span>Write payment record and update idempotency record status to completed in a single database transaction. This guarantees the stored state matches the returned response. <span class="seq-step-fail">DB failure → retry with idempotency protection</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Event emitter publishes to stream</strong><span>Emit PaymentAuthorized or PaymentDeclined event. If stream is unavailable, write to outbox table for later publishing. Downstream consumers (audit, notifications, analytics) process independently. <span class="seq-step-fail">Stream down → outbox retry</span></span></div></div>
</div>

### Processor timeout — the hardest problem

When the processor times out, the system is in an ambiguous state. The processor may have approved the charge, but our system did not receive the confirmation.

**Safe resolution**:

1. Store the payment as PENDING.
2. Return PENDING to the merchant with guidance to poll for status.
3. Schedule a reconciliation job that queries the processor for the real status.
4. If the processor confirms approval, update to AUTHORIZED.
5. If the processor has no record, update to FAILED and the merchant can retry.
6. Use the idempotency key when querying the processor so the reconciliation is also safe.

This is the single most important failure scenario in a payment gateway. Interviewers expect you to handle it without prompting.

## Section 7: Deep dive

### Multi-region architecture

<div class="compare-grid">
  <div class="compare-card">
    <h4>Active-Passive (Recommended Start)</h4>
    <ul>
      <li>One primary region handles all writes</li>
      <li>Secondary region has read replicas</li>
      <li>Failover requires DNS switch and event replay</li>
      <li>Simpler correctness guarantees</li>
      <li>Higher cross-region write latency</li>
    </ul>
  </div>
  <div class="compare-card">
    <h4>Active-Active (Advanced)</h4>
    <ul>
      <li>Both regions handle writes</li>
      <li>Requires conflict resolution strategy</li>
      <li>Lower latency for global merchants</li>
      <li>Much higher operational complexity</li>
      <li>Risk of split-brain on network partition</li>
    </ul>
  </div>
</div>

**My recommendation**: Start active-passive. Payment correctness is more important than cross-region latency. Move to active-active only when the business requires sub-100ms global authorization and accepts the operational cost.

### Boundary rules

- Keep merchant data isolated by merchant and region.
- Store audit logs with 7-year retention policy.
- Never store raw card numbers. Use tokenized references only.
- Encrypt sensitive fields at rest and in transit.

## Section 8: Reliability, observability, security

**Observability stack**:

- **Logs**: structured JSON with payment_id, merchant_id, request_id, latency_ms, status, processor_code.
- **Metrics**: P50/P99 authorization latency, approval rate by merchant, duplicate request rate, processor error rate, idempotency hit rate.
- **Traces**: distributed trace ID from API gateway through fraud, processor, database, and event stream.
- **Dashboards**: real-time approval rate, latency heatmap, error budget burn-down.
- **Alerts**: approval rate drops below 95 percent, P99 latency exceeds 800ms, processor error rate above 1 percent.

**Security layers**:

- Mutual TLS between internal services.
- API key with merchant-specific scopes and rate limits.
- Encryption at rest for payment data (AES-256).
- Encryption in transit (TLS 1.3).
- PCI DSS compliance boundary around payment data stores.
- Least-privilege IAM roles for service accounts.
- Audit log for every administrative action.

## Section 9: Tradeoffs and wrap

- **key decision**: synchronous authorization, asynchronous side effects.
- **key decision**: relational database for payment state, event stream for audit distribution.
- **tradeoff**: single write region is simpler but can add cross-region latency for distant merchants.
- **tradeoff**: strict idempotency adds storage cost and lookup latency, but prevents duplicate charges.
- **risk**: processor timeout creates ambiguous state.
- **mitigation**: pending state, reconciliation job, and idempotent processor retry.
- **risk**: large merchant creates hotspot on a single database partition.
- **mitigation**: composite shard key using merchant_id plus payment_id hash bucket.

## Beginner Deep Dive: What Each Box Means

<div class="flow-multi">
  <div class="flow-multi-title">Three possible authorization outcomes</div>
  <div class="flow-multi-label">Happy path — approved</div>
  <div class="flow-multi-row">
    <div class="flow-node">Merchant Request</div>
    <div class="flow-node">Auth + Rate Limit</div>
    <div class="flow-node">Idempotency Check</div>
    <div class="flow-node">Fraud: Approve</div>
    <div class="flow-node-success">Processor: Approved</div>
  </div>
  <div class="flow-multi-label">Fraud decline path</div>
  <div class="flow-multi-row">
    <div class="flow-node">Merchant Request</div>
    <div class="flow-node">Auth + Rate Limit</div>
    <div class="flow-node">Idempotency Check</div>
    <div class="flow-node-danger">Fraud: Decline</div>
    <div class="flow-node-danger">Skip Processor → Decline</div>
  </div>
  <div class="flow-multi-label">Timeout path — ambiguous state</div>
  <div class="flow-multi-row">
    <div class="flow-node">Merchant Request</div>
    <div class="flow-node">Auth + Rate Limit</div>
    <div class="flow-node">Idempotency Check</div>
    <div class="flow-node">Fraud: Approve</div>
    <div class="flow-node-warn">Processor: Timeout → PENDING</div>
  </div>
</div>

### Merchant API Request

The merchant sends a request like "authorize 40 dollars for this order." This request should include amount, currency, merchant id, customer payment token, and an idempotency key.

I choose a clear API contract because payment bugs are expensive. If the request is vague, different teams will interpret it differently and create inconsistencies.

**Why minor units**: Storing amounts as integers in minor units (cents) avoids floating-point rounding errors. 40 dollars is stored as 4000 cents. This is an industry standard.

### Authentication and Rate Limit

Authentication proves the merchant is who they claim to be. Rate limiting protects the system from overload or abusive retry loops.

I choose to check this before touching payment state because invalid callers should not consume expensive fraud or processor capacity.

**Rate limit strategy**: Token bucket per merchant per endpoint. A merchant with 1,000 TPS allocation can burst to 1,200 briefly but cannot sustain above their limit. Return HTTP 429 with Retry-After header so the merchant SDK can back off intelligently.

### Idempotency Check

Idempotency means the same retry should not create a second charge. The system stores a key and returns the original result if the same request arrives again.

This is one of the most important payment concepts. Mobile networks fail, merchant servers retry, and browsers can submit twice. The idempotency layer protects the customer from duplicate money movement.

**How it works internally**:

1. Compute SHA-256 hash of the request body.
2. Attempt to insert a record with (merchant_id, idempotency_key, request_hash, status=in_progress).
3. If insert succeeds, this is the first request. Continue processing.
4. If insert fails due to unique constraint, read the existing record.
5. If existing record has matching request_hash, return the stored response.
6. If existing record has different request_hash, return 409 conflict.

### Payment Service

The payment service owns the payment state machine. It moves a payment from created, to authorized, to captured, refunded, voided, or failed.

I choose one owner for payment state because scattered state changes make debugging and audit much harder.

**State machine transitions**:

- created → authorized (processor approved)
- created → declined (fraud or processor declined)
- created → pending (processor timeout)
- pending → authorized (reconciliation confirmed)
- pending → failed (reconciliation found no charge)
- authorized → captured (merchant captures funds)
- authorized → voided (merchant cancels before capture)
- captured → refunded (full or partial refund)

### Processor Connector

The connector talks to a payment processor, card network, or issuer-facing system. It converts our internal request into the external provider format.

I keep this behind a connector because providers change independently. If the processor API changes, the core payment service should not need a full rewrite.

**Connector responsibilities**: format conversion, timeout management, retry policy per processor, response normalization, and credential management.

### Failure, Multi-region, and Safe Fallback

**risks**: processor timeouts create ambiguous state. The processor may have approved the payment, but our service may not have received the response.

**decisions**: store a pending state, reconcile later, and use idempotency when retrying with the processor.

**security**: never log raw card data. Use tokens, encryption, and least-privilege access.

**compliance**: audit logs should record who requested the action, what decision happened, and when it happened.

For multi-region, I would start with local reads and a primary write region because payment writes need strong correctness. I would choose active-active writes only if the business requires very low global latency and accepts the complexity of conflict handling.

## Follow-up Interview Questions With Answers

**Q: Why not make everything asynchronous?**  
A: Authorization needs a fast decision because the merchant is waiting at checkout. The customer is holding their phone or standing at a terminal. I make audit, analytics, and notifications asynchronous because they should not slow the customer path.

**Q: What if the merchant retries after a timeout?**  
A: The merchant sends the same idempotency key. We return the stored result if we already completed it, or return a pending status if the original request is still processing. The merchant should poll for final status using GET /payments/{id}.

**Q: What if fraud service is down?**  
A: I choose a safe fallback based on risk. For high-risk payments (new merchant, large amount, international), deny or hold for review. For low-risk merchants with established history, allow only if risk policy explicitly permits it. Never silently skip fraud for all traffic.

**Q: How do you handle partial captures?**  
A: The capture endpoint accepts an optional amount. If the amount is less than the authorized amount, record a partial capture. The remaining authorized amount can be captured later or will expire based on processor rules (typically 7 to 30 days).

**Q: What is the main tradeoff?**  
A: Strong correctness adds latency and operational complexity, but it prevents duplicate charges and gives reliable auditability. Every payment system eventually needs this level of correctness, so I build it in from the start rather than retrofitting.

**Q: How do you handle processor failover?**  
A: Configure a primary and secondary processor per merchant or payment method. If the primary returns a 5xx error or times out consistently, route to the secondary. Use circuit breaker pattern: after 5 consecutive failures, open the circuit and route all traffic to the secondary for 30 seconds before retrying the primary.
