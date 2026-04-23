# Payment API Rate Limiter

## NEXT THING TO SAY

I will design a rate limiter that protects payment APIs from overload and abuse while allowing trusted merchants to operate within configured limits. I will use a token bucket algorithm for its burst tolerance and implement distributed counters for multi-server accuracy.

```text
Request -> Auth -> Rate Limit Check -> Payment API
                    |
                  Counter Store
```

## Step 0: 20-second framing

Success means fair usage enforcement, predictable performance under load, clear rejection responses with retry guidance, and different rate limits for different merchant tiers.

## Section 1: Requirements and scope

**requirements**:

- Limit by merchant and endpoint combination.
- Return a clear 429 error with Retry-After header when over limit.
- Support different merchant tiers (small: 100 TPS, medium: 1,000 TPS, large: 10,000 TPS).
- Allow short burst above average rate.
- Emit metrics and audit events for rate limit decisions.
- Support emergency bypass for incident recovery.

Non-functional **requirements**:

- Rate limit check latency under 2 milliseconds (must not slow the payment path).
- Counter accuracy within 5 percent (perfect global accuracy is not required).
- 99.99 percent availability (rate limiter down should not block all payments).

Safe default: if limit policy is unknown, use a conservative default (100 requests per minute).

## Section 2: Quick capacity and growth

<div class="capacity-callout">
  <div class="capacity-metric"><strong>&lt;2ms</strong><span>Check Latency</span></div>
  <div class="capacity-metric"><strong>50,000</strong><span>Checks/Sec</span></div>
  <div class="capacity-metric"><strong>3 tiers</strong><span>Merchant Levels</span></div>
  <div class="capacity-metric"><strong>5%</strong><span>Accuracy Tolerance</span></div>
</div>

Hot merchants and retry storms are the main risks. A merchant whose checkout page has a bug can send thousands of duplicate requests per second.

## Section 3: Core API contracts

The limiter is usually an internal middleware, not a standalone API. It returns:

```text
Internal check:
  Input: merchant_id, endpoint, request metadata
  Output: allowed (boolean), remaining_tokens, retry_after_seconds, reason

HTTP response when rejected:
  Status: 429 Too Many Requests
  Headers:
    Retry-After: 2        (seconds until next allowed request)
    X-RateLimit-Limit: 1000
    X-RateLimit-Remaining: 0
    X-RateLimit-Reset: 1682553600   (Unix timestamp when window resets)
  Body: { "error": "rate_limited", "message": "Exceeded 1000 requests per minute", "retry_after": 2 }
```

## Section 4: Data model and access patterns

<div class="schema-card">
  <div class="schema-card-header">rate_limit_policies</div>
  <div class="schema-field"><span class="schema-field-name">merchant_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge pk">PK</span></div>
  <div class="schema-field"><span class="schema-field-name">endpoint</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-badge pk">PK</span></div>
  <div class="schema-field"><span class="schema-field-name">tier</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">small, medium, large, enterprise</span></div>
  <div class="schema-field"><span class="schema-field-name">capacity</span><span class="schema-field-type">INTEGER</span><span class="schema-field-note">Max burst size (tokens)</span></div>
  <div class="schema-field"><span class="schema-field-name">refill_rate</span><span class="schema-field-type">FLOAT</span><span class="schema-field-note">Tokens added per second</span></div>
  <div class="schema-field"><span class="schema-field-name">updated_at</span><span class="schema-field-type">TIMESTAMP</span></div>
</div>

I choose Redis-style counters because reads and writes must be fast (sub-millisecond). Alternative: database counters are simpler but can become a bottleneck at high traffic.

## Section 5: High-level architecture

<div class="flow-multi">
  <div class="flow-multi-title">Rate limiter with distributed counters and tiered policies</div>
  <div class="flow-multi-label">Request path</div>
  <div class="flow-multi-row">
    <div class="flow-node">API Gateway</div>
    <div class="flow-node">Auth Middleware</div>
    <div class="flow-node">Rate Limit Check</div>
    <div class="flow-node">Payment Service</div>
  </div>
  <div class="flow-multi-label">Rate limit internals</div>
  <div class="flow-multi-row">
    <div class="flow-node">Policy Cache (local)</div>
    <div class="flow-node">Counter Store (Redis)</div>
    <div class="flow-node-success">Allow → Continue</div>
    <div class="flow-node-danger">Reject → 429</div>
  </div>
