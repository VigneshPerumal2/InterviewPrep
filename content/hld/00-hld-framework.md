# HLD Interview Framework

## NEXT THING TO SAY

I will start with a simple baseline design, then scale it only where the requirements force us to scale. I will call out **requirements**, **security**, **reliability**, **operational items**, and **tradeoffs** as I go.

## Step 0: 20-second framing

Say the goal in one line, then give 2 to 3 measurable targets in full words.

Example:

> The goal is to design a payment gateway that accepts merchant payment requests, prevents duplicate charges, and records every decision. Success means low response time for authorization, high availability during peak traffic, and complete auditability for support and compliance.

**Why this matters**: The interviewer is deciding in the first 30 seconds whether you understand the problem. A clear framing shows you can scope quickly.

**Common mistake**: Jumping straight into components without stating what success looks like. Always anchor on measurable outcomes.

## Section 1: Requirements and scope

Cover:

- Functional **requirements**: what the system must do for users.
- Non-functional **requirements**: latency, throughput, availability, durability, consistency.
- Out of scope: what you are explicitly not covering.
- Safe defaults: what happens when state is unknown.

**Example for a payment gateway**:

Functional: accept authorization, capture, refund, void. Prevent duplicate charges. Emit audit events.

Non-functional: P99 authorization latency under 500 milliseconds. 99.99 percent availability. Zero duplicate money movement. All decisions auditable for 7 years.

Out of scope: merchant dashboard UI, billing invoices, chargeback disputes.

Safe default: if idempotency state is unknown, do not create a second charge.

Checkpoint question:

> Does this scope match what you want, or should I change priorities?

## Section 2: Quick capacity and growth

Use simple math. Say peak requests per second in words, not shorthand.

<div class="capacity-callout">
  <div class="capacity-metric"><strong>10,000</strong><span>Peak TPS</span></div>
  <div class="capacity-metric"><strong>500ms</strong><span>P99 Latency</span></div>
  <div class="capacity-metric"><strong>99.99%</strong><span>Availability</span></div>
  <div class="capacity-metric"><strong>2 TB/yr</strong><span>Storage Growth</span></div>
</div>

### Capacity Estimation Cheat Sheet

**Daily transactions**: Start from business context. A large payment processor handles 100 million to 500 million transactions per day. A single large merchant might send 1 million per day.

**Peak multiplier**: Payment traffic spikes 3 to 5 times average during holidays, flash sales, and payroll days.

**Storage per transaction**: A payment record with metadata, audit trail, and idempotency key uses roughly 2 to 4 kilobytes. At 100 million transactions per day, that is 200 to 400 gigabytes per day, or roughly 2 terabytes per year before compression.

**Network bandwidth**: At 10,000 TPS with 2 kilobyte average request size, inbound traffic is about 20 megabytes per second.

**Database connections**: A single PostgreSQL instance handles roughly 500 to 1,000 concurrent connections. At 10,000 TPS with 50 millisecond query time, you need roughly 500 connections, which means horizontal sharding or connection pooling.

Checkpoint question:

> Are these assumptions acceptable, or do you want different scale targets?

## Section 3: Core API contracts

Cover endpoints, request body, response body, errors, idempotency, pagination, and rate limiting.

**What to show**: Pick the most important write endpoint and one read endpoint. Show the fields that matter for correctness.

**Example authorization request**:

```text
POST /payments/authorizations
Headers: Idempotency-Key, Authorization, Content-Type
Body: merchant_id, amount, currency, payment_token, order_reference
Response: payment_id, status, processor_response_code, created_at
Errors: 400 invalid request, 409 idempotency conflict, 429 rate limited
```

**Why field choices matter**: Including `order_reference` lets support trace a payment back to the merchant order. Including `processor_response_code` lets the merchant retry intelligently.

## Section 4: Data model and access patterns

Explain entities, queries, storage choice, partitioning, replication, consistency, and tenant boundaries.

### How to Choose Storage

