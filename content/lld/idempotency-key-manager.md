# Idempotency Key Manager

## NEXT THING TO SAY

I will design the idempotency manager to guarantee that the same request with the same key always produces the same result, and the same key with a different request body is always rejected. This prevents duplicate charges.

## 0) Two-Line Design Framing

- We need to ensure that retried payment requests produce exactly the same result as the original.
- Correctness means one key maps to one request body and one response, and concurrent duplicates never create two charges.

## 1) Requirements and Constraints

- Keys are unique per merchant per request intent.
- Same key + same body = return stored response (replay).
- Same key + different body = reject with 409 (conflict).
- Support concurrent requests with the same key (race condition safe).
- Keys expire after a configurable TTL (default 24 hours).
- Support thousands of idempotency checks per second.

## 2) Objects and Responsibilities

| Object | Responsibility |
|---|---|
| `IdempotencyRecord` | Stores key, request hash, status, and response |
| `IdempotencyManager` | Coordinates check-and-execute flow |
| `RecordRepository` | Persists idempotency records |
| `RequestHasher` | Computes deterministic hash of request body |

## 3) Class/API Design

```text
IdempotencyManager.execute(key, merchant_id, request_body, action_fn) -> response
RecordRepository.find(key, merchant_id) -> IdempotencyRecord or None
RecordRepository.insert(record) -> bool  (false if already exists)
RecordRepository.update_response(key, merchant_id, response) -> None
RequestHasher.hash(body) -> string
```

## 4) Core Workflow

1. Compute hash of request body.
2. Try to insert a record with (key, merchant_id, request_hash, status=in_progress).
3. If insert succeeds → this is the first request. Execute the action, store the response, update status to completed.
4. If insert fails (key exists) → read the existing record.
5. If existing record has the same request_hash → return stored response (safe replay).
6. If existing record has a different request_hash → return 409 conflict.
7. If existing record has status=in_progress → the first request is still processing. Wait or return 202.

## 5) Invariants

- **invariant**: one (key, merchant_id) pair maps to exactly one request_hash.
- **invariant**: the stored response matches the result of the original execution.
- **invariant**: concurrent inserts for the same key result in exactly one winner.
- **invariant**: expired records are cleaned up and do not block new requests with the same key.

## 6) Edge Cases

- **edge case**: first request ever for a key → insert succeeds, action executes.
- **edge case**: exact retry (same key, same body) → return stored response.
- **edge case**: body mismatch (same key, different body) → reject 409.
- **edge case**: concurrent duplicate (two requests with same key arrive at the same time) → only one inserts successfully.
- **edge case**: first request crashes during execution → record stays in_progress. Second request sees in_progress status.
- **edge case**: in_progress record from a crashed request → timeout after configurable period, allow retry.
- **edge case**: key expires → cleanup job removes it. New request with same key starts fresh.

## 7) Python Implementation Sketch

```python
import hashlib
import json
import time
import threading
from dataclasses import dataclass, field


@dataclass
class IdempotencyRecord:
    """Stores the state of an idempotency key."""
    key: str
    merchant_id: str
    request_hash: str
    status: str = "in_progress"  # in_progress, completed, failed
    response: dict = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    expires_at: float = 0.0


class RequestHasher:
    """Compute a deterministic hash of the request body."""

    @staticmethod
    def hash(body):
        """SHA-256 of the JSON-serialized body.

        sort_keys=True ensures field order does not matter.
        """
        serialized = json.dumps(body, sort_keys=True)
        return hashlib.sha256(serialized.encode()).hexdigest()


class InMemoryRecordRepository:
    """Thread-safe in-memory storage for idempotency records."""

    def __init__(self):
        self._records = {}
        self._lock = threading.Lock()

    def find(self, key, merchant_id):
        """Find a record by key and merchant."""
        compound = f"{merchant_id}:{key}"
        return self._records.get(compound)

    def insert(self, record):
        """Atomic insert. Returns False if key already exists."""
        compound = f"{record.merchant_id}:{record.key}"
        with self._lock:
            if compound in self._records:
                return False
            self._records[compound] = record
            return True

    def update_response(self, key, merchant_id, response, status="completed"):
        """Update the stored response after action completes."""
        compound = f"{merchant_id}:{key}"
        with self._lock:
            record = self._records.get(compound)
            if record:
                record.response = response
                record.status = status

    def cleanup_expired(self, now=None):
        """Remove records past their expiration time."""
        now = now or time.time()
        with self._lock:
            expired = [
                k for k, v in self._records.items()
                if v.expires_at > 0 and v.expires_at < now
            ]
            for k in expired:
                del self._records[k]
            return len(expired)


class IdempotencyManager:
    """Coordinates idempotent execution of actions.

    Usage:
        manager = IdempotencyManager(repo)
        result = manager.execute(
            key="abc-123",
            merchant_id="merchant-1",
            request_body={"amount": 4000},
            action_fn=lambda: payment_service.authorize(request)
        )
    """

    def __init__(self, repository, ttl_seconds=86400,
                 in_progress_timeout=300):
        self.repository = repository
        self.ttl_seconds = ttl_seconds
        self.in_progress_timeout = in_progress_timeout

    def execute(self, key, merchant_id, request_body, action_fn):
        """Execute an action idempotently.

        Returns the action result on first execution.
        Returns the stored result on replay.
        Raises ConflictError if the same key has a different body.
        Raises InProgressError if the original is still processing.
        """
        request_hash = RequestHasher.hash(request_body)

        # Step 1: Try to claim the key.
        record = IdempotencyRecord(
            key=key,
            merchant_id=merchant_id,
            request_hash=request_hash,
            status="in_progress",
            expires_at=time.time() + self.ttl_seconds
        )

        if self.repository.insert(record):
            # First request. Execute the action.
            return self._execute_and_store(
                key, merchant_id, action_fn
            )

        # Step 2: Key exists. Check if it is a replay or conflict.
        existing = self.repository.find(key, merchant_id)
        if not existing:
            # Record was cleaned up between insert and find.
            # Treat as new request.
            return self._execute_and_store(
                key, merchant_id, action_fn
            )

        # Step 3: Check request hash match.
        if existing.request_hash != request_hash:
            raise ConflictError(
                f"Key '{key}' already used with different request body"
            )

        # Step 4: Same body. Check status.
        if existing.status == "completed":
            return existing.response

        if existing.status == "failed":
            # Original failed. Allow retry.
            return self._execute_and_store(
                key, merchant_id, action_fn
            )

        if existing.status == "in_progress":
            # Check if the original has timed out.
            age = time.time() - existing.created_at
            if age > self.in_progress_timeout:
                # Original likely crashed. Allow retry.
                return self._execute_and_store(
                    key, merchant_id, action_fn
                )
            raise InProgressError(
                f"Key '{key}' is being processed by another request"
            )

        return existing.response

    def _execute_and_store(self, key, merchant_id, action_fn):
        """Run the action and store its result."""
        try:
            result = action_fn()
            self.repository.update_response(
                key, merchant_id, result, "completed"
            )
            return result
        except Exception as e:
            self.repository.update_response(
                key, merchant_id,
                {"error": str(e)}, "failed"
            )
            raise


class ConflictError(Exception):
    """Raised when the same key is used with a different body."""
    pass


class InProgressError(Exception):
    """Raised when the original request is still processing."""
    pass
```

