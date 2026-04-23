# Notification and Receipt Service

## NEXT THING TO SAY

I will design notifications as an asynchronous multi-channel delivery service because sending email, webhook, SMS, or push notifications should never slow the payment response path.

```text
Payment Event -> Notification Service -> Email / Webhook / SMS / Push
                       |
                 Preference Store
```

## Step 0: 20-second framing

Success means users receive accurate receipts promptly, duplicate messages are prevented using notification-level idempotency, provider failures are retried with backoff, and the system scales to handle payment volume without blocking the critical path.

## Section 1: Requirements and scope

**requirements**:

- Consume payment events (captured, refunded, failed) from event stream.
- Render receipts using configurable templates.
- Deliver through multiple channels: email, webhook, SMS, push.
- Respect merchant and customer notification preferences.
- Retry temporary provider failures with exponential backoff.
- Prevent duplicate notifications using idempotency.
- Track delivery status for support queries.

Non-functional **requirements**:

- Notification sent within 30 seconds of payment event for email and push.
- Webhook delivered within 5 seconds of payment event.
- 99.9 percent delivery success rate (excluding permanent failures like invalid email).
- Support 10,000 notifications per second during peak.

Safe default: if notification fails, do not roll back payment. Notification is non-blocking.

## Section 2: Quick capacity and growth

<div class="capacity-callout">
  <div class="capacity-metric"><strong>10,000</strong><span>Notifications/Sec Peak</span></div>
  <div class="capacity-metric"><strong>30s</strong><span>Email SLA</span></div>
  <div class="capacity-metric"><strong>5s</strong><span>Webhook SLA</span></div>
  <div class="capacity-metric"><strong>99.9%</strong><span>Delivery Rate</span></div>
</div>

Notification volume follows payment volume but can lag safely. Each payment may generate 1-3 notifications (merchant webhook + customer email + customer push).

## Section 3: Core API contracts

```text
Events consumed:
  PaymentCaptured   { payment_id, merchant_id, amount, currency, customer_email }
  RefundCompleted   { payment_id, merchant_id, refund_amount, currency }
  PaymentFailed     { payment_id, merchant_id, reason_code }

Internal API:
  POST /notifications/send
    Body: recipient, channel (email/webhook/sms/push), template_id,
          template_data, notification_key (idempotency)
    Response: notification_id, status (queued)

  GET /notifications/{id}/status
    Response: notification_id, channel, status (queued/sent/delivered/failed),
              attempts, last_attempt_at, provider_response
```

## Section 4: Data model and access patterns

<div class="schema-card">
  <div class="schema-card-header">notification_attempts</div>
  <div class="schema-field"><span class="schema-field-name">notification_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge pk">PK</span></div>
  <div class="schema-field"><span class="schema-field-name">notification_key</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-badge idx">IDX</span><span class="schema-field-note">Idempotency: payment_id + event_type + channel</span></div>
  <div class="schema-field"><span class="schema-field-name">payment_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">merchant_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">channel</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">email, webhook, sms, push</span></div>
  <div class="schema-field"><span class="schema-field-name">recipient</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">Email address, webhook URL, phone number</span></div>
  <div class="schema-field"><span class="schema-field-name">status</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">queued, sending, sent, delivered, failed, bounced</span></div>
  <div class="schema-field"><span class="schema-field-name">attempts</span><span class="schema-field-type">INTEGER</span></div>
  <div class="schema-field"><span class="schema-field-name">next_retry_at</span><span class="schema-field-type">TIMESTAMP</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">provider_response</span><span class="schema-field-type">JSONB</span></div>
  <div class="schema-field"><span class="schema-field-name">created_at</span><span class="schema-field-type">TIMESTAMP</span></div>
</div>

I choose a queue because provider calls are slow and failure-prone. Alternative: direct synchronous sending is acceptable only for small admin tools.

## Section 5: High-level architecture