<div class="decision-tree">
  <div class="decision-tree-title">Storage decision tree for payment systems</div>
  <div class="decision-row">
    <div class="decision-node question">Does the data require transactions and strict consistency?</div>
  </div>
  <div class="decision-row">
    <div class="decision-node yes">Yes → Relational DB (PostgreSQL, MySQL)</div>
    <div class="decision-arrow">|</div>
    <div class="decision-node no">No → Consider key-value or document store</div>
  </div>
  <div class="decision-row">
    <div class="decision-node question">Is the primary access pattern key lookup with very high throughput?</div>
  </div>
  <div class="decision-row">
    <div class="decision-node yes">Yes → Key-value store (Redis, DynamoDB)</div>
    <div class="decision-arrow">|</div>
    <div class="decision-node no">No → Relational or document store</div>
  </div>
  <div class="decision-row">
    <div class="decision-node question">Is the data append-only and used for analytics or audit?</div>
  </div>
  <div class="decision-row">
    <div class="decision-node yes">Yes → Append-only log, columnar warehouse</div>
    <div class="decision-arrow">|</div>
    <div class="decision-node no">No → Relational for structured queries</div>
  </div>
</div>

**Payment data is almost always relational** because correctness, transactions, foreign keys, and audit queries matter more than raw throughput.

**Idempotency records** can use a key-value store because the access pattern is simple key lookup with high throughput and short TTL.

**Event logs** belong in an append-only stream because they are write-heavy and consumed by multiple downstream systems.

## Section 5: High-level architecture

Use a diagram only when it helps. Focus on data flow, not boxes.

**What strong candidates show**: the request path from client to response, where state is stored, where async work happens, and where failures create ambiguity.

**What weak candidates do**: draw 15 boxes without explaining how data flows through them.

## Section 6: Key workflows

Pick 2 or 3 important flows. Walk through the happy path, then explicitly state what happens at each step if that step fails.

<div class="sequence-steps">
  <div class="sequence-steps-title">Authorization workflow with failure annotations</div>
  <div class="seq-step"><div class="seq-step-content"><strong>Validate request</strong><span>Check amount, currency, merchant, payment token. <span class="seq-step-fail">Fail → 400 error</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Authenticate merchant</strong><span>Verify API key and permissions. <span class="seq-step-fail">Fail → 401 error</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Check idempotency</strong><span>Lookup key. If found with same hash, return stored response. <span class="seq-step-fail">Conflict → 409 error</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Run fraud check</strong><span>Call fraud service for risk score. <span class="seq-step-fail">Timeout → deny or review based on risk policy</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Call processor</strong><span>Send authorization to payment network. <span class="seq-step-fail">Timeout → store PENDING, reconcile later</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Store result</strong><span>Write payment state and idempotency record atomically. <span class="seq-step-fail">DB fail → retry or fail-safe response</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Emit event</strong><span>Publish to event stream for audit, notifications, analytics. <span class="seq-step-fail">Stream fail → outbox retry</span></span></div></div>
</div>

## Section 7: Deep dive

Choose only 1 or 2 areas based on interviewer interest. Prepare depth on:

- **Idempotency**: how the key is stored, what happens on concurrent duplicates, TTL strategy.
- **Processor timeout**: pending state, reconciliation job, idempotent retry to processor.
- **Multi-region**: local reads, primary write region, failover with event replay safety.
- **Data partitioning**: shard key choice, hotspot mitigation, cross-shard queries.

## Section 8: Reliability, observability, security

Cover timeouts, retries, monitoring, authentication, authorization, encryption, abuse protection, and auditability.

**Observability checklist**: logs with payment id and merchant id, P99 latency metrics, approval rate dashboards, duplicate rate counters, processor error rate alerts, and distributed tracing across services.

**Security checklist**: mutual TLS between services, encryption at rest for payment data, API key rotation, least-privilege IAM roles, PCI DSS compliance boundaries, and never logging raw card numbers.

## Section 9: Tradeoffs and wrap

End with 5 bullets, 2 tradeoffs, and 2 risks with mitigations.

**Format that impresses**: "I chose X because Y. The downside is Z, and I would mitigate with W."

## Micro-answer bank