</div>

## Section 6: Key workflows

<div class="sequence-steps">
  <div class="sequence-steps-title">Rate limit check with token bucket</div>
  <div class="seq-step"><div class="seq-step-content"><strong>Authenticate merchant</strong><span>Extract merchant_id from API key. This happens before rate limiting so we know which policy to apply. <span class="seq-step-fail">Invalid key → 401 (not rate limited)</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Load rate limit policy</strong><span>Read merchant tier and limits from local policy cache. Cache refreshes every 60 seconds from the policy database. <span class="seq-step-fail">Policy missing → use conservative default (100 req/min)</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Read counter from Redis</strong><span>Key: rate:{merchant_id}:{endpoint}. Stores current token count and last refill timestamp. Use Redis MULTI/EXEC or Lua script for atomic read-refill-decrement. <span class="seq-step-fail">Redis down → use local emergency limit</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Calculate available tokens</strong><span>elapsed = now - last_refill. new_tokens = elapsed * refill_rate. current = min(capacity, stored_tokens + new_tokens). If current >= 1, consume one token and allow. <span class="seq-step-fail">No tokens → reject with retry time</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Return decision</strong><span>If allowed: continue to payment service with X-RateLimit headers. If rejected: return 429 with Retry-After header indicating when next token is available. <span class="seq-step-fail">Reject → 429 with guidance</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Emit metrics</strong><span>Record allow/reject decision, merchant_id, endpoint, remaining tokens. Feed dashboards and alerts. <span class="seq-step-fail">Metrics failure → non-blocking, log locally</span></span></div></div>
</div>

### Algorithm comparison

<div class="compare-grid">
  <div class="compare-card">
    <h4>Token Bucket (Recommended)</h4>
    <ul>
      <li>Allows short bursts up to capacity</li>
      <li>Smooth long-term rate control</li>
      <li>Simple to implement and explain</li>
      <li>Two parameters: capacity + refill rate</li>
      <li>Best for: payment APIs with bursty traffic</li>
    </ul>
  </div>
  <div class="compare-card">
    <h4>Sliding Window Counter</h4>
    <ul>
      <li>Counts requests in rolling time window</li>
      <li>More even distribution, no burst</li>
      <li>Slightly more complex implementation</li>
      <li>Better for strict per-second limits</li>
      <li>Best for: administrative APIs</li>
    </ul>
  </div>
  <div class="compare-card">
    <h4>Fixed Window Counter</h4>
    <ul>
      <li>Simplest implementation</li>
      <li>Allows 2x burst at window boundary</li>
      <li>Easy to understand and debug</li>
      <li>Less accurate for short windows</li>
      <li>Best for: internal rate limiting</li>
    </ul>
  </div>
</div>

### Redis Lua script for atomic token bucket

```text
-- Token bucket check as an atomic Redis operation
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

local elapsed = now - last_refill
tokens = math.min(capacity, tokens + elapsed * refill_rate)

if tokens >= 1 then
  tokens = tokens - 1
  redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
  redis.call('EXPIRE', key, 3600)
  return {1, tokens}  -- allowed, remaining
else
  redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
  redis.call('EXPIRE', key, 3600)
  local retry_after = (1 - tokens) / refill_rate
  return {0, retry_after}  -- rejected, retry_after seconds
end
```

## Section 7: Deep dive

### Multi-region rate limiting

<div class="compare-grid">
  <div class="compare-card">
    <h4>Per-Region Limits (Recommended)</h4>
    <ul>
      <li>Each region has independent counters</li>
      <li>Fastest check latency (local Redis)</li>
      <li>Total effective limit = N * per-region limit</li>
      <li>Less globally accurate</li>
      <li>Sufficient for most payment use cases</li>
    </ul>
  </div>
  <div class="compare-card">
    <h4>Global Limits</h4>
    <ul>
      <li>Single source of truth for counters</li>
      <li>Cross-region latency on every check</li>
      <li>Perfectly accurate global limit</li>
      <li>Higher complexity and failure risk</li>
      <li>Only needed for strict abuse prevention</li>
    </ul>
  </div>
</div>

### Emergency bypass

