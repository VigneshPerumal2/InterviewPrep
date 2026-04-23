# Scale a Monolith to 3x Traffic

## NEXT THING TO SAY

I will not split the monolith first. I will measure bottlenecks with profiling, add safe caching, optimize database access patterns, and move slow work out of the request path. Only after these optimizations are exhausted will I consider extracting services.

```text
Users -> Load Balancer -> Monolith Instances -> Cache -> Database
                              |
                              +-> Async Queue
```

## Step 0: 20-second framing

Success means the system handles three times peak traffic with stable P99 response time, no data loss, no new service boundaries until bottlenecks are proven, and clear rollback plans for every change.

## Section 1: Requirements and scope

**requirements**:

- Handle three times current peak traffic within 6 weeks.
- Keep core user flows working with current SLAs.
- Avoid risky architectural rewrites.
- Improve monitoring to identify future bottlenecks.
- Maintain zero downtime during the scaling changes.

Safe default: if cache is unavailable, read from database with connection pooling and protective query timeouts.

## Section 2: Quick capacity and growth

<div class="capacity-callout">
  <div class="capacity-metric"><strong>3x</strong><span>Traffic Target</span></div>
  <div class="capacity-metric"><strong>6 weeks</strong><span>Timeline</span></div>
  <div class="capacity-metric"><strong>&lt;500ms</strong><span>P99 Target</span></div>
  <div class="capacity-metric"><strong>0</strong><span>Downtime Budget</span></div>
</div>

First identify whether the bottleneck is application CPU, database queries, external API calls, or frontend asset serving. Do not guess — measure.

**Typical monolith bottleneck distribution**: Database queries cause 60 percent of latency. External API calls cause 25 percent. Application CPU causes 10 percent. Memory/GC causes 5 percent.

## Section 3: Core API contracts

No API changes at first. Keep public contracts stable while improving internals. API backward compatibility is critical because merchants have already integrated.

## Section 4: Data model and access patterns

### Database optimization checklist

<div class="sequence-steps">
  <div class="sequence-steps-title">Database optimization steps in priority order</div>
  <div class="seq-step"><div class="seq-step-content"><strong>Add missing indexes</strong><span>Find slow queries from query logs (queries over 100ms). Add composite indexes for the most common WHERE clauses. Typical wins: 10x to 100x improvement per query.</span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Eliminate N+1 queries</strong><span>Find code paths that query the database in a loop. Replace with batch queries or JOINs. Typical wins: reduce 100 queries to 1.</span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Add read replicas</strong><span>Route read-only queries (reports, dashboards, search) to read replicas. Keep writes on the primary. Reduces primary database load by 40-60 percent.</span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Optimize connection pooling</strong><span>Use PgBouncer or application-level pooling. Limit max connections per service instance. Prevent connection exhaustion during traffic spikes.</span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Archive old data</strong><span>Move completed transactions older than 90 days to archive tables. Reduce active table size for faster index scans.</span></div></div>
</div>

Cache stable reference data. Avoid caching data that needs strict freshness for correctness.

## Section 5: High-level architecture

<div class="flow-multi">
  <div class="flow-multi-title">Scaling strategy: optimize within the monolith before extracting services</div>
  <div class="flow-multi-label">Phase 1: Quick wins (week 1-2)</div>
  <div class="flow-multi-row">
    <div class="flow-node-success">Add Indexes</div>
    <div class="flow-node-success">Fix N+1 Queries</div>
    <div class="flow-node-success">Connection Pooling</div>
    <div class="flow-node-success">Add Monitoring</div>
  </div>
  <div class="flow-multi-label">Phase 2: Caching and async (week 3-4)</div>
  <div class="flow-multi-row">
    <div class="flow-node">Cache Reference Data</div>
    <div class="flow-node">Read Replicas</div>
    <div class="flow-node">Queue Slow Jobs</div>
    <div class="flow-node">CDN for Assets</div>
  </div>
  <div class="flow-multi-label">Phase 3: Targeted extraction (week 5-6, only if needed)</div>
  <div class="flow-multi-row">
    <div class="flow-node-warn">Extract Hottest Service</div>
    <div class="flow-node-warn">Strangler Fig Pattern</div>
    <div class="flow-node-warn">Database Split</div>
    <div class="flow-node-warn">Load Test Validation</div>
  </div>
</div>

## Section 6: Key workflows

<div class="sequence-steps">
  <div class="sequence-steps-title">Scaling investigation workflow</div>
  <div class="seq-step"><div class="seq-step-content"><strong>Instrument and measure</strong><span>Add APM (Application Performance Monitoring). Identify top 10 slowest endpoints. Find which layer dominates: database, external API, CPU, or memory. Create baseline metrics.</span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Fix low-hanging fruit</strong><span>Add missing database indexes. Fix N+1 queries. Remove unnecessary data loading. These changes often deliver 2-5x improvement with minimal risk.</span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Add caching for hot data</strong><span>Cache-aside pattern: check cache → read DB on miss → store in cache. Cache merchant config (changes rarely), feature flags (changes hourly), catalog data (changes daily). Set TTL based on freshness needs.</span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Move slow work to background</strong><span>Email sending, report generation, audit enrichment, analytics aggregation. Use a job queue with workers. User-facing response returns immediately.</span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Scale horizontally</strong><span>Add more monolith instances behind the load balancer. This works because the monolith is stateless (session state in Redis, not in memory). Verify even load distribution.</span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Extract only if necessary</strong><span>If one module is the clear bottleneck AND has a clean data boundary, extract it as a service. Use the strangler fig pattern: new requests go to the service, old requests still work in the monolith during migration.</span></div></div>
</div>

### Cache stampede prevention