## 8) Tests

- **Happy path**: First request executes and returns result.
- **Replay**: Second request with same key and body returns stored result.
- **Conflict**: Same key with different body raises ConflictError.
- **Concurrent**: Two threads insert same key — only one succeeds, other gets replay.
- **In-progress**: Second request while first is processing raises InProgressError.
- **In-progress timeout**: Stale in_progress record allows retry after timeout.
- **Failed retry**: After first request fails, second request with same key retries.
- **Expiration**: Expired records are cleaned up. New request with same key starts fresh.
- **Hash stability**: Same body with different field order produces same hash.

## 9) Follow-up Interview Questions

**Q: How do you handle concurrent duplicates in a database?**  
A: Use a unique constraint on (merchant_id, idempotency_key). The first INSERT succeeds. The second INSERT gets a unique constraint violation. Catch the exception and treat it as a replay lookup.

**Q: What if the first request crashes?**  
A: The record stays in_progress. After in_progress_timeout (default 5 minutes), the next request with the same key is allowed to retry. The timeout prevents permanently stuck keys.

**Q: What about distributed databases?**  
A: The unique constraint works in distributed databases (PostgreSQL, DynamoDB conditional put). For Redis, use SET NX (set if not exists) with a TTL for atomic insert.

## 10) Tradeoffs and Wrap

The key tradeoff is storage cost versus correctness. Every request stores its key and response, which costs storage but prevents duplicate charges. For production, I would add: database persistence with unique constraints, TTL-based cleanup (CRON job deleting expired records), metrics on replay rate and conflict rate, and monitoring for stale in_progress records.

## Beginner Deep Dive: Idempotency Key Manager

<div class="class-demo">
  <div class="class-card"><strong>IdempotencyRecord</strong>Stores the key, request hash, processing status, and stored response for replay.</div>
  <div class="class-card"><strong>RequestHasher</strong>Computes a SHA-256 hash of the request body to detect when the same key is used with different data.</div>
  <div class="class-card"><strong>IdempotencyManager</strong>Coordinates the check-then-execute flow: insert → execute → store response, or find → compare → replay.</div>
</div>

### What The Design Is Protecting

The main **invariant** is that one key maps to one request body and one response. This prevents a mobile app retry from creating a second charge when the first charge already succeeded.

### Why Request Hashing

Without hashing, the system cannot detect when a merchant reuses a key for a different request. Hashing the body creates a fingerprint. If the fingerprint matches, it is a safe replay. If it does not match, it is a dangerous conflict.

**sort_keys=True** in the hash function is important. Without it, `{"a": 1, "b": 2}` and `{"b": 2, "a": 1}` would produce different hashes even though they represent the same request.

### Concurrent Request Race Condition

Two requests with the same key arrive at the same time:

1. Request A tries to insert → succeeds (first writer wins).
2. Request B tries to insert → fails (unique constraint violation).
3. Request B reads the existing record → finds A's record with status=in_progress.
4. Request B returns InProgressError or waits briefly and retries.
5. Request A completes, stores response.
6. Request B retries → finds completed record → returns stored response.

The database's unique constraint is the mechanism that guarantees only one request wins.

### In-Progress Timeout Explained

If Request A crashes after inserting the in_progress record, the key is permanently stuck. The in_progress_timeout prevents this: after 5 minutes, the next request assumes the original crashed and retries. This is safe because the action should be idempotent at the processor level too (using the same idempotency key with the processor).

### Failure and Safe Defaults

If the idempotency store is down, the safe default for payment systems is to reject the request. Allowing a request without idempotency protection risks duplicate charges, which is worse than a temporary service disruption.
