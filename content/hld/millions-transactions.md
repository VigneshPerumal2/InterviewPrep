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

## Beginner Deep Dive: Scaling Millions of Transactions

<div class="system-flow-demo">
  <div class="system-flow-title">At high scale, keep the request path thin and move side work to streams</div>
  <div class="flow-lane">
    <div class="flow-node">Stateless API Fleet</div>
    <div class="flow-node">Fast Validation</div>
    <div class="flow-node">Partitioned Event Stream</div>
    <div class="flow-node">Sharded Stores</div>
    <div class="flow-node">Monitoring + Replay</div>
  </div>
  <div class="flow-packet"></div>
</div>

### Stateless API Fleet

Stateless means any server can handle any request because the important state is in shared storage. This makes scaling easier because adding more servers increases capacity.

I choose stateless APIs because traffic can spike during holidays, product launches, or merchant incidents. If one server dies, another server can continue.

### Partitioned Event Stream

An event stream stores facts such as “authorization requested,” “authorization approved,” and “fraud score calculated.” Partitions let many consumers process events in parallel.

I choose an event stream for high-volume side effects because analytics, notifications, monitoring, and reconciliation do not all need to happen inside the checkout response.

### Sharded Storage

Sharding means splitting data across multiple database partitions. A good shard key spreads load evenly.

For payments, a shard key like merchant id plus time bucket can help. A single huge merchant can still become hot, so the design may need merchant id plus an extra shard number.

### Backpressure and Replay

Backpressure means slowing producers or consumers when the system is overloaded. Replay means reading old events again to rebuild derived data or recover from a bug.

I choose event replay because payment systems need recovery. If an analytics worker fails, we should not lose the transaction event.

### Failure, Multi-region, and Safe Fallback

**risks**: hot merchants, delayed consumers, duplicate events, and partial regional outages.

**decisions**: make APIs stateless, partition by stable keys, make consumers idempotent, and keep raw event history long enough for replay.

**operational items**: watch event lag, approval rate, error rate, duplicate rate, and database partition health.

For multi-region, reads can be local. Writes are harder. I would start with regional routing plus a primary write path for each merchant region. If a region fails, traffic can fail over only after the idempotency and event replay plan is safe.

## Follow-up Interview Questions With Answers

**Q: What dominates latency?**  
A: Network calls to fraud, processor, and database writes dominate latency. CPU work is usually not the bottleneck.

**Q: How do you handle duplicates in streams?**  
A: Every event has a stable id. Consumers store processed ids or use idempotent writes, so processing the same event twice does not create duplicate side effects.

**Q: What is the main scaling tradeoff?**  
A: Partitioning increases throughput, but it makes queries across all data harder. I solve that with analytics stores and carefully chosen access patterns.
