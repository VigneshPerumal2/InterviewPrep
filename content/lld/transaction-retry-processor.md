# Transaction Retry Processor

## NEXT THING TO SAY

I will design the retry processor with exponential backoff, jitter, a maximum retry limit, and a dead letter queue for failed jobs. Each retry policy is pluggable so different transaction types can have different retry strategies.

## 0) Two-Line Design Framing

- We need to retry failed payment operations with increasing delays, a maximum attempt limit, and clear failure handling.
- Correctness means retry attempts respect the backoff schedule, exceed the max attempt limit never, and permanently failed jobs move to a dead letter queue for investigation.

## 1) Requirements and Constraints

- Retry failed operations with configurable backoff strategy.
- Maximum retry attempts per job (default 5).
- Exponential backoff with jitter to prevent thundering herd.
- Dead letter queue for jobs that exhaust all retries.
- Job claiming must be atomic (no two workers process the same job).
- Support different retry policies per job type.
- Jobs must survive process restarts (persistent storage).

## 2) Objects and Responsibilities

| Object | Responsibility |
|---|---|
| `RetryJob` | Data object: job payload, attempt count, next retry time |
| `RetryPolicy` | Interface for calculating next retry delay |
| `ExponentialBackoffPolicy` | Delay doubles each attempt with jitter |
| `FixedDelayPolicy` | Same delay for every attempt |
| `RetryProcessor` | Manages job queue, claims jobs, executes retries |
| `DeadLetterQueue` | Stores permanently failed jobs |
| `JobRepository` | Persists retry jobs |

## 3) Class/API Design

```text
RetryProcessor.submit(job_type, payload, policy) -> job_id
RetryProcessor.process_due_jobs() -> int (count processed)
RetryPolicy.next_delay(attempt) -> float (seconds)
DeadLetterQueue.add(job, reason) -> None
DeadLetterQueue.list() -> list[FailedJob]
DeadLetterQueue.replay(job_id) -> None
JobRepository.claim_due_job() -> RetryJob or None
```

## 4) Core Workflow

1. A failed operation is submitted to the retry processor with a payload and policy.
2. RetryProcessor creates a RetryJob with attempt=0 and next_retry_at=now.
3. A background loop calls process_due_jobs() periodically.
4. JobRepository.claim_due_job() atomically finds and claims the next due job.
5. RetryProcessor executes the job's action.
6. If success: mark job as completed. Remove from queue.
7. If failure and attempts < max: increment attempt, calculate next delay with jitter, update next_retry_at.
8. If failure and attempts >= max: move to dead letter queue.

## 5) Invariants

- **invariant**: a job is never processed by two workers simultaneously.
- **invariant**: retry attempts never exceed the configured maximum.
- **invariant**: backoff delay increases monotonically (with jitter variance).
- **invariant**: every permanently failed job is in the dead letter queue.
- **invariant**: jobs in the dead letter queue can be manually replayed.

## 6) Edge Cases

- **edge case**: job succeeds on first retry → remove from queue immediately.
- **edge case**: all retries exhausted → move to dead letter queue with full history.
- **edge case**: worker crashes during processing → job stays "processing" until timeout, then auto-retried.
- **edge case**: clock skew between workers → use consistent timestamps from the job store.
- **edge case**: massive retry storm → jitter prevents all retries from hitting the service simultaneously.
- **edge case**: job payload is invalid → mark as permanently failed without retrying.

## 7) Python Implementation Sketch

