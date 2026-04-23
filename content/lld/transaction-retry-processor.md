# Transaction Retry Processor

## NEXT THING TO SAY

I will design retries with a clear policy so temporary failures are retried, permanent failures stop, and work does not retry forever.

## 0) Two-Line Design Framing

- We need to retry failed transaction jobs safely.
- Correctness means no infinite retry loop and no duplicate side effects.

## 1) Requirements and Constraints

- Retry temporary errors.
- Stop permanent errors.
- Use increasing delay.
- Track attempt count.
- Move exhausted jobs to failed storage.

## 2) Objects and Responsibilities

`RetryProcessor` runs jobs. `RetryPolicy` decides if retry is allowed. `JobRepository` stores attempts.

## 3) Class/API Design

```text
RetryProcessor.process(job)
RetryPolicy.should_retry(job, error)
RetryPolicy.next_delay(job)
```

## 4) Core Workflow

Run job. If success, mark complete. If temporary failure, schedule retry. If permanent or exhausted, mark failed.

## 5) Invariants

- **invariant**: attempt count only increases.
- **invariant**: completed jobs do not retry.

## 6) Edge Cases

- **edge cases**: permanent error.
- **edge cases**: retry limit reached.
- **edge cases**: duplicate job delivery.

## 7) Python Implementation Sketch

```python
# Define the retry policy.
class RetryPolicy:

    # Define the constructor.
    def __init__(self, max_attempts):

        # Store the maximum attempts.
        self.max_attempts = max_attempts

    # Define whether a retry is allowed.
    def should_retry(self, attempt, error_type):

        # Return false for permanent errors.
        if error_type == "permanent":

            # Stop retrying.
            return False

        # Return whether attempts remain.
        return attempt < self.max_attempts

    # Define the next delay.
    def next_delay_seconds(self, attempt):

        # Return exponential delay.
        return 2 ** attempt

# Define the retry processor.
class RetryProcessor:

    # Define the constructor.
    def __init__(self, policy):

        # Store the retry policy.
        self.policy = policy

    # Define the process method.
    def process(self, job, action):

        # Try to run the action.
        try:

            # Execute the job action.
            result = action(job)

            # Return completed result.
            return {"status": "completed", "result": result}

        # Handle an exception.
        except Exception:

            # Store the current attempt.
            attempt = job["attempt"]

            # Check whether retry is allowed.
            if self.policy.should_retry(attempt, "temporary"):

                # Return retry instruction.
                return {"status": "retry", "delay": self.policy.next_delay_seconds(attempt)}

            # Return failed status.
            return {"status": "failed"}
```

## 8) Tests

- Temporary error retries.
- Permanent error stops.
- Max attempts stops.
- Success marks complete.

## 9) Follow-up Interview Questions

**Q: How do you avoid duplicate side effects?**  
A: Make the job action idempotent with a job id or transaction id.

## 10) Tradeoffs and Wrap

Retry improves reliability, but too many retries can overload dependencies. Use limits and delay.

## Beginner Deep Dive: Transaction Retry Processor

<div class="class-demo">
  <div class="class-card"><strong>RetryJob</strong>Stores what must be retried and how many attempts happened.</div>
  <div class="class-card"><strong>RetryPolicy</strong>Decides if and when another attempt is allowed.</div>
  <div class="class-card"><strong>RetryProcessor</strong>Loads due jobs and executes the retry action.</div>
  <div class="class-card"><strong>JobRepository</strong>Persists job state so retries survive restarts.</div>
</div>

### What The Design Is Protecting

The main **invariant** is that a retryable operation should not retry forever. It must eventually succeed, wait, or become permanently failed.

This matters in payments because aggressive retries can overload processors or duplicate side effects.

### Step-by-step Explanation

`RetryJob` stores operation id, next retry time, attempt count, status, and last error.

`RetryPolicy` owns the retry math. For example, it can wait one second, then two seconds, then four seconds. This is called backoff in simple words: wait longer after each failure.

`RetryProcessor` scans for due jobs. It runs only jobs whose next retry time has arrived.

`JobRepository` keeps jobs durable. If the worker crashes, another worker can continue later.

### Failure and Safe Defaults

If the operation is not idempotent, do not retry automatically.

If the error is permanent, such as invalid merchant, stop retrying.

If the downstream system is down, slow the retry rate so the system can recover.

### Follow-up Interview Questions With Answers

**Q: How do you avoid duplicate retries across workers?**  
A: Claim a job atomically before processing it, often with a status update or lock.

**Q: What errors should not be retried?**  
A: Validation errors, unauthorized requests, and permanent business rule failures should not be retried.

**Q: What is the key tradeoff?**  
A: Retrying improves recovery, but too many retries can overload downstream systems.
