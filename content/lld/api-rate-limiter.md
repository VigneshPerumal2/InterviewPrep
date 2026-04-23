# API Rate Limiter

## NEXT THING TO SAY

I will design a token bucket rate limiter because it is simple, allows short bursts, and still controls average request rate. I will show the core algorithm, then discuss thread safety and distributed deployment.

## 0) Two-Line Design Framing

- We need to decide whether a request is allowed based on the caller's rate limit.
- Correctness means allowed requests consume tokens, rejected requests do not, and tokens never exceed capacity or go below zero.

## 1) Requirements and Constraints

- Limit by key (merchant_id, API key, or IP).
- Refill tokens over time at a configured rate.
- Allow bursts up to the bucket capacity.
- Reject requests when no tokens are available.
- Support multiple concurrent callers (thread safety).
- Return remaining tokens and retry-after time on rejection.

## 2) Objects and Responsibilities

| Object | Responsibility |
|---|---|
| `RateLimitPolicy` | Defines capacity and refill rate for a key |
| `BucketState` | Stores current tokens and last refill timestamp |
| `TokenBucket` | Implements the token bucket algorithm |
| `RateLimiter` | Finds the bucket for a key and checks allowance |
| `StateStore` | Persists bucket state (in-memory or Redis) |

## 3) Class/API Design

```text
RateLimiter.allow(key) -> RateLimitResult(allowed, remaining, retry_after)
TokenBucket.try_consume(now) -> (allowed, remaining)
StateStore.get(key) -> BucketState
StateStore.save(key, state) -> None
```

## 4) Core Workflow

1. Caller sends a request with a key.
2. RateLimiter looks up the BucketState for that key.
3. TokenBucket calculates elapsed time, refills tokens (capped at capacity), and attempts to consume one token.
4. If token available: consume, save state, return allowed.
5. If no token: calculate when next token arrives, return rejected with retry_after.

## 5) Invariants

- **invariant**: tokens never exceed capacity after any operation.
- **invariant**: tokens never go below zero after any operation.
- **invariant**: refill calculation is based on elapsed real time, not request count.

## 6) Edge Cases

- **edge case**: first request ever for a key (no existing state).
- **edge case**: bucket completely empty (all tokens consumed).
- **edge case**: long idle period (bucket should refill to capacity, not beyond).
- **edge case**: two concurrent requests arrive for the same key simultaneously.
- **edge case**: clock skew between servers in a distributed setup.

## 7) Python Implementation Sketch

```python
import time
import threading


class RateLimitResult:
    """Result of a rate limit check."""

    def __init__(self, allowed, remaining, retry_after=0.0):
        self.allowed = allowed
        self.remaining = remaining
        self.retry_after = retry_after


class TokenBucket:
    """Token bucket with refill logic and thread safety."""

    def __init__(self, capacity, refill_per_second):
        self.capacity = capacity
        self.refill_per_second = refill_per_second
        self.tokens = float(capacity)
        self.last_refill = time.monotonic()
        self.lock = threading.Lock()

    def try_consume(self):
        """Try to consume one token. Returns (allowed, remaining)."""
        with self.lock:
            now = time.monotonic()
            elapsed = now - self.last_refill

            # Refill tokens based on elapsed time.
            self.tokens = min(
                self.capacity,
                self.tokens + elapsed * self.refill_per_second
            )
            self.last_refill = now

            # Check if a token is available.
            if self.tokens >= 1.0:
                self.tokens -= 1.0
                return True, int(self.tokens)

            # Calculate when next token will be available.
            retry_after = (1.0 - self.tokens) / self.refill_per_second
            return False, 0, retry_after


class RateLimiter:
    """Rate limiter that manages buckets per key."""

    def __init__(self, default_capacity=100, default_refill=10.0):
        self.default_capacity = default_capacity
        self.default_refill = default_refill
        self.buckets = {}
        self.bucket_lock = threading.Lock()

    def allow(self, key):
        """Check if a request for the given key is allowed."""
        bucket = self._get_or_create_bucket(key)
        result = bucket.try_consume()

        if isinstance(result, tuple) and len(result) == 3:
            allowed, remaining, retry_after = result
            return RateLimitResult(allowed, remaining, retry_after)

        allowed, remaining = result
        return RateLimitResult(allowed, remaining)

    def _get_or_create_bucket(self, key):
        """Get existing bucket or create a new one for the key."""
        if key not in self.buckets:
            with self.bucket_lock:
                if key not in self.buckets:
                    self.buckets[key] = TokenBucket(
                        self.default_capacity,
                        self.default_refill
                    )
        return self.buckets[key]
```

### Sliding window counter alternative

