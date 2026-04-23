# Transaction Monitoring Pipeline

## NEXT THING TO SAY

I will design a monitoring pipeline that collects structured transaction events, enriches them, makes them searchable for debugging, powers real-time dashboards for operations, and feeds long-term analytics storage — all without impacting the payment processing path.

```text
Services -> Event Stream -> Stream Processor -> Search Store -> Dashboard
                                |
                                +-> Data Warehouse
```

## Step 0: 20-second framing

Success means engineers can quickly answer what happened, when it happened, and which merchant or transaction was affected. Dashboards update within 30 seconds of the event. Search returns results within 2 seconds. Alert evaluation happens within 60 seconds.

## Section 1: Requirements and scope

**requirements**:

- Collect structured transaction events from all payment services.
- Search events by transaction id, merchant id, status, error code, and time range.
- Build real-time operational dashboards (approval rate, latency, error rate).
- Retain audit records for compliance (7 years minimum).
- Alert on anomalies: error spikes, latency degradation, approval rate drops.
- Support ad-hoc analytics queries for business reporting.

Non-functional **requirements**:

- Event-to-dashboard latency under 30 seconds.
- Search query response under 2 seconds.
- Alert evaluation within 60 seconds of event.
- Handle 100 million events per day.
- Zero impact on payment processing latency.

Safe default: if analytics is delayed, do not block payment processing.

## Section 2: Quick capacity and growth

<div class="capacity-callout">
  <div class="capacity-metric"><strong>100M</strong><span>Events/Day</span></div>
  <div class="capacity-metric"><strong>30s</strong><span>Dashboard Lag</span></div>
  <div class="capacity-metric"><strong>2s</strong><span>Search Latency</span></div>
  <div class="capacity-metric"><strong>7 yrs</strong><span>Audit Retention</span></div>
</div>

Event volume grows with transaction volume. Hot merchants can produce a large share of events. During incidents, event volume may spike 10x as error events multiply.

**Storage math**: 100M events/day × 2KB average = 200 GB/day. Hot search index (30 days) = 6 TB. Warm storage (1 year) = 73 TB. Cold archive (7 years) = compressed to ~100 TB total.

## Section 3: Core API contracts

```text
Event schema:
  event_id         string    required (UUID)
  event_type       string    required (auth_requested, auth_approved, auth_declined,
                                       capture, refund, fraud_decision, error)
  transaction_id   string    required
  merchant_id      string    required
  timestamp        string    required (ISO 8601, event time)
  region           string    required
  status           string    required
  latency_ms       integer   optional
  error_code       string    optional
  processor_code   string    optional
  metadata         object    optional (additional context)

Search API:
  GET /events?transaction_id=X&merchant_id=Y&start=T1&end=T2&status=failed
  Response: paginated list of matching events with highlighting
```

## Section 4: Data model and access patterns

<div class="schema-card">
  <div class="schema-card-header">Search index schema (Elasticsearch/OpenSearch)</div>
  <div class="schema-field"><span class="schema-field-name">event_id</span><span class="schema-field-type">keyword</span><span class="schema-field-badge pk">PK</span></div>
  <div class="schema-field"><span class="schema-field-name">transaction_id</span><span class="schema-field-type">keyword</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">merchant_id</span><span class="schema-field-type">keyword</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">event_type</span><span class="schema-field-type">keyword</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">status</span><span class="schema-field-type">keyword</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">error_code</span><span class="schema-field-type">keyword</span></div>
  <div class="schema-field"><span class="schema-field-name">latency_ms</span><span class="schema-field-type">integer</span></div>
  <div class="schema-field"><span class="schema-field-name">region</span><span class="schema-field-type">keyword</span></div>
  <div class="schema-field"><span class="schema-field-name">timestamp</span><span class="schema-field-type">date</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">metadata</span><span class="schema-field-type">object</span><span class="schema-field-note">Dynamic mapping disabled for safety</span></div>
</div>

### Data retention tiers

| Tier | Storage | Retention | Access Pattern | Cost |
|---|---|---|---|---|
| Hot | Search index | 30 days | Sub-second queries, dashboards | Highest |
| Warm | Compressed search | 90 days | 2-5 second queries, investigations | Medium |
| Cold | Object storage (Parquet) | 7 years | Minutes, compliance queries | Lowest |

