# Payments Deep Dive

## What This Means

This page gives you a clearer payment mental model. In interviews, you do not need to be a payments expert, but you should sound comfortable with the core flow, risks, and engineering concerns.

## NEXT THING TO SAY

Visa payment systems are not just about moving money. They are reliable workflows that need approval, duplicate prevention, security, auditability, and safe failure handling.

## Card Payment Lifecycle

```text
Customer
  |
Merchant
  |
Acquirer / Processor
  |
Visa Network
  |
Issuer
```

### Why

The payment ecosystem has multiple parties because merchants and cardholders usually have different banks. Visa helps route transaction messages and enables the network rules and processing layer.

### What

The usual interview-level lifecycle is:

1. Authorization.
2. Capture or sale.
3. Clearing.
4. Settlement.
5. Reversal, void, refund, or dispute if needed.

### How

Authorization asks, "Can this payment be approved?" Capture asks, "Should we finalize the approved payment?" Settlement is the actual money movement between financial institutions.

## Authorization vs Capture vs Sale

| Term | Simple Meaning | Example |
|---|---|---|
| Authorization | Reserve or approve funds. | Hotel checks your card before stay. |
| Capture | Finalize a previous authorization. | Hotel charges after checkout. |
| Sale | Authorize and capture together. | Online purchase shipped immediately. |

## Void, Refund, Reversal, Dispute

| Term | Simple Meaning | Interview Risk |
|---|---|---|
| Void | Cancel before completion. | Must happen before processing window closes. |
| Refund | Return money after completion. | Needs link to original transaction. |
| Reversal | Release an authorization hold. | Important after partial capture or cancellation. |
| Dispute | Customer challenges transaction. | Needs evidence, logs, and audit trail. |

## Visa Direct

Visa Direct uses push-payment concepts. Public Visa docs describe Account Funding Transactions to pull funds and Original Credit Transactions to push funds.

```text
Sender funding source
   |
Pull funds
   |
Originator
   |
Push funds
   |
Recipient account
```

### Why This Matters In System Design

You must think about:

- **security**: who is allowed to send money?
- **compliance**: is this geography and recipient allowed?
- **failure modes**: what if the push fails after pull succeeds?
- **auditability**: can we explain what happened?

## Tokenization

Tokenization replaces the Primary Account Number with a token. Visa Token Service public docs explain that tokens can reduce exposure of sensitive card data and can be limited to channels such as a device, merchant, or use case.

```text
Real card number
   |
Token service
   |
Payment token
   |
Merchant / wallet / network flow
```

### Interview Answer

> Tokenization lowers risk because systems can process a token instead of exposing the real card number. If the token is compromised, it can be limited, replaced, or scoped more safely than the actual card number.

## Idempotency In Payments

### Why

Clients retry when requests time out. Without idempotency, a retry might create a second charge.

### What

An idempotency key identifies one logical operation.

### How

Store the key, request hash, status, and response. If the same key returns, return the original response.

## Payment Failure Modes

| Failure | Safe Handling |
|---|---|
| Timeout before response | Check idempotency and processor status before retrying. |
| Duplicate request | Return saved result. |
| Fraud service unavailable | Use policy-based fallback. |
| Audit pipeline delayed | Queue audit event, do not silently drop it. |
| Region outage | Fail over with replay-safe event processing. |

## Interview Practice

**Q: Why is a payment harder than a normal order API?**  
A: A payment touches real money, so duplicate prevention, audit logs, security, reconciliation, and failure handling are mandatory.

**Q: What should happen if a processor times out?**  
A: Do not blindly retry as a new payment. Use idempotency and reconciliation to determine the real state.

**Q: What is the difference between eventual consistency and strong consistency here?**  
A: Payment authorization state should be strongly protected. Analytics and dashboards can be slightly delayed.

## Common Mistakes

- Treating payment as a single database write.
- Ignoring reversals and refunds.
- Not storing enough audit data.
- Forgetting that retries can duplicate money movement.
