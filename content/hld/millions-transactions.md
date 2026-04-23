# Millions of Transactions System

## NEXT THING TO SAY

I will start with a payment event processing system that keeps the critical path small, then moves heavy work into asynchronous processing.

```text
API Fleet -> Event Stream -> Worker Pools -> Sharded Storage
              |              |
              |              +-> Analytics
              +-> Audit
```

## Step 0: 20-second framing

Success means predictable response time, high availability during peak traffic, and no duplicate transaction effects.

## Section 1: Requirements and scope

**requirements**:

- Accept transaction events.
- Validate and route events.
- Process at high peak traffic.
- Support replay and audit.
- Keep tenant and region boundaries.

Safe default: if downstream processing is degraded, queue safely instead of dropping data.

Checkpoint question: Does this scope match what you want, or should I change priorities?

## Section 2: Quick capacity and growth

Peak traffic can be many times average traffic. Large merchants can create hotspots.

I choose partitioning by merchant plus shard because merchant-only partitioning can overload one partition. Alternative: partition by transaction id for better spread when strict merchant ordering is not required.

## Section 3: Core API contracts

Use `POST /transactions/events` for ingestion and `GET /transactions/{id}` for lookup.

Use idempotency keys and event ids to handle retries and duplicates.

## Section 4: Data model and access patterns

Store transaction state in sharded storage. Store raw event history separately for replay.

**compliance**: attach tenant id, region, retention class, and audit metadata to each event.

## Section 5: High-level architecture

```text
Load Balancer
   |
Stateless APIs
   |
Event Stream
   |
Partitioned Workers
   |
Sharded Transaction Store
```

I choose stateless APIs because they scale horizontally. Alternative: sticky sessions are simpler for stateful workflows, but I would avoid them unless required.

## Section 6: Key workflows

Ingestion:

- Validate event.
- Deduplicate by event id.
- Write to stream.
- Return accepted response.

Worker processing:

- Read event.
- Apply business rule.
- Store state.
- Emit audit event.

## Section 7: Deep dive

Multi-region:

- Local reads for speed.
- Region-aware writes for data residency.
- Failover should not replay already processed events as new payments.

## Section 8: Reliability, observability, security

Use backpressure, retry with delay, dead-letter storage in plain words as failed-event storage, and dashboards for lag, error rate, and processing delay.

## Section 9: Tradeoffs and wrap

- **key decision**: stream-based processing for scale.
- **tradeoff**: asynchronous processing improves scale but adds eventual consistency.
- **risk**: hotspots from large tenants.
- **mitigation**: partition by tenant plus shard.
