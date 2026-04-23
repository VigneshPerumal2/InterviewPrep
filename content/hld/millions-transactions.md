# Millions of Transactions System

## NEXT THING TO SAY

I will start with a payment event processing system that keeps the critical path small and fast, then moves heavy work into asynchronous processing using partitioned event streams and worker pools.

```text
API Fleet -> Event Stream -> Worker Pools -> Sharded Storage
              |              |
              |              +-> Analytics
              +-> Audit
```

## Step 0: 20-second framing

Success means predictable response time under 200 milliseconds for ingestion, high availability during peak traffic, no duplicate transaction effects, and the ability to replay events for recovery.

## Section 1: Requirements and scope

**requirements**:

- Accept transaction events at high volume.
- Validate and route events based on type and merchant.
- Process at sustained peak traffic without data loss.
- Support event replay for recovery and audit.
- Keep tenant and region boundaries strict.
- Provide exactly-once processing semantics where possible, at-least-once with idempotent consumers as fallback.

Non-functional **requirements**:

- Ingestion P99 latency under 200 milliseconds.
- 99.99 percent availability for the ingestion path.
- Zero data loss: every accepted event must be durably stored.
- Consumer lag under 30 seconds during normal operation.
- Support 3 to 5 times average traffic during seasonal peaks.

Safe default: if downstream processing is degraded, queue safely instead of dropping data.

Checkpoint question: Does this scope match what you want, or should I change priorities?

## Section 2: Quick capacity and growth

<div class="capacity-callout">
  <div class="capacity-metric"><strong>100M</strong><span>Events/Day</span></div>
  <div class="capacity-metric"><strong>5,000</strong><span>Avg Events/Sec</span></div>
  <div class="capacity-metric"><strong>25,000</strong><span>Peak Events/Sec</span></div>
  <div class="capacity-metric"><strong>300 GB</strong><span>Daily Raw Data</span></div>
</div>

**Peak traffic math**: Average of 100 million events per day means roughly 1,150 events per second average. Payment traffic is bursty: Black Friday and payroll peaks can reach 5 times average, so the system must handle 5,000 to 25,000 events per second sustained for hours.

**Storage math**: Each event averages 3 kilobytes (transaction metadata, merchant context, fraud signals, timestamps). At 100 million events per day, raw data is about 300 gigabytes per day. With 7-day retention in hot storage and 90-day retention in warm storage, total hot storage is roughly 2 terabytes.

**Partition math**: 256 partitions spread across 16 brokers handles 25,000 events per second comfortably. Each partition handles about 100 events per second, well within single-partition throughput limits.

I choose partitioning by merchant plus shard because merchant-only partitioning can overload one partition when a large merchant spikes. Alternative: partition by transaction id for better spread when strict merchant ordering is not required.

Checkpoint question: Are these assumptions acceptable, or do you want different scale targets?

## Section 3: Core API contracts

```text
POST /transactions/events
  Headers: Idempotency-Key, Authorization
  Body:
    event_id         string    required (client-generated UUID)
    event_type       string    required (authorization, capture, refund, void)
    transaction_id   string    required
    merchant_id      string    required
    amount           integer   required (minor units)
    currency         string    required
    metadata         object    optional
    timestamp        string    required (ISO 8601, client event time)
  Response 202:
    accepted         boolean
    partition        integer   (which partition received the event)
  Errors:
    400  Invalid event (missing fields)
    409  Duplicate event_id
    429  Rate limited
```

```text
GET /transactions/{id}
  Response: transaction object with full event history
```

Use idempotency keys and event ids to handle retries and duplicates. The event_id is client-generated so the client controls deduplication.

## Section 4: Data model and access patterns

<div class="schema-card">
  <div class="schema-card-header">transaction_events (append-only event log)</div>
  <div class="schema-field"><span class="schema-field-name">event_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge pk">PK</span></div>
  <div class="schema-field"><span class="schema-field-name">transaction_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">merchant_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">event_type</span><span class="schema-field-type">VARCHAR</span></div>
  <div class="schema-field"><span class="schema-field-name">amount</span><span class="schema-field-type">BIGINT</span></div>
  <div class="schema-field"><span class="schema-field-name">currency</span><span class="schema-field-type">VARCHAR(3)</span></div>
  <div class="schema-field"><span class="schema-field-name">partition_key</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">merchant_id + shard_bucket</span></div>
  <div class="schema-field"><span class="schema-field-name">region</span><span class="schema-field-type">VARCHAR</span></div>
  <div class="schema-field"><span class="schema-field-name">metadata</span><span class="schema-field-type">JSONB</span></div>
  <div class="schema-field"><span class="schema-field-name">client_timestamp</span><span class="schema-field-type">TIMESTAMP</span></div>
  <div class="schema-field"><span class="schema-field-name">server_timestamp</span><span class="schema-field-type">TIMESTAMP</span><span class="schema-field-badge idx">IDX</span></div>
