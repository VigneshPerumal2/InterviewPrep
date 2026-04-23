# API Rate Limiter

## NEXT THING TO SAY

I will design a token bucket rate limiter because it is simple, allows short bursts, and still controls average request rate.

## 0) Two-Line Design Framing

- We need to decide whether a request is allowed.
- Correctness means allowed requests consume tokens and rejected requests do not.

## 1) Requirements and Constraints

- Limit by key.
- Refill over time.
- Allow bursts up to capacity.
- Reject when empty.

## 2) Objects and Responsibilities

`TokenBucket` owns token math. `RateLimiter` finds the bucket for a key.

## 3) Class/API Design

```text
RateLimiter.allow(key)
TokenBucket.allow(now)
```

## 4) Core Workflow

Find bucket, refill tokens, check if token exists, consume one token, return decision.

## 5) Invariants

- **invariant**: tokens never exceed capacity.
- **invariant**: tokens never go below zero.

## 6) Edge Cases

- **edge cases**: first request.
- **edge cases**: empty bucket.
- **edge cases**: long idle period.

## 7) Python Implementation Sketch

```python
# Define the token bucket.
class TokenBucket:

    # Define the constructor.
    def __init__(self, capacity, refill_per_second):

        # Store capacity.
        self.capacity = capacity

        # Store refill rate.
        self.refill_per_second = refill_per_second

        # Store current tokens.
        self.tokens = capacity

        # Store last refill time.
        self.last_refill = 0

    # Define the allow method.
    def allow(self, now):

        # Calculate elapsed seconds.
        elapsed = now - self.last_refill

        # Add refilled tokens.
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_per_second)

        # Store the refill time.
        self.last_refill = now

        # Check for an available token.
        if self.tokens < 1:

            # Reject the request.
            return False

        # Consume one token.
        self.tokens -= 1

        # Allow the request.
        return True
```

## 8) Tests

- Allows up to capacity.
- Rejects when empty.
- Refills after time passes.
- Does not exceed capacity.

## 9) Follow-up Interview Questions

**Q: How do you distribute this?**  
A: Store counters in a shared fast store, or use approximate per-region limits when exact global limits are not required.

## 10) Tradeoffs and Wrap

Token bucket supports bursts. The tradeoff is that distributed exactness is harder.

## Beginner Deep Dive: API Rate Limiter

<div class="class-demo">
  <div class="class-card"><strong>RateLimitPolicy</strong>Defines capacity and refill speed.</div>
  <div class="class-card"><strong>BucketState</strong>Stores available tokens and last refill time.</div>
  <div class="class-card"><strong>RateLimiter</strong>Checks whether one request is allowed.</div>
  <div class="class-card"><strong>StateStore</strong>Persists counters for distributed servers.</div>
</div>

### What The Design Is Protecting

The main **invariant** is that a client cannot consume more tokens than the policy allows.

This protects shared services from overload and keeps one merchant from hurting others.

### Step-by-step Explanation

`RateLimitPolicy` stores the maximum burst and refill rate. Burst means short temporary extra capacity.

`BucketState` stores how many tokens are left. Tokens refill over time.

`RateLimiter` calculates how many tokens should be added since the last request, caps the bucket at max capacity, and then spends one token if available.

`StateStore` can be in-memory for one server or a shared fast store for many servers.

### Failure and Safe Defaults

If the counter store is down, the safest option is to apply a small local limit so the backend is protected.

If the policy is missing, use the default strict policy instead of unlimited access.

### Follow-up Interview Questions With Answers

**Q: Why token bucket?**  
A: It allows short bursts while still controlling long-term traffic.

**Q: How do you make it distributed?**  
A: Store bucket state in a shared store and update it atomically.

**Q: What is the key tradeoff?**  
A: Shared counters are more accurate but slower. Local counters are faster but less globally accurate.
