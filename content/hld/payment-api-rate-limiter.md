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

## Beginner Deep Dive: Payment API Rate Limiter

<div class="system-flow-demo">
  <div class="system-flow-title">Rate limiting protects shared payment systems from overload</div>
  <div class="flow-lane">
    <div class="flow-node">Merchant Request</div>
    <div class="flow-node">Policy Lookup</div>
    <div class="flow-node">Counter Update</div>
    <div class="flow-node">Allow or Reject</div>
    <div class="flow-node">Audit + Metrics</div>
  </div>
  <div class="flow-packet"></div>
</div>

### Policy Lookup

A policy says how many requests a merchant can make in a time window. Large merchants may have higher limits than small merchants.

I choose merchant-specific policies because one fixed limit is unfair and can block legitimate high-volume customers.

### Counter Update

The counter tracks how many requests were used. Common designs are fixed window, sliding window, and token bucket.

I choose token bucket for APIs because it allows short bursts but still controls long-term rate. The alternative is a fixed window, which is simpler but can allow bursts at window boundaries.

### Allow or Reject

If the merchant has capacity, the request continues. If not, return HTTP 429 with a clear retry time.

This keeps the payment system predictable under load.

### Failure, Multi-region, and Safe Fallback

**risks**: limiter store outage, clock skew, hot merchant keys, and false blocking.

**decisions**: cache policy locally, use a distributed counter for shared accuracy, and fail closed for suspicious traffic but allow limited low-risk traffic if business policy permits.

For multi-region, counters can be regional for lower latency. If a merchant sends traffic to multiple regions, global limits need either replicated counters or conservative per-region quotas.

## Follow-up Interview Questions With Answers

**Q: Why not just limit by IP address?**  
A: IP addresses can be shared or changed. Merchant identity is more accurate for payment APIs.

**Q: What happens when the counter store is down?**  
A: Use local emergency limits and protect downstream services. The system may be stricter until the counter store recovers.

**Q: What is the main tradeoff?**  
A: Accurate distributed limits cost more latency. Local limits are faster but less globally accurate.