</div>

<div class="schema-card">
  <div class="schema-card-header">transaction_state (materialized current state)</div>
  <div class="schema-field"><span class="schema-field-name">transaction_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge pk">PK</span></div>
  <div class="schema-field"><span class="schema-field-name">merchant_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">current_status</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">authorized, captured, refunded, failed</span></div>
  <div class="schema-field"><span class="schema-field-name">amount</span><span class="schema-field-type">BIGINT</span></div>
  <div class="schema-field"><span class="schema-field-name">last_event_id</span><span class="schema-field-type">UUID</span></div>
  <div class="schema-field"><span class="schema-field-name">updated_at</span><span class="schema-field-type">TIMESTAMP</span></div>
</div>

**compliance**: attach tenant id, region, retention class, and audit metadata to each event.

**Two-table pattern**: The event log is append-only and immutable. The state table is a materialized view updated by consumers. If the state table is corrupted, rebuild it by replaying the event log.

## Section 5: High-level architecture

<div class="flow-multi">
  <div class="flow-multi-title">Event-driven transaction processing at scale</div>
  <div class="flow-multi-label">Ingestion layer (synchronous, latency-sensitive)</div>
  <div class="flow-multi-row">
    <div class="flow-node">Load Balancer</div>
    <div class="flow-node">Stateless API Fleet</div>
    <div class="flow-node">Input Validation</div>
    <div class="flow-node">Partitioned Event Stream</div>
  </div>
  <div class="flow-multi-label">Processing layer (asynchronous, throughput-optimized)</div>
  <div class="flow-multi-row">
    <div class="flow-node">Consumer Group A: State Update</div>
    <div class="flow-node">Consumer Group B: Analytics</div>
    <div class="flow-node">Consumer Group C: Audit</div>
    <div class="flow-node">Consumer Group D: Notifications</div>
  </div>
  <div class="flow-multi-label">Storage layer</div>
  <div class="flow-multi-row">
    <div class="flow-node-success">Sharded Transaction DB</div>
    <div class="flow-node-success">Analytics Warehouse</div>
    <div class="flow-node-success">Audit Log Store</div>
    <div class="flow-node-success">Dead Letter Queue</div>
  </div>
</div>

I choose stateless APIs because they scale horizontally. Alternative: sticky sessions are simpler for stateful workflows, but I would avoid them unless required.

**Why consumer groups**: Each downstream system (state updates, analytics, audit, notifications) reads the same event stream independently. If analytics is slow, it does not block state updates. Each consumer group tracks its own offset.

## Section 6: Key workflows

<div class="sequence-steps">
  <div class="sequence-steps-title">Event ingestion and processing pipeline</div>
  <div class="seq-step"><div class="seq-step-content"><strong>API receives event</strong><span>Parse request, validate schema, check authentication. Assign server_timestamp. <span class="seq-step-fail">Invalid → 400</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Deduplicate by event_id</strong><span>Check bloom filter or fast lookup for duplicate event_id. If seen, return 202 with original partition (idempotent acceptance). <span class="seq-step-fail">Duplicate → 202 (safe replay)</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Compute partition key</strong><span>Hash(merchant_id + shard_bucket) mod 256. The shard_bucket is derived from transaction_id to spread large merchants. <span class="seq-step-fail">Hash error → use default partition</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Write to event stream</strong><span>Produce to the computed partition with acks=all for durability. Return 202 Accepted once the stream confirms. <span class="seq-step-fail">Stream unavailable → retry with backoff, then 503</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>State consumer processes event</strong><span>Read event, apply business rules, update transaction state in sharded database. Use upsert with event_id check for idempotency. <span class="seq-step-fail">DB error → retry from stream offset</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Analytics consumer processes event</strong><span>Enrich event with merchant metadata, write to analytics warehouse. Tolerate higher latency (minutes behind). <span class="seq-step-fail">Warehouse error → retry, no data loss</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Audit consumer processes event</strong><span>Write immutable audit record with full event payload and processing metadata. <span class="seq-step-fail">Audit store error → buffer and retry</span></span></div></div>
</div>

### Backpressure and dead letter queue

**Backpressure**: When a consumer falls behind (lag exceeds threshold), the system should:

1. Alert on-call engineers when lag exceeds 5 minutes.
2. Auto-scale consumer instances if CPU/memory allows.
3. If lag exceeds 30 minutes, consider temporarily pausing lower-priority consumers (analytics) to prioritize critical consumers (state updates).

**Dead letter queue**: Events that fail processing after 5 retries move to a dead letter queue. Engineers can inspect, fix, and replay failed events through a dashboard. Dead letter events are never silently dropped.

## Section 7: Deep dive

### Event schema versioning

Events evolve over time. Use a schema registry with backward-compatible changes:

