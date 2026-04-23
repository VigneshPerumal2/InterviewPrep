# Payment API Rate Limiter

## NEXT THING TO SAY

I will design a rate limiter that protects payment APIs from overload and abuse while allowing trusted merchants to keep working within configured limits.

```text
Request -> Auth -> Rate Limit Check -> Payment API
                    |
                  Counter Store
```

## Step 0: 20-second framing

Success means fair usage, predictable performance, and clear rejection responses when limits are exceeded.

## Section 1: Requirements and scope

**requirements**:

- Limit by merchant and endpoint.
- Return a clear error when over limit.
- Support different merchant tiers.
- Emit metrics and audit events.

Safe default: if limit policy is unknown, use a conservative default.

## Section 2: Quick capacity and growth

Hot merchants and retry storms are the main risks.

## Section 3: Core API contracts

The limiter is usually internal. It returns allowed, retry-after time, and reason.

## Section 4: Data model and access patterns

Entities: `RateLimitPolicy`, `RateCounter`, `MerchantTier`.

I choose Redis-style counters because reads and writes must be fast. Alternative: database counters are simpler but can become slow at high traffic.

## Section 5: High-level architecture

```text
API Gateway
   |
Rate Limiter
   |---- Policy Cache
   |---- Counter Store
   |
Payment Service
```

## Section 6: Key workflows

Request flow:

- Authenticate merchant.
- Read policy.
- Increment counter.
- Allow or reject.

Failure handling:

- Counter store down: use local emergency limit or conservative rejection for high-risk endpoints.

## Section 7: Deep dive

Multi-region:

- Per-region limits are fast but approximate.
- Global limits are stricter but slower.
- Choose based on abuse risk and correctness needs.

## Section 8: Reliability, observability, security

Track rejection rate, counter errors, merchant hotspots, and policy changes.

## Section 9: Tradeoffs and wrap

- **key decision**: distributed counters.
- **tradeoff**: exact global limits cost more latency.
- **risk**: false throttling.
- **mitigation**: tiered limits and dashboards.
