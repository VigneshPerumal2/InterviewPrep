# Notification and Receipt Service

## NEXT THING TO SAY

I will design notifications as an asynchronous service because sending email, webhook, or text messages should not slow the payment response.

```text
Payment Event -> Notification Service -> Email / Webhook / Text
                       |
                 Preference Store
```

## Step 0: 20-second framing

Success means users receive accurate receipts, duplicate messages are avoided, and failures can be retried safely.

## Section 1: Requirements and scope

**requirements**:

- Consume payment events.
- Send receipts.
- Support merchant preferences.
- Retry temporary failures.
- Avoid duplicates.

Safe default: if notification fails, do not roll back payment.

## Section 2: Quick capacity and growth

Notification volume follows payment volume but can lag safely.

## Section 3: Core API contracts

Events: `PaymentCaptured`, `RefundCompleted`, `PaymentFailed`.

Internal API: `POST /notifications/send`.

## Section 4: Data model and access patterns

Entities: `NotificationPreference`, `NotificationAttempt`, `ReceiptTemplate`.

I choose a queue because provider calls are slow and failure-prone. Alternative: direct synchronous sending is acceptable only for small admin tools.

## Section 5: High-level architecture

```text
Event Stream
   |
Notification Worker
   |---- Preference Store
   |---- Template Store
   |---- Provider Client
   |
Attempt Log
```

## Section 6: Key workflows

Receipt workflow:

- Read payment event.
- Check preferences.
- Render template.
- Send message.
- Store attempt.

## Section 7: Deep dive

Duplicates:

- Use notification id as idempotency key.
- Store provider response.
- Return same result on replay.

## Section 8: Reliability, observability, security

Track delivery success, provider errors, retry counts, and template changes.

## Section 9: Tradeoffs and wrap

- **key decision**: asynchronous notification.
- **tradeoff**: receipt may arrive slightly later.
- **risk**: duplicate receipts.
- **mitigation**: idempotency and attempt logs.

## Beginner Deep Dive: Notification and Receipt Service

<div class="system-flow-demo">
  <div class="system-flow-title">Notifications should not slow the payment response</div>
  <div class="flow-lane">
    <div class="flow-node">Payment Event</div>
    <div class="flow-node">Notification Worker</div>
    <div class="flow-node">Preference Check</div>
    <div class="flow-node">Provider Send</div>
    <div class="flow-node">Delivery Status</div>
  </div>
  <div class="flow-packet"></div>
</div>

### Payment Event

The payment system emits an event after a payment status changes. The notification service listens and decides whether to send email, text, webhook, or in-app notification.

I choose event-driven notifications because sending messages should not block checkout.

### Preference Check

Customers and merchants may choose which messages they want. The service should respect preferences and legal requirements.

**compliance** matters because some notifications may include sensitive data or marketing rules.

### Provider Send

The provider can be an email vendor, text vendor, webhook endpoint, or internal messaging system.

I keep providers behind an adapter so the core service does not depend on one vendor.

### Delivery Status

The service should store whether the notification was sent, failed, retried, or permanently failed.

This helps support answer “did the receipt go out?”

### Failure, Multi-region, and Safe Fallback

**risks**: duplicate receipts, provider outage, bad merchant webhook, and sensitive data leakage.

**decisions**: use idempotency per notification, retries with backoff, templates that avoid raw card data, and delivery status tracking.

For multi-region, notifications can usually be regional. If a provider is down in one region, retry later or use a backup provider if the message is critical.

## Follow-up Interview Questions With Answers

**Q: Why asynchronous?**  
A: The customer should not wait for email delivery before checkout completes.

**Q: How do you avoid duplicate receipts?**  
A: Use a unique notification key based on payment id, event type, and recipient.

**Q: What if the provider is down?**  
A: Retry with backoff and store status. For non-critical messages, delay is better than blocking payments.