**Why this database?**  
I chose it because it matches our main queries and gives predictable performance. The downside is operational complexity, so I mitigate with monitoring, backups, and clear ownership.

**How do you handle duplicates or retries?**  
I use an idempotency key so the same request does not create multiple records.

**What happens if cache is down?**  
The system still works but is slower because we read from the database. We protect the database with limits and safe fallback behavior.

**Multi-region?**  
Reads can be local to each region. Writes are harder, so I choose single write region or conflict handling based on correctness needs.

## Beginner Deep Dive: What HLD Really Tests

High-level design is not about drawing the biggest architecture. It is about showing that you can turn a vague product idea into a system that works, scales, and fails safely.

Think of it like designing a busy airport. You do not start by buying planes. You first ask who is traveling, where they are going, how many people arrive at peak time, what happens when security is slow, and how lost bags are tracked. A payment system is similar: requests enter, checks happen, decisions are recorded, and failures need a safe path.

<div class="system-flow-demo">
  <div class="system-flow-title">HLD interview flow: start simple, then add scale only where needed</div>
  <div class="flow-lane">
    <div class="flow-node">Requirements</div>
    <div class="flow-node">API Contracts</div>
    <div class="flow-node">Data Model</div>
    <div class="flow-node">Services</div>
    <div class="flow-node">Failure Plan</div>
  </div>
  <div class="flow-packet"></div>
</div>

### What Each Section Means

**requirements** means what the system must do for users. For a payment gateway, this means accepting authorization requests, preventing duplicate charges, and returning a clear decision.

**decisions** means choosing one design path and explaining why. Example: "I choose a relational database for payment state because payments need correctness, transactions, and easy audit queries."

**risks** means what could go wrong. Example: the processor times out after charging the card, so your system does not know whether money moved.

**tradeoffs** means what you gain and what you give up. Example: a single write region is simpler and safer, but it can add latency for far-away merchants.

**security** means protecting money, merchant data, customer data, and internal systems. Always mention authentication, authorization, encryption, least privilege, and audit logs.

**compliance** means following rules about data retention, data residency, privacy, and financial auditability. In interviews, you do not need legal depth, but you should show that payment data cannot be treated like normal app data.

**operational items** means how engineers run the system after launch. Mention logs, metrics, traces, dashboards, alerts, safe rollout, and incident recovery.

### The Simple HLD Mental Model

Every design has four layers:

- Entry layer: API gateway, authentication, rate limiting, request validation.
- Business layer: payment service, fraud service, onboarding service, notification service.
- Data layer: database, cache, object storage, event stream.
- Operations layer: monitoring, audit, reconciliation, alerting, deployment.

If you get stuck, walk request by request:

1. Where does the request enter?
2. Who is allowed to make it?
3. What data is read?
4. What data is written?
5. What happens if this step fails?
6. How do we know later what happened?

### Interview Scoring: What Separates Levels

<div class="compare-grid">
  <div class="compare-card">
    <h4>Mid-Level Answer</h4>
    <ul>
      <li>Lists correct components</li>
      <li>Draws a reasonable diagram</li>
      <li>Mentions some failure cases</li>
      <li>Names a database without deep justification</li>
    </ul>
  </div>
  <div class="compare-card">
    <h4>Senior Answer</h4>
    <ul>
      <li>Explains why each component exists</li>
      <li>Walks through failure at each step</li>
      <li>Shows capacity math</li>
      <li>Discusses tradeoffs with alternatives</li>
    </ul>
  </div>
  <div class="compare-card">
    <h4>Staff Answer</h4>
    <ul>
      <li>Connects design to business outcomes</li>
      <li>Identifies the hardest correctness problem</li>
      <li>Proposes phased delivery</li>
      <li>Considers operational cost and team ownership</li>
    </ul>
  </div>
</div>

### Interview Answer You Can Say

I will keep the first design simple and correct. Then I will add caching, queues, partitioning, and multi-region behavior only where the scale or reliability requirement needs it. For payments, my safe default is to avoid duplicate money movement and preserve an audit trail, even if that means returning a slower or pending response.
