# Scale a Monolith to 3x Traffic

## NEXT THING TO SAY

I will not split the monolith first. I will measure bottlenecks, add safe caching, optimize database access, and move slow work out of the request path.

```text
Users -> Load Balancer -> Monolith Instances -> Cache -> Database
                              |
                              +-> Async Queue
```

## Step 0: 20-second framing

Success means the system handles three times peak traffic with stable response time, no data loss, and clear rollback plans.

## Section 1: Requirements and scope

**requirements**:

- Handle three times current peak.
- Keep core user flows working.
- Avoid risky rewrites.
- Improve monitoring.

Safe default: if cache is unavailable, read from database with protective limits.

## Section 2: Quick capacity and growth

First identify whether bottleneck is application CPU, database, external APIs, or frontend assets.

## Section 3: Core API contracts

No API changes at first. Keep public contracts stable while improving internals.

## Section 4: Data model and access patterns

Add indexes for slow queries. Cache stable reference data. Avoid caching data that needs strict freshness.

## Section 5: High-level architecture

```text
Load Balancer
   |
Monolith Pool
   |---- Cache
   |---- Database
   |---- Queue for Slow Jobs
```

## Section 6: Key workflows

Request flow:

- Read cache.
- Fall back to database.
- Queue slow side effects.
- Return response.

## Section 7: Deep dive

Multi-region:

- Start with read replicas where safe.
- Keep writes in primary region until conflict rules are clear.

## Section 8: Reliability, observability, security

Add dashboards for slow endpoints, database time, cache hit rate, queue backlog, and error rate.

## Section 9: Tradeoffs and wrap

- **key decision**: optimize before extracting services.
- **tradeoff**: monolith remains coupled but risk is lower.
- **risk**: stale cache.
- **mitigation**: short expiration and invalidation.