```python
import time
import uuid
import random
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum


class JobStatus(Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"


@dataclass
class RetryJob:
    """A retryable job with backoff tracking."""
    job_id: str = field(
        default_factory=lambda: str(uuid.uuid4())
    )
    job_type: str = ""
    payload: dict = field(default_factory=dict)
    status: JobStatus = JobStatus.QUEUED
    attempt: int = 0
    max_attempts: int = 5
    next_retry_at: float = field(default_factory=time.time)
    created_at: float = field(default_factory=time.time)
    last_error: str = ""
    worker_id: str = ""
    history: list = field(default_factory=list)


class RetryPolicy(ABC):
    """Interface for retry delay calculation."""

    @abstractmethod
    def next_delay(self, attempt):
        """Calculate delay in seconds for the given attempt number."""
        pass


class ExponentialBackoffPolicy(RetryPolicy):
    """Exponential backoff with jitter.

    Delay formula: base * (2 ** attempt) + random jitter
    Prevents thundering herd by spreading retries over time.
    """

    def __init__(self, base_delay=1.0, max_delay=300.0, jitter=True):
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.jitter = jitter

    def next_delay(self, attempt):
        """Calculate delay with exponential backoff and jitter.

        attempt 0: 1s + jitter
        attempt 1: 2s + jitter
        attempt 2: 4s + jitter
        attempt 3: 8s + jitter
        attempt 4: 16s + jitter
        """
        delay = self.base_delay * (2 ** attempt)
        delay = min(delay, self.max_delay)

        if self.jitter:
            # Full jitter: random between 0 and calculated delay.
            # This gives the best spread and prevents retry storms.
            delay = random.uniform(0, delay)

        return delay


class FixedDelayPolicy(RetryPolicy):
    """Fixed delay between retries. Simple but no backoff."""

    def __init__(self, delay=5.0):
        self.delay = delay

    def next_delay(self, attempt):
        return self.delay


class LinearBackoffPolicy(RetryPolicy):
    """Linear backoff: delay increases by a fixed amount each attempt."""

    def __init__(self, base_delay=2.0, increment=2.0, max_delay=60.0):
        self.base_delay = base_delay
        self.increment = increment
        self.max_delay = max_delay

    def next_delay(self, attempt):
        delay = self.base_delay + (self.increment * attempt)
        return min(delay, self.max_delay)


class DeadLetterQueue:
    """Stores permanently failed jobs for investigation and replay."""

    def __init__(self):
        self._jobs = {}
        self._lock = threading.Lock()

    def add(self, job, reason):
        """Add a permanently failed job."""
        with self._lock:
            job.status = JobStatus.DEAD_LETTER
            job.last_error = reason
            self._jobs[job.job_id] = job

    def list_all(self):
        """List all dead letter jobs."""
        with self._lock:
            return list(self._jobs.values())

    def get(self, job_id):
        """Get a specific dead letter job."""
        return self._jobs.get(job_id)

    def remove(self, job_id):
        """Remove a job after successful replay."""
        with self._lock:
            return self._jobs.pop(job_id, None)

    def count(self):
        return len(self._jobs)


class JobRepository:
    """Persists retry jobs with atomic claiming."""

    def __init__(self):
        self._jobs = {}
        self._lock = threading.Lock()

    def save(self, job):
        with self._lock:
            self._jobs[job.job_id] = job

    def claim_due_job(self, worker_id):
        """Atomically claim the next due job.

        Uses a lock to prevent two workers from claiming
        the same job. In production, this would be a database
        UPDATE ... WHERE status = 'queued' AND next_retry_at <= now
        LIMIT 1 with row-level locking.
        """
        now = time.time()
        with self._lock:
            for job in self._jobs.values():
                if (job.status == JobStatus.QUEUED and
                        job.next_retry_at <= now):
                    job.status = JobStatus.PROCESSING
                    job.worker_id = worker_id
                    return job
        return None

    def mark_completed(self, job_id):
        with self._lock:
            if job_id in self._jobs:
                self._jobs[job_id].status = JobStatus.COMPLETED

    def delete(self, job_id):
        with self._lock:
            self._jobs.pop(job_id, None)

    def get_queue_depth(self):
        """Count jobs waiting to be processed."""
        return sum(
            1 for j in self._jobs.values()
            if j.status == JobStatus.QUEUED
        )


class RetryProcessor:
    """Manages retry jobs with configurable policies.

    Usage:
        processor = RetryProcessor(repository, dead_letter)
        job_id = processor.submit("payment_retry", payload, policy)
        processor.process_due_jobs()  # called periodically
    """

    def __init__(self, repository, dead_letter_queue,
                 worker_id="worker-1"):
        self.repository = repository
        self.dlq = dead_letter_queue
        self.worker_id = worker_id
        self._handlers = {}
        self._policies = {}

    def register_handler(self, job_type, handler_fn, policy=None):
        """Register a handler function for a job type."""
        self._handlers[job_type] = handler_fn
        self._policies[job_type] = policy or ExponentialBackoffPolicy()

    def submit(self, job_type, payload, max_attempts=5):
        """Submit a new retry job."""
        job = RetryJob(
            job_type=job_type,
            payload=payload,
            max_attempts=max_attempts,
            next_retry_at=time.time()
        )
        self.repository.save(job)
        return job.job_id

    def process_due_jobs(self):
        """Process all due jobs. Returns count of jobs processed."""
        processed = 0

        while True:
            job = self.repository.claim_due_job(self.worker_id)
            if job is None:
                break

            self._process_job(job)
            processed += 1

        return processed

    def _process_job(self, job):
        """Execute a single job with retry handling."""
        handler = self._handlers.get(job.job_type)
        if handler is None:
            self.dlq.add(job, f"No handler for type: {job.job_type}")
            return

        policy = self._policies.get(
            job.job_type, ExponentialBackoffPolicy()
        )

        try:
            handler(job.payload)

            # Success: mark completed and remove.
            self.repository.mark_completed(job.job_id)
            job.history.append({
                "attempt": job.attempt,
                "status": "success",
                "timestamp": time.time()
            })
            self.repository.delete(job.job_id)

        except Exception as e:
            job.attempt += 1
            error_msg = str(e)
            job.history.append({
                "attempt": job.attempt,
                "status": "failed",
                "error": error_msg,
                "timestamp": time.time()
            })

            if job.attempt >= job.max_attempts:
                # Exhausted all retries.
                self.dlq.add(
                    job,
                    f"Max attempts ({job.max_attempts}) exceeded. "
                    f"Last error: {error_msg}"
                )
                self.repository.delete(job.job_id)
            else:
                # Schedule next retry with backoff.
                delay = policy.next_delay(job.attempt)
                job.next_retry_at = time.time() + delay
                job.status = JobStatus.QUEUED
                job.last_error = error_msg
                job.worker_id = ""
                self.repository.save(job)
```

