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