<div class="flow-multi">
  <div class="flow-multi-title">Multi-channel notification delivery with retry and failover</div>
  <div class="flow-multi-label">Event consumption and routing</div>
  <div class="flow-multi-row">
    <div class="flow-node">Payment Event Stream</div>
    <div class="flow-node">Event Consumer</div>
    <div class="flow-node">Preference Lookup</div>
    <div class="flow-node">Template Renderer</div>
  </div>
  <div class="flow-multi-label">Channel-specific delivery queues</div>
  <div class="flow-multi-row">
    <div class="flow-node">Email Queue</div>
    <div class="flow-node">Webhook Queue</div>
    <div class="flow-node">SMS Queue</div>
    <div class="flow-node">Push Queue</div>
  </div>
  <div class="flow-multi-label">Provider layer with failover</div>
  <div class="flow-multi-row">
    <div class="flow-node-success">Primary Email Provider</div>
    <div class="flow-node-warn">Backup Email Provider</div>
    <div class="flow-node-success">Webhook Delivery</div>
    <div class="flow-node-success">SMS Provider</div>
  </div>
</div>

## Section 6: Key workflows

<div class="sequence-steps">
  <div class="sequence-steps-title">Receipt delivery workflow with retry</div>
  <div class="seq-step"><div class="seq-step-content"><strong>Consume payment event</strong><span>Read PaymentCaptured event from stream. Extract payment details, merchant_id, customer context. <span class="seq-step-fail">Parse error → dead letter queue</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Check notification preferences</strong><span>Look up merchant preferences (webhook URL, notification types enabled) and customer preferences (email opt-in, language). <span class="seq-step-fail">No preferences → use default channel (email)</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Check idempotency</strong><span>Generate notification_key from payment_id + event_type + channel. If already sent, skip. <span class="seq-step-fail">Already sent → skip (prevent duplicate)</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Render template</strong><span>Load merchant-specific or default template. Inject payment amount, currency, date, merchant name. Support localization by customer language. <span class="seq-step-fail">Template error → use fallback plain text template</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Route to channel queue</strong><span>Place rendered notification in the appropriate channel queue (email, webhook, SMS, push). Each queue has independent retry and rate limiting. <span class="seq-step-fail">Queue full → backpressure to consumer</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Channel worker delivers</strong><span>Worker picks from queue, calls provider API. On success, mark as sent. On temporary failure (5xx, timeout), schedule retry with exponential backoff (1s, 2s, 4s, 8s, max 5 attempts). On permanent failure (invalid email, 4xx), mark as failed. <span class="seq-step-fail">Max retries → mark permanently failed</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Track delivery status</strong><span>Store provider response, delivery timestamp, bounce status. Update notification_attempts record. Support team can query delivery status by payment_id. <span class="seq-step-fail">Status update error → log and continue</span></span></div></div>
</div>

### Webhook delivery specifics

Webhooks require special handling because merchants control the receiving endpoint:

- **Timeout**: 5-second connection timeout, 10-second response timeout.
- **Retry**: exponential backoff with 5 attempts over 24 hours.
- **Signature**: Sign webhook payload with merchant-specific secret (HMAC-SHA256) so merchants can verify authenticity.
- **Circuit breaker**: If a merchant endpoint fails consistently (10+ failures in an hour), pause delivery and alert the merchant.
- **Replay**: Merchants can request webhook replay for a time range through the API.

### Provider failover

For email delivery, configure primary and backup providers:

1. Attempt delivery through primary provider.
2. If primary returns 5xx or times out, immediately try backup provider.
3. Track provider reliability metrics to detect degradation.
4. If primary failure rate exceeds 10 percent, automatically route all traffic to backup.

## Section 7: Deep dive

### Template rendering pipeline

Templates support merchant branding (logo, colors, footer) and localization (language, currency format, date format).

**Template hierarchy**: merchant-specific template → country default → global default. This allows customization without requiring every merchant to provide templates.