```python
import time
import threading


class SlidingWindowCounter:
    """Sliding window rate limiter using two fixed windows."""

    def __init__(self, max_requests, window_seconds):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.current_count = 0
        self.previous_count = 0
        self.current_window_start = 0
        self.lock = threading.Lock()

    def allow(self):
        """Check if a request is allowed in the sliding window."""
        with self.lock:
            now = time.monotonic()
            current_window = int(now // self.window_seconds)

            # Rotate windows if we moved to a new window.
            if current_window != self.current_window_start:
                self.previous_count = self.current_count
                self.current_count = 0
                self.current_window_start = current_window

            # Calculate weighted count across windows.
            elapsed_in_window = now % self.window_seconds
            weight = 1.0 - (elapsed_in_window / self.window_seconds)
            estimated_count = (
                self.previous_count * weight + self.current_count
            )

            if estimated_count < self.max_requests:
                self.current_count += 1
                return True

            return False
```

## 8) Tests

- **Happy path**: Allows up to capacity requests.
- **Rejection**: Rejects when all tokens consumed.
- **Refill**: After waiting, tokens are replenished.
- **Capacity cap**: Does not exceed capacity even after long idle.
- **Concurrency**: Multiple threads do not corrupt token count.
- **First request**: New key starts with full capacity.
- **Retry-after**: Returns correct wait time on rejection.

## 9) Follow-up Interview Questions

**Q: How do you distribute this across multiple servers?**  
A: Store bucket state in Redis using a Lua script for atomic read-refill-decrement. Each server reads from and writes to the same Redis key.

**Q: What if Redis is down?**  
A: Fall back to local in-memory rate limiting with a conservative limit (50 percent of normal). This prevents complete blocking while still providing some protection.

## 10) Tradeoffs and Wrap

Token bucket supports bursts, which is good for payment APIs. The tradeoff is that distributed exactness is harder to achieve than with a simple counter. For production, I would add: persistent state in Redis, per-merchant policy configuration, metrics emission, and cleanup of stale buckets.

## Beginner Deep Dive: API Rate Limiter

<div class="class-demo">
  <div class="class-card"><strong>RateLimitPolicy</strong>Defines capacity (max burst) and refill speed (tokens per second) for each merchant tier.</div>
  <div class="class-card"><strong>BucketState</strong>Stores current available tokens and the timestamp of the last refill calculation.</div>
  <div class="class-card"><strong>TokenBucket</strong>Implements the core algorithm: refill tokens based on elapsed time, then try to consume one token.</div>
  <div class="class-card"><strong>RateLimiter</strong>Manages buckets per key. Creates new buckets on first request. Routes checks to the correct bucket.</div>
</div>

### What The Design Is Protecting

The main **invariant** is that a client cannot consume more tokens than the policy allows over any time period.

This protects shared payment services from overload and keeps one merchant from degrading service for others.

### Step-by-step Explanation

`RateLimitPolicy` stores the maximum burst (capacity) and refill rate. Burst means short temporary extra capacity. A merchant with capacity 100 and refill rate 10/second can make 100 requests instantly, then 10 per second thereafter.

`BucketState` stores how many tokens are left and when the last refill was calculated. This two-field state is the entire data model.

`TokenBucket` does the math: elapsed_time × refill_rate = new_tokens. Cap at capacity. If result >= 1, consume and allow. Otherwise, calculate retry_after = (1 - current_tokens) / refill_rate.

`RateLimiter` maps keys to buckets. For a single server, a dictionary suffices. For multiple servers, use Redis.

### Thread Safety Explained

Without locking, two concurrent requests might both read "5 tokens available," both consume one, and both succeed — but only one token was actually deducted. The lock ensures only one thread reads and updates the bucket at a time.

**Performance note**: The lock is per-bucket, not global. Two different merchants can be rate-limited concurrently without contention.

### Distributed Version Explained

In production with multiple API servers, each server cannot maintain its own bucket — a merchant could send 100 requests to each of 10 servers and get 1,000 allowed requests.

**Redis solution**: Store bucket state in Redis. Use a Lua script for atomic operations (read tokens, refill, decrement, return result). The Lua script runs atomically on the Redis server, preventing race conditions between API servers.

### Failure and Safe Defaults

If the counter store is down, the safest option is to apply a small local limit so the backend is protected.

If the policy is missing for a key, use the default strict policy instead of unlimited access.

### Follow-up Interview Questions With Answers

**Q: Why token bucket instead of fixed window?**  
A: Token bucket allows controlled bursts while maintaining long-term rate control. Fixed window allows 2x burst at window boundaries. For payment APIs with bursty checkout traffic, token bucket is more appropriate.

**Q: How do you make it distributed?**  
A: Store bucket state in Redis. Use a Lua script for atomic read-refill-decrement. Each API server executes the same Lua script against the same Redis key, guaranteeing consistency.

**Q: What is the key tradeoff?**  
A: Shared Redis counters are more accurate but add 1-2ms latency per request. Local counters are faster (microseconds) but less globally accurate. For payment APIs where 5 percent inaccuracy is acceptable, per-region Redis clusters provide a good balance.

**Q: How do you handle key cleanup for inactive merchants?**  
A: Set a TTL on Redis keys (e.g., 1 hour). If a merchant stops sending requests, the key expires automatically. For in-memory buckets, run a periodic cleanup that removes buckets not accessed in the last hour.