## 8) Tests

- **Happy path**: Job succeeds on first attempt → completed and removed.
- **Retry success**: Job fails twice, succeeds on third → completed.
- **Max retries**: Job fails max_attempts times → moved to dead letter queue.
- **Backoff timing**: Delays increase exponentially (1s, 2s, 4s, 8s, 16s).
- **Jitter**: Delays have random component (not exact exponential).
- **Atomic claiming**: Two workers cannot process the same job.
- **Dead letter**: DLQ stores job with full retry history.
- **Dead letter replay**: Job can be replayed from DLQ.
- **Different policies**: Payment retries use exponential, notifications use fixed delay.
- **Worker crash**: Processing job without completion → stays processing until timeout.

## 9) Follow-up Interview Questions

**Q: How do you prevent thundering herd?**  
A: Full jitter randomizes retry delay between 0 and the calculated backoff time. This spreads retries across time instead of all workers retrying at the same moment after a backoff period.

**Q: How do you handle worker crashes?**  
A: A heartbeat monitor checks for jobs stuck in "processing" status for longer than a timeout (e.g., 10 minutes). Stale processing jobs are reset to "queued" with their attempt count preserved. This allows another worker to pick them up.

**Q: How do you handle idempotent retries?**  
A: The retry payload includes the original idempotency key. When the processor receives the retry, it uses the same idempotency key, which prevents duplicate side effects at the processor level.

**Q: How do you monitor retry health?**  
A: Key metrics: retry success rate (should be >80% on first retry), average attempts to success, dead letter queue size (should stay small), queue depth (should not grow continuously), and retry delay distribution.

## 10) Tradeoffs and Wrap

Policy-driven backoff makes the retry behavior configurable per job type. The tradeoff is more complexity than a simple fixed-delay retry loop. For production, I would add: database persistence for job state, worker heartbeat monitoring, metrics dashboards, dead letter queue alerting, and a web UI for DLQ investigation and replay.

## Beginner Deep Dive: Transaction Retry Processor

<div class="class-demo">
  <div class="class-card"><strong>RetryJob</strong>Stores job payload, attempt count, next retry time, and error history. The history helps debug why a job keeps failing.</div>
  <div class="class-card"><strong>RetryPolicy</strong>Interface for calculating delay. ExponentialBackoff doubles each attempt. FixedDelay is the same every time. New policies can be added without changing the processor.</div>
  <div class="class-card"><strong>RetryProcessor</strong>Claims due jobs, executes them, handles success (remove) and failure (schedule retry or dead letter).</div>
  <div class="class-card"><strong>DeadLetterQueue</strong>Stores permanently failed jobs. Engineers can inspect, fix the root cause, and replay the job.</div>
</div>

### What The Design Is Protecting

The main **invariant** is that retry attempts never exceed the configured maximum, and every permanently failed job ends up in the dead letter queue for investigation.

### Why Exponential Backoff

If a service is down and 1,000 jobs retry after 1 second, all 1,000 requests hit the service simultaneously, potentially keeping it down. Exponential backoff spreads these retries over longer intervals (1s, 2s, 4s, 8s, 16s), giving the service time to recover.

### Why Jitter

Even with exponential backoff, if all jobs started at the same time, they all retry at the same intervals. Jitter adds randomness so retries are spread across the delay window instead of all arriving at the same moment. Full jitter (random between 0 and delay) gives the best spread.

**Backoff timeline example without jitter**: All 1,000 jobs retry at exactly 1s, then 2s, then 4s.

**Backoff timeline example with full jitter**: Jobs retry randomly between 0-1s, then 0-2s, then 0-4s. Load is spread evenly.

### Atomic Job Claiming

Without atomic claiming, two workers could read the same job, both start processing it, and create duplicate effects. The claim operation uses a database UPDATE with a WHERE clause that only matches unclaimed jobs:

```text
UPDATE retry_jobs 
SET status = 'processing', worker_id = 'worker-1'
WHERE status = 'queued' AND next_retry_at <= now()
LIMIT 1
```

Only one worker's UPDATE will match (the other finds zero rows), guaranteeing single-worker processing.

### Dead Letter Queue Explained

A dead letter queue is where permanently failed jobs go after exhausting all retries. It is not a graveyard — it is an investigation queue. Engineers inspect the job payload, the error history, fix the root cause (e.g., correct a processor configuration), and replay the job.

A growing DLQ is a signal that something is systemically wrong and needs attention.

### Failure and Safe Defaults

If the retry processor itself crashes, jobs stay in the database with their current status. When the processor restarts, it resumes processing due jobs. No jobs are lost because state is persistent.

If a job keeps failing with the same error, exponential backoff prevents it from consuming excessive resources while still giving the downstream service time to recover.
