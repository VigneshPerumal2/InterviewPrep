# Idempotency Key Manager

## NEXT THING TO SAY

I will design an idempotency manager that lets a client safely retry the same request without creating a duplicate payment.

## 0) Two-Line Design Framing

- We need to store a request key and the result for that request.
- Correctness means the same key and same request always returns the same result.

## 1) Requirements and Constraints

- Store idempotency key.
- Store request hash.
- Store response.
- Reject same key with different request body.
- Handle concurrent duplicate requests.

## 2) Objects and Responsibilities

| Object | Responsibility |
|---|---|
| `IdempotencyManager` | Main orchestration. |
| `IdempotencyRepository` | Stores records. |
| `IdempotencyRecord` | Key, hash, status, response. |

## 3) Class/API Design

```text
IdempotencyManager.execute(key, request_hash, action)
Repository.find(key)
Repository.save(record)
```

## 4) Core Workflow

Check key. If missing, run action and store response. If present with same hash, return saved response. If present with different hash, reject.

## 5) Invariants

- **invariant**: one key maps to one request hash.
- **invariant**: completed duplicate requests return the original response.

## 6) Edge Cases

- **edge cases**: same key, different body.
- **edge cases**: action fails.
- **edge cases**: concurrent same-key requests.

## 7) Python Implementation Sketch

```python
# Define the idempotency record class.
class IdempotencyRecord:

    # Define the constructor.
    def __init__(self, key, request_hash, response):

        # Store the key.
        self.key = key

        # Store the request hash.
        self.request_hash = request_hash

        # Store the response.
        self.response = response

# Define the in-memory repository.
class IdempotencyRepository:

    # Define the constructor.
    def __init__(self):

        # Store records by key.
        self.records = {}

    # Define the find method.
    def find(self, key):

        # Return the stored record.
        return self.records.get(key)

    # Define the save method.
    def save(self, record):

        # Store the record by key.
        self.records[record.key] = record

# Define the manager class.
class IdempotencyManager:

    # Define the constructor.
    def __init__(self, repository):

        # Store the repository.
        self.repository = repository

    # Define the execute method.
    def execute(self, key, request_hash, action):

        # Look up the existing record.
        existing = self.repository.find(key)

        # Check if a record already exists.
        if existing:

            # Reject if the request body changed.
            if existing.request_hash != request_hash:

                # Raise an error for unsafe reuse.
                raise ValueError("same key used with different request")

            # Return the stored response.
            return existing.response

        # Run the action for the first request.
        response = action()

        # Create the idempotency record.
        record = IdempotencyRecord(key, request_hash, response)

        # Save the record.
        self.repository.save(record)

        # Return the response.
        return response
```

## 8) Tests

- Same request returns same response.
- Same key with different hash fails.
- First request stores result.
- Concurrent requests need atomic save in real storage.

## 9) Follow-up Interview Questions

**Q: How do you handle concurrency?**  
A: Use a database unique constraint or distributed lock so only one request creates the record.

**Q: How long do keys live?**  
A: Use expiration based on business needs, such as 24 hours or longer for payments.

## 10) Tradeoffs and Wrap

In-memory storage is simple but not durable. A database or key-value store is better for production.

## Beginner Deep Dive: Why These Classes Exist

<div class="class-demo">
  <div class="class-card"><strong>IdempotencyRecord</strong>Remembers the key, request hash, status, and response.</div>
  <div class="class-card"><strong>Repository</strong>Finds and saves records without exposing the database.</div>
  <div class="class-card"><strong>Manager</strong>Decides whether to run the action or return a stored response.</div>
  <div class="class-card"><strong>Request Hash</strong>Proves the same key is being used for the same request body.</div>
</div>

### What The Design Is Protecting

The main **invariant** is simple: one idempotency key can only represent one request body. If the client reuses the same key with a different body, the system must reject it.

This matters in payments because a retry can happen after a network timeout. Without idempotency, a retry might charge the customer twice.

### Object-by-object Explanation

`IdempotencyRecord` is the memory of one request. In production it would also store status values such as in_progress, completed, and failed.

`IdempotencyRepository` is the storage boundary. Today it can be a dictionary. In production it should be a durable store with a unique constraint on the key.

`IdempotencyManager` is the workflow owner. It checks existing records, validates the request hash, runs the action once, and stores the response.

The request hash is important because clients can make mistakes. If they send the same key for a different payment amount, returning the old response would be dangerous.

### Concurrency Explanation

Two identical requests can arrive at almost the same time. If both see “no record,” both might run the action.

The production fix is an atomic insert or unique database constraint. Only one request wins the right to create the record. The other request waits or reads the stored result.

### Follow-up Interview Questions With Answers

**Q: Should failed responses be stored?**  
A: It depends. Validation errors can be stored because the same request will fail again. Temporary system errors may not be stored, so the client can retry.

**Q: How long should records live?**  
A: Long enough to cover client retries and reconciliation needs. For payments, this is usually longer than a normal web request cache.

**Q: What is the biggest risk?**  
A: Concurrent first requests. A unique constraint or atomic write protects the invariant.