During incidents, rate limiting can block legitimate recovery traffic. Support an emergency bypass:

- Admin API to temporarily increase or disable limits for a specific merchant.
- All bypass actions audit-logged with admin identity and reason.
- Bypass auto-expires after a configured duration (default 1 hour).

## Section 8: Reliability, observability, security

**Key metrics**: rejection rate per merchant, per endpoint. Counter store latency. Policy cache hit rate. Merchant hotspot detection (which merchants are closest to their limits).

**Alerts**: any merchant hitting limits repeatedly (may indicate a bug in their integration). Counter store latency exceeds 5ms. Policy cache fails to refresh for 5 minutes.

Track rejection rate, counter errors, merchant hotspots, and policy changes.

## Section 9: Tradeoffs and wrap

- **key decision**: token bucket for burst tolerance on payment APIs.
- **key decision**: Redis for sub-millisecond counter operations.
- **tradeoff**: exact global limits cost cross-region latency; per-region limits are faster but approximate.
- **tradeoff**: local emergency limits during Redis outage are less accurate but prevent blocking all traffic.
- **risk**: false throttling of legitimate high-volume merchants.
- **mitigation**: tiered limits, proactive capacity planning, and merchant-specific overrides.
- **risk**: rate limiter itself becomes a single point of failure.
- **mitigation**: local fallback limits, Redis cluster with replicas, and fail-open option for low-risk endpoints.

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

I choose merchant-specific policies because one fixed limit is unfair and can block legitimate high-volume customers while being too generous for small merchants.

**Tier examples**: Small merchants: 100 requests per minute, 200 burst. Medium merchants: 1,000 per minute, 2,000 burst. Large merchants: 10,000 per minute, 15,000 burst. Enterprise: custom limits negotiated per contract.

### Counter Update

The counter tracks how many tokens are available. Tokens refill over time at the configured rate.

I choose token bucket for APIs because it allows short bursts (a merchant processes a batch of checkouts) but still controls long-term rate. The alternative is a fixed window, which is simpler but can allow 2x burst at window boundaries (end of one window + start of next).

### Allow or Reject

If the merchant has capacity, the request continues to the payment service. If not, return HTTP 429 with a clear Retry-After header.

**Why Retry-After matters**: Merchant SDKs can use the Retry-After value to implement intelligent backoff. Without it, merchants guess when to retry, often too aggressively, creating a retry storm.

### Failure and Safe Defaults

**risks**: limiter store outage, clock skew between servers, hot merchant keys, and false blocking during legitimate traffic spikes.

**decisions**: cache policy locally, use distributed counters for shared accuracy, and configure fail-open for payment authorization (better to allow a few extra requests than block all payments).

**Counter store down**: If Redis is unavailable, each API server maintains a local counter with a conservative limit (e.g., 50 percent of the merchant's normal limit). This prevents complete blocking while still providing some protection. When Redis recovers, local counters are discarded and Redis counters resume.

For multi-region, counters can be regional for lower latency. If a merchant sends traffic to multiple regions, global limits need either replicated counters or conservative per-region quotas.

## Follow-up Interview Questions With Answers

**Q: Why not just limit by IP address?**  
A: IP addresses can be shared (corporate NAT) or changed (mobile networks). Merchant identity is more accurate for payment APIs because it maps to the actual customer contract and tier.

**Q: What happens when the counter store is down?**  
A: Each API server falls back to a local in-memory counter with a conservative limit. This protects the backend while avoiding a complete outage. The system may be stricter than normal until the counter store recovers.

**Q: What is the main tradeoff?**  
A: Accurate distributed limits cost more latency (cross-region counter sync). Local limits are faster but less globally accurate. For payment APIs, slight inaccuracy (5 percent) is acceptable because the consequence is allowing a few extra requests, not financial risk.

**Q: How do you handle a merchant that legitimately needs higher limits?**  
A: The merchant requests a tier upgrade through their account manager. After approval, the policy database is updated. The local policy cache refreshes within 60 seconds. No code deployment required.

**Q: What about rate limiting at the API gateway level vs. application level?**  
A: Both. The API gateway provides a coarse first line of defense (global limits, IP-based). The application-level rate limiter provides fine-grained merchant-specific limits with business context. The gateway catches obvious abuse; the application enforces fair usage.
