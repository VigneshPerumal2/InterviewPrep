# HLD Interview Framework

## NEXT THING TO SAY

I will start with a simple baseline design, then scale it only where the requirements force us to scale. I will call out **requirements**, **security**, **reliability**, **operational items**, and **tradeoffs** as I go.

## Step 0: 20-second framing

Say the goal in one line, then give 2 to 3 measurable targets in full words.

Example:

> The goal is to design a payment gateway that accepts merchant payment requests, prevents duplicate charges, and records every decision. Success means low response time for authorization, high availability during peak traffic, and complete auditability for support and compliance.

## Section 1: Requirements and scope

Cover:

- Functional **requirements**.
- Non-functional **requirements**.
- Out of scope.
- Safe defaults.

Checkpoint question:

> Does this scope match what you want, or should I change priorities?

## Section 2: Quick capacity and growth

Use simple math. Say peak requests per second in words, not shorthand.

Checkpoint question:

> Are these assumptions acceptable, or do you want different scale targets?

## Section 3: Core API contracts

Cover endpoints, request body, response body, errors, idempotency, pagination, and rate limiting.

## Section 4: Data model and access patterns

Explain entities, queries, storage choice, partitioning, replication, consistency, and tenant boundaries.

## Section 5: High-level architecture

Use an ASCII diagram only when it helps.

## Section 6: Key workflows

Pick 2 or 3 important flows.

## Section 7: Deep dive

Choose only 1 or 2 areas based on interviewer interest.

## Section 8: Reliability, observability, security

Cover timeouts, retries, monitoring, authentication, authorization, encryption, abuse protection, and auditability.

## Section 9: Tradeoffs and wrap

End with 5 bullets, 2 tradeoffs, and 2 risks with mitigations.

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

**decisions** means choosing one design path and explaining why. Example: “I choose a relational database for payment state because payments need correctness, transactions, and easy audit queries.”

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

### Interview Answer You Can Say

I will keep the first design simple and correct. Then I will add caching, queues, partitioning, and multi-region behavior only where the scale or reliability requirement needs it. For payments, my safe default is to avoid duplicate money movement and preserve an audit trail, even if that means returning a slower or pending response.