- Adding new optional fields is safe.
- Removing fields requires a deprecation period.
- Changing field types requires a new event version.
- Consumers must handle unknown fields gracefully.

### Multi-region

- Local reads for speed.
- Region-aware writes for data residency compliance.
- Failover should not replay already-processed events as new payments.
- Use event_id deduplication to prevent double-processing during failover.
- Cross-region replication for disaster recovery uses async replication with eventual consistency.

## Section 8: Reliability, observability, security

**Observability**: Monitor event lag per consumer group, partition skew (one partition getting disproportionate traffic), duplicate event rate, processing error rate, and end-to-end latency from event ingestion to state update.

**Key alerts**: consumer lag exceeds 5 minutes, partition skew exceeds 3x average, dead letter queue size growing, and database connection pool saturation.

## Section 9: Tradeoffs and wrap

- **key decision**: stream-based processing separates ingestion from processing.
- **key decision**: multiple consumer groups allow independent scaling of different workloads.
- **tradeoff**: asynchronous processing improves throughput but adds eventual consistency.
- **tradeoff**: 256 partitions allow high parallelism but make cross-partition queries harder.
- **risk**: hotspots from large tenants overloading a single partition.
- **mitigation**: composite partition key (merchant_id + shard_bucket) distributes load.
- **risk**: consumer group falls behind during traffic spikes.
- **mitigation**: auto-scaling consumers, backpressure monitoring, and priority-based consumer management.

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

I choose stateless APIs because traffic can spike during holidays, product launches, or merchant incidents. If one server dies, another server can continue without any session migration.

**Connection between boxes**: The API fleet does minimal work: validate, deduplicate, compute partition, produce to stream, return 202. No database writes happen on the ingestion path. This keeps the ingestion path fast and predictable.

### Partitioned Event Stream

An event stream stores facts such as "authorization requested," "authorization approved," and "fraud score calculated." Partitions let many consumers process events in parallel.

I choose an event stream for high-volume side effects because analytics, notifications, monitoring, and reconciliation do not all need to happen inside the checkout response.

**Partition key design**: A good partition key spreads load evenly while maintaining ordering guarantees where needed. For payments, ordering within a single transaction matters (authorize must come before capture), so partition by transaction_id or merchant_id + shard. Global ordering across all transactions is not required.

### Sharded Storage

Sharding means splitting data across multiple database partitions. A good shard key spreads load evenly.

For payments, a shard key like merchant id plus time bucket can help. A single huge merchant can still become hot, so the design may need merchant id plus an extra shard number derived from the transaction id.

**Cross-shard queries**: Queries that span multiple merchants (admin dashboards, global analytics) cannot use a single shard. These queries go to a read-only analytics store that aggregates data from all shards.

### Backpressure and Replay

Backpressure means slowing producers or consumers when the system is overloaded. Replay means reading old events again to rebuild derived data or recover from a bug.

I choose event replay because payment systems need recovery. If an analytics worker fails, we should not lose the transaction event. The event log retains events for at least 7 days, allowing full replay of any consumer.

**Replay safety**: Consumers must be idempotent. Processing the same event twice should not create duplicate side effects. This is enforced by checking event_id before applying state changes.

### Failure, Multi-region, and Safe Fallback

**risks**: hot merchants, delayed consumers, duplicate events, and partial regional outages.

**decisions**: make APIs stateless, partition by stable keys, make consumers idempotent, and keep raw event history long enough for replay.

**operational items**: watch event lag, approval rate, error rate, duplicate rate, and database partition health.

For multi-region, reads can be local. Writes are harder. I would start with regional routing plus a primary write path for each merchant region. If a region fails, traffic can fail over only after the idempotency and event replay plan is safe.

## Follow-up Interview Questions With Answers

**Q: What dominates latency?**  
A: On the ingestion path, network round-trip to the event stream dominates (2-5ms). On the processing path, database writes dominate (5-20ms). CPU work for validation is negligible.

**Q: How do you handle duplicates in streams?**  
A: Every event has a stable event_id generated by the client. Consumers store processed event_ids or use idempotent upserts (insert-on-conflict-update), so processing the same event twice does not create duplicate side effects.

**Q: What is the main scaling tradeoff?**  
A: Partitioning increases throughput, but it makes queries across all data harder. I solve that with a separate analytics store that aggregates data from all partitions, accepting eventual consistency for analytical queries.

**Q: How do you handle event ordering?**  
A: Events within the same partition are ordered. Since we partition by transaction context, events for the same transaction arrive in order. Cross-transaction ordering is not guaranteed, but it is also not required for correctness.

**Q: What if one consumer group is much slower than others?**  
A: Each consumer group tracks its own offset independently. A slow analytics consumer does not affect the state-update consumer. If analytics falls days behind, it can catch up without affecting the payment path.