**Security**: Templates should not include raw card numbers. Use masked values (ending in 4242) and tokenized references.

### Duplicates

- Use notification_key as idempotency key: combination of payment_id, event_type, and channel.
- Store provider response to support replay of the exact same content.
- Return same result on replay.

## Section 8: Reliability, observability, security

**Key metrics**: delivery success rate per channel, delivery latency (event to send), retry rate, bounce rate, provider error rate, webhook failure rate per merchant.

**Alerts**: delivery success drops below 99 percent, webhook circuit breaker opens for any merchant, email bounce rate exceeds 5 percent, consumer lag exceeds 5 minutes.

Track delivery success, provider errors, retry counts, and template changes.

## Section 9: Tradeoffs and wrap

- **key decision**: asynchronous notification decoupled from payment path.
- **key decision**: per-channel queues for independent scaling and retry.
- **tradeoff**: receipt may arrive slightly later than payment (seconds, not minutes).
- **tradeoff**: webhook delivery adds complexity (signatures, circuit breakers, replay) but enables real-time merchant integration.
- **risk**: duplicate receipts from event replay or consumer restart.
- **mitigation**: notification-level idempotency key prevents duplicate delivery.
- **risk**: provider outage affecting all notifications.
- **mitigation**: primary/backup provider failover with automatic traffic switching.

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

The payment system emits an event after a payment status changes. The notification service listens and decides whether to send email, SMS, webhook, or push notification based on merchant and customer preferences.

I choose event-driven notifications because sending messages should not block checkout. If the email provider is slow, the customer should not wait at the payment screen.

### Preference Check

Customers and merchants may choose which messages they want. The service should respect preferences and legal requirements (CAN-SPAM, GDPR opt-in).

**compliance** matters because some notifications may include financial data subject to privacy regulations, and marketing emails require explicit opt-in.

### Provider Send

The provider can be an email vendor (SendGrid, SES), SMS vendor (Twilio), webhook endpoint, or push notification service (Firebase, APNs).

I keep providers behind an adapter so the core service does not depend on one vendor. Switching from SendGrid to SES should require only a configuration change, not a code rewrite.

### Delivery Status

The service should store whether the notification was sent, delivered, bounced, or permanently failed.

This helps support teams answer "did the receipt go out?" and helps engineers identify provider issues before they affect many customers.

### Failure, Multi-region, and Safe Fallback

**risks**: duplicate receipts, provider outage, bad merchant webhook URL, and sensitive data leakage in email content.

**decisions**: use idempotency per notification, retries with exponential backoff, templates that never include raw card data, and delivery status tracking.

For multi-region, notifications can usually be regional. If a provider is down in one region, retry later or use a backup provider if the message is critical.

## Follow-up Interview Questions With Answers

**Q: Why asynchronous?**  
A: The customer should not wait for email delivery before checkout completes. Notification delivery can take seconds to minutes depending on the provider. Decoupling keeps the payment path fast.

**Q: How do you avoid duplicate receipts?**  
A: Use a unique notification key based on payment_id, event_type, and channel. Before sending, check if this key already has a sent record. This handles consumer restarts and event replay safely.

**Q: What if the provider is down?**  
A: Retry with exponential backoff up to a maximum number of attempts. If the primary provider fails consistently, automatically route to the backup provider. For webhooks, use a circuit breaker to avoid hammering a failing merchant endpoint.

**Q: How do you handle merchant webhook security?**  
A: Sign every webhook payload with a merchant-specific secret using HMAC-SHA256. Include a timestamp in the signature to prevent replay attacks. Merchants verify the signature before processing the webhook. Provide webhook verification libraries in common languages.

**Q: What is the delivery latency target?**  
A: Webhooks within 5 seconds (merchants need real-time updates for order fulfillment). Email within 30 seconds (customer expectation). SMS within 60 seconds. These are targets, not hard guarantees — provider latency varies.
