# API Security and Observability

## What This Means

Visa-style backend systems need more than working code. They need secure defaults, clear ownership, reliable debugging, and safe rollout.

## NEXT THING TO SAY

For a payment or merchant API, I think about validation, authentication, authorization, idempotency, rate limiting, logging, metrics, tracing, and audit from the start.

## Secure API Checklist

### Why

APIs are entry points into business systems. If an API is weak, attackers or buggy clients can cause data leaks, duplicate payments, or operational incidents.

### What

For every API, check:

- **authentication**: who is calling?
- **authorization**: what are they allowed to do?
- **input validation**: is the request safe and complete?
- **idempotency**: can clients retry safely?
- **rate limiting**: can we prevent abuse?
- **audit**: can we explain who did what?

### How

```text
Client
  |
API Gateway
  |
Authentication
  |
Authorization
  |
Validation
  |
Service Logic
  |
Audit + Metrics
```

## Authentication and Authorization

Authentication proves identity. Authorization checks permission.

Example:

- Authentication: this request came from merchant `M123`.
- Authorization: merchant `M123` can only read and create payments for merchant `M123`.

## Idempotency and Replay Protection

Replay means a request is sent again. Sometimes this is normal retry behavior. Sometimes it is suspicious.

Safe API design stores:

- idempotency key
- request hash
- response
- expiration time
- merchant id

## Rate Limiting

Rate limiting protects shared systems.

Use different limits by:

- merchant
- endpoint
- risk level
- environment

## Observability

### Logs

Logs answer: what happened?

Good payment log fields:

- payment id
- merchant id
- region
- status
- error code
- idempotency key hash, not raw secrets

### Metrics

Metrics answer: how often and how long?

Track:

- authorization success rate
- decline rate
- error rate
- duplicate request rate
- response time
- downstream timeout count

### Traces

Traces answer: where did time go?

```text
API request
  |
Payment service
  |
Fraud service
  |
Processor connector
  |
Database
```

## Incident Handling

When something breaks:

1. Confirm customer or merchant impact.
2. Stop the bleeding.
3. Roll back or disable risky feature if needed.
4. Gather logs, metrics, and traces.
5. Communicate clearly.
6. Write follow-up actions.

## Safe Rollout

Use:

- feature flags
- canary release
- rollback plan
- dashboards before launch
- alerts for new failure modes

## Interview Practice

**Q: What would you log for payment authorization?**  
A: payment id, merchant id, status, latency, error code, downstream service result, and audit event id. I would not log raw card data.

**Q: How do you debug a latency spike?**  
A: I check metrics to find which endpoint is slow, traces to find which dependency is slow, and logs to inspect errors for affected requests.

**Q: What is least privilege?**  
A: A service or user only gets the permissions needed for its job, nothing more.

## Common Mistakes

- Logging sensitive card data.
- Adding metrics after production incidents instead of before release.
- Treating retries as harmless.
- Forgetting tenant and merchant boundaries.