I choose search storage for debugging queries and warehouse storage for reporting. Alternative: one database is simpler but does not serve both real-time debugging and long-term analytics well.

## Section 5: High-level architecture

<div class="flow-multi">
  <div class="flow-multi-title">Transaction monitoring with event fan-out</div>
  <div class="flow-multi-label">Event sources</div>
  <div class="flow-multi-row">
    <div class="flow-node">Payment Service</div>
    <div class="flow-node">Fraud Service</div>
    <div class="flow-node">Processor Connector</div>
    <div class="flow-node">Rate Limiter</div>
  </div>
  <div class="flow-multi-label">Processing pipeline</div>
  <div class="flow-multi-row">
    <div class="flow-node">Event Stream (Kafka)</div>
    <div class="flow-node">Stream Processor</div>
    <div class="flow-node">Enrichment Service</div>
    <div class="flow-node">Fan-Out Router</div>
  </div>
  <div class="flow-multi-label">Serving stores</div>
  <div class="flow-multi-row">
    <div class="flow-node-success">Search Index</div>
    <div class="flow-node-success">Real-time Dashboards</div>
    <div class="flow-node-success">Alert Engine</div>
    <div class="flow-node-success">Data Warehouse</div>
  </div>
</div>

## Section 6: Key workflows

<div class="sequence-steps">
  <div class="sequence-steps-title">Event processing pipeline</div>
  <div class="seq-step"><div class="seq-step-content"><strong>Service emits structured event</strong><span>Each payment service publishes events with the standard schema. Event includes trace_id for cross-service correlation. <span class="seq-step-fail">Schema violation → dead letter queue with alert</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Stream stores event durably</strong><span>Event stream retains events for 7 days. Multiple consumer groups read independently. Partitioned by merchant_id for ordered per-merchant processing. <span class="seq-step-fail">Stream unavailable → producers buffer locally</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Stream processor enriches event</strong><span>Add merchant name, merchant category, processor name, region metadata. Compute derived fields: is_international, amount_bucket, hour_of_day. <span class="seq-step-fail">Enrichment failure → pass through without enrichment</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Fan-out to serving stores</strong><span>Write to search index for debugging. Update real-time counters for dashboards. Evaluate alert rules. Write to warehouse for analytics. Each destination is independent. <span class="seq-step-fail">One destination down → others continue</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Alert engine evaluates rules</strong><span>Check: approval rate drop > 5% in 5 minutes, error rate > 2% for any merchant, P99 latency > 1 second. Alert via PagerDuty, Slack, or email. <span class="seq-step-fail">Alert delivery failure → retry with escalation</span></span></div></div>
</div>

### Alert rule examples

| Alert | Condition | Severity | Action |
|---|---|---|---|
| Approval rate drop | Rate < 95% for 5 min, any merchant | Critical | Page on-call |
| Error spike | Error rate > 2% for 3 min | High | Slack alert |
| Latency degradation | P99 > 800ms for 5 min | High | Slack alert |
| Processor timeout spike | Timeout rate > 1% for 5 min | Critical | Page on-call |
| Dashboard lag | Consumer lag > 5 min | Medium | Slack alert |

## Section 7: Deep dive

### Event enrichment pipeline

Raw events from services contain IDs but not human-readable names. The enrichment step adds:

- Merchant name and category from merchant service cache.
- Processor name from configuration.
- Geographic region from IP geolocation cache.
- Derived fields: is_international (card country ≠ merchant country), amount_bucket (small/medium/large).

### Debugging workflow

When support reports "merchant X says payments are failing":

1. Search by merchant_id and time range in the search index.
2. Filter by status = "failed" or error_code is not null.
3. Click on a transaction_id to see all events in that transaction's lifecycle.
4. Use trace_id to see the request across API gateway, fraud, processor, and database.
5. Identify which step failed and what the error was.

## Section 8: Reliability, observability, security

Audit logs should show who changed dashboards and alert rules. Sensitive values (card numbers, customer PII) must be masked before indexing.

**Key metrics for the monitoring system itself**: consumer lag, index write latency, search query latency, alert evaluation time, data warehouse load freshness.

## Section 9: Tradeoffs and wrap

