# Audit Event Writer

## NEXT THING TO SAY

I will design the audit writer so that every important action is recorded immutably. The writer must guarantee that the audit event is stored if the business action succeeds, using transactional writes or the outbox pattern.

## 0) Two-Line Design Framing

- We need to reliably write immutable audit events whenever a business action occurs.
- Correctness means every completed business action has exactly one corresponding audit event, and no audit event can be modified or deleted.

## 1) Requirements and Constraints

- Write audit events for payment actions (authorize, capture, refund, void).
- Events are immutable — append-only, no updates or deletes.
- Events must include actor (who), action (what), target (which entity), and timestamp (when).
- Support high throughput (10,000 events per second).
- Support retention for at least 7 years.
- Query by entity_id, actor, action, and time range.

## 2) Objects and Responsibilities

| Object | Responsibility |
|---|---|
| `AuditEvent` | Immutable value object with all audit fields |
| `AuditWriter` | Creates and stores audit events |
| `AuditRepository` | Persists events to storage |
| `OutboxWriter` | Writes event to outbox table in same transaction as business data |
| `OutboxPublisher` | Reads outbox and publishes to event stream |

## 3) Class/API Design

```text
AuditWriter.record(action, actor, entity_id, entity_type, metadata) -> AuditEvent
AuditRepository.append(event) -> None
AuditRepository.find_by_entity(entity_id, start, end) -> list[AuditEvent]
OutboxWriter.write_with_transaction(business_fn, audit_event) -> result
OutboxPublisher.publish_pending() -> int (count published)
```

## 4) Core Workflow

1. Business service performs an action (e.g., authorize payment).
2. Within the same database transaction, write the business record AND the audit event to the outbox table.
3. Transaction commits atomically — both succeed or both fail.
4. Background publisher reads pending outbox events and publishes to the event stream.
5. After successful publishing, mark outbox entry as published.

## 5) Invariants

- **invariant**: every completed business action has exactly one audit event.
- **invariant**: audit events are immutable — never modified, never deleted.
- **invariant**: audit events have monotonically increasing sequence within an entity.
- **invariant**: outbox entries are published at least once (at-least-once delivery).

## 6) Edge Cases

- **edge case**: business transaction commits but outbox publish fails → outbox retry handles this.
- **edge case**: event stream receives duplicate from outbox retry → consumers deduplicate by event_id.
- **edge case**: very high write volume → batch writes to outbox.
- **edge case**: retention policy requires deletion of old data → only allowed for expired events beyond retention period, with audit of the deletion itself.

## 7) Python Implementation Sketch

```python
import uuid
import time
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class AuditEvent:
    """Immutable audit event. frozen=True prevents modification."""
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    entity_id: str = ""
    entity_type: str = ""
    action: str = ""
    actor: str = ""
    metadata: dict = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)


class AuditRepository:
    """Append-only storage for audit events."""

    def __init__(self):
        self._events = []
        self._index_by_entity = {}

    def append(self, event):
        """Append event to storage. No update or delete methods exist."""
        self._events.append(event)
        if event.entity_id not in self._index_by_entity:
            self._index_by_entity[event.entity_id] = []
        self._index_by_entity[event.entity_id].append(event)

    def find_by_entity(self, entity_id, start_time=0, end_time=None):
        """Query events for an entity within a time range."""
        end_time = end_time or time.time()
        events = self._index_by_entity.get(entity_id, [])
        return [
            e for e in events
            if start_time <= e.timestamp <= end_time
        ]

    def count(self):
        """Return total event count."""
        return len(self._events)


class AuditWriter:
    """Creates and stores audit events."""

    def __init__(self, repository):
        self.repository = repository

    def record(self, action, actor, entity_id, entity_type, metadata=None):
        """Record an audit event for a business action."""
        event = AuditEvent(
            entity_id=entity_id,
            entity_type=entity_type,
            action=action,
            actor=actor,
            metadata=metadata or {}
        )
        self.repository.append(event)
        return event
```

### Outbox pattern implementation