When a popular cache key expires, many concurrent requests may hit the database simultaneously. Prevention strategies:

- **Jittered TTL**: Add random seconds to TTL so keys don't expire simultaneously (TTL = 300 + random(0, 60)).
- **Singleflight / request coalescing**: Only one request loads from DB; other requests wait for the result.
- **Early refresh**: Refresh cache entries before they expire (at 80 percent of TTL).

### Strangler fig pattern for service extraction

Instead of a risky big-bang rewrite:

1. Create the new service alongside the monolith.
2. Route a small percentage of traffic (5 percent) to the new service.
3. Compare results between monolith and new service.
4. Gradually increase traffic to the new service.
5. When 100 percent of traffic uses the new service, remove the code from the monolith.

## Section 7: Deep dive

### Before/after metrics table

| Metric | Before | After Phase 1 | After Phase 2 | Target |
|---|---|---|---|---|
| P99 latency | 1200ms | 400ms | 250ms | <500ms |
| DB queries/request | 45 | 8 | 5 | <10 |
| Cache hit rate | 0% | 0% | 85% | >80% |
| Max TPS | 1,000 | 2,500 | 4,000 | 3,000 |
| DB CPU | 90% | 45% | 25% | <50% |

### Multi-region

- Start with read replicas where safe.
- Keep writes in primary region until conflict rules are clear.
- Add regional caching to reduce cross-region latency for reads.

## Section 8: Reliability, observability, security

**Observability stack**: APM traces for every request, slow query logs, cache hit rate dashboard, queue backlog monitoring, error rate alerts per endpoint.

Add dashboards for slow endpoints, database query time distribution, cache hit rate, queue backlog, and error rate trending.

## Section 9: Tradeoffs and wrap

- **key decision**: optimize before extracting services. Lower risk, faster results.
- **key decision**: cache-aside pattern for read-heavy data.
- **tradeoff**: monolith remains coupled but risk of the scaling project is much lower.
- **tradeoff**: caching adds consistency complexity (stale data risk).
- **risk**: stale cache serving incorrect data for critical operations.
- **mitigation**: short TTL for mutable data, cache invalidation for critical updates, and never caching payment state.
- **risk**: service extraction creates distributed system problems (network failures, data ownership).
- **mitigation**: extract only with clear data boundaries, use strangler fig pattern, and validate with load testing.

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

I choose measurement first because scaling the wrong layer wastes time and can add risk. Common mistake: "let's add more servers" when the problem is one bad database query that takes 5 seconds.

**How to measure**: Use APM tools (Datadog, New Relic, or open-source alternatives like Jaeger). Look at flame graphs to find where time is spent. Sort endpoints by total time contribution (latency × request count).

### Add Cache

Caching helps when many requests read the same data. Examples: merchant configuration (changes rarely), feature flags (changes hourly), catalog data (changes daily), rate limit policies (changes weekly).

I choose cache-aside because it is simple: read cache first, read database on miss, then store the result in cache with a TTL.

**What NOT to cache**: Payment state (must be fresh), idempotency records (correctness critical), anything that changes on every request.

### Optimize Database

Add missing indexes, fix N+1 query patterns, separate read-heavy queries from write-heavy tables using read replicas, and tune connection pooling.

The database is often the first bottleneck in a monolith because all features share it. A single missing index on a query that runs 1,000 times per second can consume 80 percent of database CPU.

### Move Slow Work Async

Emails, reports, exports, audit enrichment, and non-critical notifications can move to a queue. The user-facing request returns immediately, and a background worker processes the slow task.

This keeps user-facing requests fast and predictable.

### Extract Hot Service

Only extract a service when the boundary is clear and the monolith cannot scale that part safely. Good extraction candidates: notification service (clear boundary, different scaling needs), report generation (CPU-heavy, independent data), image processing (memory-heavy, independent).

I choose gradual extraction because a rushed microservice migration can create more outages than it solves. Every new service boundary adds network failure modes, deployment complexity, and data ownership questions.

### Failure, Multi-region, and Safe Fallback

**risks**: cache stampede when popular keys expire simultaneously, stale data causing incorrect business decisions, overloaded database during cache failure, and half-migrated ownership during service extraction.

**decisions**: add cache TTL jitter, monitor cache hit rate, use queue retries with dead letter storage, and define one team owner per extracted service.

For multi-region, keep the monolith simple first. Add read replicas and regional cache before attempting multi-region writes.

## Follow-up Interview Questions With Answers

**Q: Why not immediately split into microservices?**  
A: Microservices add network failures, deployment complexity, and data ownership problems. A premature split often creates more incidents than it solves. I split only when there is a clear bottleneck that cannot be solved within the monolith, or when team boundaries require independent deployment.

**Q: How do you know caching worked?**  
A: Watch cache hit rate (target above 80 percent for cached endpoints), database load (should decrease proportionally), endpoint latency (should improve for cached paths), and error rate (should not increase). Compare before/after for each metric.

**Q: What is the biggest risk?**  
A: Serving stale or inconsistent data from cache. I mitigate with correct TTL selection (shorter for mutable data), explicit invalidation for critical data changes, and never caching data where staleness causes financial errors.

**Q: How do you handle the database becoming a bottleneck again at 5x traffic?**  
A: First: vertical scaling (larger database instance). Then: read replicas for read-heavy queries. Then: connection pooling optimization. Finally: if writes are the bottleneck, consider database sharding or extracting the highest-write domain into its own database.

**Q: What metrics do you show leadership to prove scaling is on track?**  
A: P99 latency trend, maximum sustained TPS in load tests, database CPU headroom, and cache hit rate. These four metrics tell the complete story: are we fast enough, can we handle the load, do we have headroom, and are our optimizations working.
