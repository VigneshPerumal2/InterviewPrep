# Audit Event Writer

## NEXT THING TO SAY

I will design audit writing so we can answer who did what, when, to which resource, and why.

## 0) Two-Line Design Framing

- We need to write durable audit events.
- Correctness means important actions are recorded and cannot be silently lost.

## 1) Requirements and Constraints

- Store actor, action, resource, timestamp, and metadata.
- Validate required fields.
- Make events append-only.
- Support retention.

## 2) Objects and Responsibilities

`AuditEvent` is the data. `AuditWriter` validates and writes. `AuditRepository` persists.

## 3) Class/API Design

```text
AuditWriter.record(actor, action, resource_id, metadata)
AuditRepository.save(event)
```

## 4) Core Workflow

Validate fields, create event, save event, return event id.

## 5) Invariants

- **invariant**: audit events are append-only.
- **invariant**: actor, action, and resource are required.

## 6) Edge Cases

- **edge cases**: missing actor.
- **edge cases**: repository failure.
- **edge cases**: large metadata.

## 7) Python Implementation Sketch

```python
# Import uuid.
import uuid

# Import datetime.
from datetime import datetime

# Define the audit writer.
class AuditWriter:

    # Define the constructor.
    def __init__(self, repository):

        # Store the repository.
        self.repository = repository

    # Define the record method.
    def record(self, actor, action, resource_id, metadata):

        # Check required actor.
        if not actor:

            # Raise an error for missing actor.
            raise ValueError("actor is required")

        # Check required action.
        if not action:

            # Raise an error for missing action.
            raise ValueError("action is required")

        # Build the audit event.
        event = {
            "id": str(uuid.uuid4()),
            "actor": actor,
            "action": action,
            "resource_id": resource_id,
            "metadata": metadata,
            "created_at": datetime.utcnow().isoformat(),
        }

        # Save the event.
        self.repository.save(event)

        # Return the event id.
        return event["id"]
```

## 8) Tests

- Valid event is saved.
- Missing actor fails.
- Missing action fails.
- Repository failure is surfaced or queued for retry.

## 9) Follow-up Interview Questions

**Q: What if audit storage is down?**  
A: Use an outbox table or durable queue so the business action and audit intent are not separated.

## 10) Tradeoffs and Wrap

Synchronous audit is simpler but can slow the main path. Outbox-based audit is more reliable for production.

## Beginner Deep Dive: Audit Event Writer

<div class="class-demo">
  <div class="class-card"><strong>AuditEvent</strong>Immutable fact about who did what and when.</div>
  <div class="class-card"><strong>AuditWriter</strong>Validates and appends audit events.</div>
  <div class="class-card"><strong>AuditRepository</strong>Stores events durably.</div>
  <div class="class-card"><strong>Outbox</strong>Retries publishing without losing events.</div>
</div>

### What The Design Is Protecting

The main **invariant** is that audit events are append-only. Once written, they should not be edited in place.

This matters because audit history is used for compliance, investigations, and support.

### Step-by-step Explanation

`AuditEvent` stores actor, action, resource, timestamp, request id, and reason.

`AuditWriter` checks required fields and writes the event.

`AuditRepository` hides the storage system. It could write to a database, event stream, or immutable log.

The outbox stores events that need to be published. If publishing fails, a background worker retries.

### Failure and Safe Defaults

If audit writing fails for a sensitive operation, the operation should fail or store an outbox record in the same transaction.

If the event stream is down, keep local durable records and publish later.

If a user lacks permission, record the denied attempt too.

### Follow-up Interview Questions With Answers

**Q: Why append-only?**  
A: Changing old audit events weakens trust. Corrections should be new events, not edits.

**Q: How do you search audit history?**  
A: Store query fields like actor, resource, action, tenant, and time range in indexed storage.

**Q: What is the key tradeoff?**  
A: Strong auditability adds storage and operational cost, but it is essential for payment and compliance systems.
