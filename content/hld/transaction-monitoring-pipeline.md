# Transaction Monitoring Pipeline

## NEXT THING TO SAY

I will design a monitoring pipeline that collects transaction events, makes them searchable, and powers dashboards for debugging, audit, and operations.

```text
Services -> Event Stream -> Stream Processor -> Search Store -> Dashboard
                                |
                                +-> Data Warehouse
```

## Step 0: 20-second framing

Success means engineers can quickly answer what happened, when it happened, and which merchant or transaction was affected.

## Section 1: Requirements and scope

**requirements**:

- Collect structured transaction events.
- Search by transaction id and merchant id.
- Build dashboards.
- Retain audit records.
- Alert on error spikes.

Safe default: if analytics is delayed, do not block payment processing.

## Section 2: Quick capacity and growth

Event volume grows with transaction volume. Hot merchants can produce a large share of events.

## Section 3: Core API contracts

Events include transaction id, merchant id, event type, timestamp, region, status, and error code.

## Section 4: Data model and access patterns

I choose search storage for debugging queries and warehouse storage for reporting. Alternative: one database is simpler but does not serve both use cases well.

## Section 5: High-level architecture

```text
Payment Services
   |
Event Stream
   |
Stream Processor
   |---- Search Index
   |---- Warehouse
   |---- Alert Engine
```

## Section 6: Key workflows

Event flow:

- Service emits event.
- Stream stores event durably.
- Processor enriches event.
- Search and warehouse receive copies.

## Section 7: Deep dive

Failure modes:

- Processor outage: events stay in stream.
- Duplicate event: deduplicate by event id.
- Region outage: failover with replay.

## Section 8: Reliability, observability, security

Audit logs should show who changed dashboards and alert rules. Sensitive values should be masked.

## Section 9: Tradeoffs and wrap

- **key decision**: event stream decouples producers and consumers.
- **tradeoff**: dashboards may be slightly delayed.
- **risk**: sensitive data leakage.
- **mitigation**: field filtering and access controls.