```python
class OutboxWriter:
    """Writes audit events in the same transaction as business data."""

    def __init__(self, db_connection):
        self.db = db_connection

    def write_with_transaction(self, business_fn, audit_event):
        """Execute business function and write audit event atomically.

        Both the business write and the audit event write happen
        in the same database transaction. If either fails, both
        are rolled back.
        """
        tx = self.db.begin_transaction()
        try:
            result = business_fn(tx)
            tx.execute(
                "INSERT INTO outbox (event_id, payload, status) "
                "VALUES (?, ?, 'pending')",
                (audit_event.event_id, serialize(audit_event))
            )
            tx.commit()
            return result
        except Exception:
            tx.rollback()
            raise


class OutboxPublisher:
    """Reads pending outbox entries and publishes to event stream."""

    def __init__(self, db_connection, event_stream):
        self.db = db_connection
        self.stream = event_stream

    def publish_pending(self, batch_size=100):
        """Publish pending outbox entries. Returns count published."""
        rows = self.db.query(
            "SELECT event_id, payload FROM outbox "
            "WHERE status = 'pending' "
            "ORDER BY created_at LIMIT ?",
            (batch_size,)
        )
        published = 0
        for row in rows:
            try:
                self.stream.publish(row.payload)
                self.db.execute(
                    "UPDATE outbox SET status = 'published' "
                    "WHERE event_id = ?",
                    (row.event_id,)
                )
                published += 1
            except Exception:
                # Leave as pending for next retry cycle.
                break
        return published
```

### Batch writing for high throughput

```python
class BatchAuditWriter:
    """Buffers audit events and writes in batches for throughput."""

    def __init__(self, repository, batch_size=100, flush_interval=1.0):
        self.repository = repository
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.buffer = []
        self.last_flush = time.time()

    def record(self, action, actor, entity_id, entity_type, metadata=None):
        """Buffer an audit event. Flushes when batch is full or interval elapsed."""
        event = AuditEvent(
            entity_id=entity_id,
            entity_type=entity_type,
            action=action,
            actor=actor,
            metadata=metadata or {}
        )
        self.buffer.append(event)

        if (len(self.buffer) >= self.batch_size or
                time.time() - self.last_flush >= self.flush_interval):
            self.flush()

        return event

    def flush(self):
        """Write all buffered events to storage."""
        if not self.buffer:
            return
        for event in self.buffer:
            self.repository.append(event)
        self.buffer.clear()
        self.last_flush = time.time()
```

## 8) Tests

- **Happy path**: Record an event, query by entity_id, get it back.
- **Immutability**: Verify AuditEvent fields cannot be changed after creation.
- **Outbox atomicity**: Business failure rolls back both business data and audit event.
- **Outbox retry**: Unpublished events are retried on next cycle.
- **Batch flush**: Events are written when batch is full or interval expires.
- **Query accuracy**: find_by_entity returns only events within the requested time range.
- **No deletion**: Verify no delete method exists on AuditRepository.

## 9) Follow-up Interview Questions

**Q: Why outbox instead of direct event publishing?**  
A: Direct publishing can fail independently from the business transaction. If the business write succeeds but the event publish fails, we lose the audit record. The outbox pattern guarantees atomicity because both writes are in the same database transaction.

**Q: What about retention?**  
A: Events older than the retention period can be archived to cold storage (S3 Parquet files). The archival itself is recorded as an audit event. Hot storage retains the most recent 90 days for fast queries.

**Q: How do you handle schema evolution?**  
A: The metadata field is a flexible JSON object. New fields are added to metadata without changing the core schema. Old events remain queryable because the core fields (action, actor, entity_id) are stable.

## 10) Tradeoffs and Wrap

The outbox pattern guarantees that every business action has an audit record, but it adds complexity (outbox table, publisher background job, deduplication in consumers). The tradeoff is worth it because losing audit events in a payment system is unacceptable for compliance and debugging.

## Beginner Deep Dive: Audit Event Writer

<div class="class-demo">
  <div class="class-card"><strong>AuditEvent</strong>Immutable record: who did what, to which entity, when. Uses frozen=True to prevent modification.</div>
  <div class="class-card"><strong>AuditWriter</strong>Creates events and stores them. The public API is just record() — simple and hard to misuse.</div>
  <div class="class-card"><strong>OutboxWriter</strong>Writes the audit event in the same database transaction as the business data. Guarantees both succeed or both fail.</div>
</div>

### What The Design Is Protecting

The main **invariant** is that every business action produces exactly one immutable audit record. This is critical for financial compliance, support debugging, and security investigation.

### Why Outbox Pattern

Imagine a payment is authorized successfully, but the audit event fails to publish to the event stream. Now there is a payment with no audit trail. The outbox pattern prevents this by writing both the payment record and the audit event in the same database transaction.

### Why Immutability

Audit events should never change. If someone could modify an audit event, the entire audit trail becomes untrustworthy. Using `frozen=True` in Python's dataclass makes modification attempts raise an error at runtime.

### Failure and Safe Defaults

If the event stream is down, outbox entries accumulate in the database and are published when the stream recovers. If the outbox publisher crashes, pending entries remain and are retried on restart. The key insight is that the business action and audit record are bound together at the database level, not the event stream level.