- **key decision**: event stream decouples producers from consumers.
- **key decision**: three-tier storage (hot/warm/cold) balances cost and access speed.
- **tradeoff**: dashboards may be slightly delayed (30 seconds) but payment processing is unaffected.
- **tradeoff**: enrichment adds processing latency but makes search results much more useful.
- **risk**: sensitive data leakage in search indexes.
- **mitigation**: field-level filtering, PII masking before indexing, and role-based access to search.
- **risk**: alert fatigue from too many noisy alerts.
- **mitigation**: threshold tuning, alert grouping, and severity-based routing.

## Beginner Deep Dive: Transaction Monitoring Pipeline

<div class="system-flow-demo">
  <div class="system-flow-title">Monitoring turns raw transaction events into searchable history and alerts</div>
  <div class="flow-lane">
    <div class="flow-node">Payment Events</div>
    <div class="flow-node">Event Stream</div>
    <div class="flow-node">Stream Processor</div>
    <div class="flow-node">Search + Warehouse</div>
    <div class="flow-node">Dashboards + Alerts</div>
  </div>
  <div class="flow-packet"></div>
</div>

### Payment Events

Each service emits structured events such as authorization requested, approved, declined, captured, refunded, or failed. Structured means each event has a consistent schema with typed fields.

I choose structured events because plain text logs are hard to query, aggregate, and alert on. Structured fields let support search by merchant, payment id, status, region, and time.

### Event Stream

The event stream buffers events and lets multiple consumers read them independently. Think of it like a newspaper: the payment service publishes once, and monitoring, analytics, fraud learning, and audit storage all read their own copy.

This is important because monitoring, analytics, fraud learning, and audit storage all need the same facts but should not slow payment processing.

### Stream Processor

The stream processor enriches events (adds merchant names, computes derived fields), aggregates counters (approval rate per minute), detects anomalies (error rate spike), and routes to serving stores.

I choose a processor because raw events are too low-level for dashboards. Dashboards need grouped, cleaned, and indexed data. A dashboard showing "error rate is 3.2% for merchant Acme in the last 5 minutes" requires aggregation, not raw events.

### Search and Warehouse

Search storage (Elasticsearch/OpenSearch) supports fast investigation: "show me all failed payments for merchant X in the last hour." Warehouse storage (BigQuery/Redshift/Snowflake) supports reporting: "what was the monthly approval rate by country for Q4?"

I choose both because support queries and business analytics have fundamentally different access patterns, data volumes, and latency requirements.

### Failure, Multi-region, and Safe Fallback

**risks**: delayed events, duplicate events in the search index, missing events during producer outage, and noisy alerts waking on-call engineers unnecessarily.

**decisions**: use event_ids for deduplication in consumers, monitor consumer lag per group, set alert thresholds that avoid waking people for harmless noise (e.g., require sustained error rate, not a single spike).

For multi-region, keep local event ingestion so regional outages do not stop all monitoring. Replicate summarized data carefully for global dashboards.

## Follow-up Interview Questions With Answers

**Q: What if events arrive late?**  
A: Store both event_time (when it happened) and processing_time (when we received it). Dashboards use event_time for accuracy. Late events update counters retroactively. Reports run against event_time with a "data completeness" indicator.

**Q: How do you debug one payment?**  
A: Search by transaction_id in the search index. All events for that transaction appear in chronological order. Use the trace_id to follow the request across API gateway, fraud service, processor connector, and audit service. This shows exactly where the request spent time and where it failed.

**Q: Why not query the payment database directly for dashboards?**  
A: Dashboards generate heavy read queries (aggregations, scans, joins). Running these against the payment database would steal CPU and I/O from the critical authorization path. A separate monitoring store protects the main transaction path while enabling powerful analytics.

**Q: How do you prevent alert fatigue?**  
A: Three strategies: (1) require sustained anomalies, not single-point spikes (error rate > 2% for 3 minutes, not 1 second). (2) Group related alerts (one alert for "merchant X failing" not 100 alerts for each failed transaction). (3) Route by severity — critical alerts page, warnings go to Slack, informational go to dashboards.

**Q: How do you handle schema evolution?**  
A: Use a schema registry. New fields are added as optional. Old consumers ignore unknown fields. Breaking changes require a new event version. The stream processor handles version migration by transforming old-format events to the current schema.
