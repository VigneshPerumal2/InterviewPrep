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
