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

## Beginner Deep Dive: Scaling a Monolith to 3x Traffic

<div class="system-flow-demo">
  <div class="system-flow-title">Scale the current system first, extract services only after bottlenecks are clear</div>
  <div class="flow-lane">
    <div class="flow-node">Measure Bottlenecks</div>
    <div class="flow-node">Add Cache</div>
    <div class="flow-node">Optimize Database</div>
    <div class="flow-node">Move Slow Work Async</div>
    <div class="flow-node">Extract Hot Service</div>
  </div>
  <div class="flow-packet"></div>
</div>

### Measure Bottlenecks

Do not guess. Look at slow endpoints, database queries, CPU, memory, error rates, and downstream calls.

I choose measurement first because scaling the wrong layer wastes time and can add risk.

### Add Cache

Caching helps when many requests read the same data. Examples: merchant configuration, feature flags, public catalog data, or policy settings.

I choose cache-aside because it is simple: read cache first, read database on miss, then store the result in cache.

### Optimize Database

Add missing indexes, remove expensive joins, and separate read-heavy queries from write-heavy tables.

The database is often the first bottleneck in a monolith because all features share it.

### Move Slow Work Async

Emails, reports, exports, audit enrichment, and non-critical notifications can move to a queue.

This keeps user-facing requests fast.

### Extract Hot Service

Only extract a service when the boundary is clear and the monolith cannot scale that part safely.

I choose gradual extraction because a rushed microservice migration can create more outages than it solves.

### Failure, Multi-region, and Safe Fallback

**risks**: cache stampede, stale data, overloaded database, and half-migrated ownership.

**decisions**: add cache expiration jitter, monitor cache hit rate, use queue retries, and define one team owner per extracted service.

For multi-region, keep the monolith simple first. Add read replicas or regional cache before attempting multi-region writes.

## Follow-up Interview Questions With Answers

**Q: Why not immediately split into microservices?**  
A: Microservices add network failures, deployment complexity, and data ownership problems. I split only when there is a clear bottleneck or ownership boundary.

**Q: How do you know cache worked?**  
A: Watch cache hit rate, database load, endpoint latency, and error rate before and after the rollout.

**Q: What is the biggest risk?**  
A: Serving stale or inconsistent data. I mitigate with correct expiration, invalidation for critical data, and safe defaults.
