# Real-Time Fraud Detection

## NEXT THING TO SAY

I will design fraud detection as a low-latency decision service that evaluates transactions using rules and model scoring in parallel, returns explainable reason codes, and preserves auditability for every decision.

```text
Payment Service -> Fraud API -> Rules + Model
                       |
                  Feature Store
```

## Step 0: 20-second framing

Success means fraud decisions happen within 50 milliseconds, every decline includes a human-readable reason code, the system fails safely when data is missing, and model updates can be deployed without downtime.

## Section 1: Requirements and scope

**requirements**:

- Score a transaction in real time (under 50ms P99).
- Return one of three actions: approve, review, or decline.
- Include reason codes for every non-approve decision.
- Support model versioning with safe rollout.
- Store audit records for every decision.
- Allow rule updates without code deployment.

Non-functional **requirements**:

- P99 decision latency under 50 milliseconds.
- 99.99 percent availability on the payment path.
- False positive rate below 2 percent (blocking good customers hurts revenue).
- Feature freshness within 5 minutes for velocity counters.

Safe default: if fraud data is unavailable for high-risk traffic, send to review or decline based on policy.

## Section 2: Quick capacity and growth

<div class="capacity-callout">
  <div class="capacity-metric"><strong>10,000</strong><span>Decisions/sec</span></div>
  <div class="capacity-metric"><strong>50ms</strong><span>P99 Latency</span></div>
  <div class="capacity-metric"><strong>&lt;2%</strong><span>False Positive Rate</span></div>
  <div class="capacity-metric"><strong>5 min</strong><span>Feature Freshness</span></div>
</div>

Fraud checks sit on the payment critical path, so every millisecond matters. The fraud service must be faster than the processor call (which typically takes 200-400ms). Popular merchants can create hotspots in feature lookups.

**Feature store sizing**: 50 million active customer profiles with 20 features each at 200 bytes per profile = 10 gigabytes. This fits comfortably in memory on a single Redis cluster. Read latency target: under 2 milliseconds.

## Section 3: Core API contracts

```text
POST /fraud/decisions
  Body:
    transaction_id     string    required
    merchant_id        string    required
    amount             integer   required (minor units)
    currency           string    required
    payment_token      string    required
    customer_ip        string    optional
    device_fingerprint string    optional
    shipping_country   string    optional
  Response 200:
    decision           string    (approve, review, decline)
    score              float     (0.0 to 1.0 risk score)
    reason_codes       array     (e.g. ["velocity_exceeded", "country_mismatch"])
    model_version      string    (e.g. "v3.2.1")
    evaluation_ms      integer   (processing time)
```

## Section 4: Data model and access patterns

<div class="schema-card">
  <div class="schema-card-header">fraud_decisions</div>
  <div class="schema-field"><span class="schema-field-name">decision_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge pk">PK</span></div>
  <div class="schema-field"><span class="schema-field-name">transaction_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">merchant_id</span><span class="schema-field-type">UUID</span><span class="schema-field-badge idx">IDX</span></div>
  <div class="schema-field"><span class="schema-field-name">decision</span><span class="schema-field-type">VARCHAR</span><span class="schema-field-note">approve, review, decline</span></div>
  <div class="schema-field"><span class="schema-field-name">score</span><span class="schema-field-type">FLOAT</span><span class="schema-field-note">0.0 to 1.0</span></div>
  <div class="schema-field"><span class="schema-field-name">reason_codes</span><span class="schema-field-type">TEXT[]</span><span class="schema-field-note">Array of triggered reasons</span></div>
  <div class="schema-field"><span class="schema-field-name">model_version</span><span class="schema-field-type">VARCHAR</span></div>
  <div class="schema-field"><span class="schema-field-name">rules_triggered</span><span class="schema-field-type">JSONB</span><span class="schema-field-note">Which rules fired and their outputs</span></div>
  <div class="schema-field"><span class="schema-field-name">features_used</span><span class="schema-field-type">JSONB</span><span class="schema-field-note">Snapshot of input features</span></div>
  <div class="schema-field"><span class="schema-field-name">evaluation_ms</span><span class="schema-field-type">INTEGER</span></div>
  <div class="schema-field"><span class="schema-field-name">created_at</span><span class="schema-field-type">TIMESTAMP</span><span class="schema-field-badge idx">IDX</span></div>
</div>

I choose a low-latency key-value store for hot features because decisions need fast reads. The relational database stores decision audit history. Alternative: relational storage for rule management and governance.

**Feature store architecture**: Two tiers. Hot features (velocity counters, recent transaction history, device trust) live in Redis with sub-2ms read latency. Cold features (account age, historical chargeback rate, merchant category risk) are precomputed batch features stored in a read replica and cached locally.

## Section 5: High-level architecture

<div class="flow-multi">
  <div class="flow-multi-title">Fraud evaluation pipeline — parallel rule and model execution</div>
  <div class="flow-multi-label">Input and feature assembly</div>
  <div class="flow-multi-row">
    <div class="flow-node">Payment Service Call</div>
    <div class="flow-node">Feature Assembler</div>
    <div class="flow-node">Hot Features (Redis)</div>
    <div class="flow-node">Cold Features (Cache)</div>
  </div>
  <div class="flow-multi-label">Parallel evaluation</div>
  <div class="flow-multi-row">
    <div class="flow-node">Rules Engine</div>
    <div class="flow-node">ML Model Scorer</div>
    <div class="flow-node">Decision Combiner</div>
    <div class="flow-node-success">Final Decision</div>
  </div>
  <div class="flow-multi-label">Async post-decision</div>
  <div class="flow-multi-row">
    <div class="flow-node-success">Decision Audit Log</div>
    <div class="flow-node-success">Feature Update Pipeline</div>
    <div class="flow-node-success">Model Training Data</div>
  </div>
</div>

## Section 6: Key workflows

<div class="sequence-steps">
  <div class="sequence-steps-title">Fraud decision workflow with failure handling</div>
  <div class="seq-step"><div class="seq-step-content"><strong>Receive transaction from payment service</strong><span>Extract merchant_id, amount, currency, payment token, customer context. Validate inputs. <span class="seq-step-fail">Invalid input → return approve with flag for non-blocking</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Assemble features</strong><span>Parallel fetch: velocity counters from Redis (2ms), device trust from cache (1ms), merchant risk category from local cache (0ms). Compute derived features: amount_vs_average, transaction_frequency_1h, country_match. <span class="seq-step-fail">Redis down → use stale cache or skip velocity features</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Evaluate rules in parallel</strong><span>Run all active rules against the feature set. Rules include: amount threshold, velocity limit, country mismatch, new device, blocked BIN. Each rule returns allow/review/decline with a reason code. <span class="seq-step-fail">Rule error → skip that rule, log error</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Score with ML model</strong><span>Send feature vector to model service. Model returns a probability score (0 to 1) and top contributing features. Model runs in a separate container for independent scaling and deployment. <span class="seq-step-fail">Model timeout → use rules-only fallback</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Combine decisions</strong><span>Apply priority logic: any rule that declines overrides model approve. Model score above 0.8 triggers review even if rules approve. Final decision is the strictest of all evaluations. <span class="seq-step-fail">Conflict → strictest wins</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Return decision with reason codes</strong><span>Response includes decision, score, all triggered reason codes, and model version. Payment service uses this to authorize or decline. <span class="seq-step-fail">Return errors do not block payment</span></span></div></div>
  <div class="seq-step"><div class="seq-step-content"><strong>Write audit record asynchronously</strong><span>Store full decision record with features snapshot, rules triggered, model version, and processing time. This data feeds model retraining and compliance reviews. <span class="seq-step-fail">Audit store down → buffer in outbox</span></span></div></div>
</div>

## Section 7: Deep dive

### Rules vs. ML comparison

<div class="compare-grid">
  <div class="compare-card">
    <h4>Rules Engine</h4>
    <ul>
      <li>Latency: under 1ms per rule</li>
      <li>Explainability: fully transparent</li>
      <li>Update speed: config change, no deploy</li>
      <li>Pattern detection: known patterns only</li>
      <li>Maintenance: manual rule curation</li>
      <li>Best for: compliance, policy enforcement</li>
    </ul>
  </div>
  <div class="compare-card">
    <h4>ML Model</h4>
    <ul>
      <li>Latency: 5-20ms per inference</li>
      <li>Explainability: partial (SHAP values)</li>
      <li>Update speed: retrain + deploy cycle</li>
      <li>Pattern detection: discovers new patterns</li>
      <li>Maintenance: data pipeline + monitoring</li>
      <li>Best for: complex, evolving fraud patterns</li>
    </ul>
  </div>
</div>

### Model versioning and safe rollout

1. Train new model on recent labeled data.
2. Evaluate offline against holdout set (precision, recall, F1).
3. Deploy as shadow model: both old and new models score every transaction, but only old model's decision is used.
4. Compare decisions for 24-48 hours. Check false positive rate and catch rate.
5. If new model is better, promote to primary with gradual traffic shift (10% → 50% → 100%).
6. Keep old model available for instant rollback.

### Multi-region

- Keep feature reads local where possible. Replicate hot features across regions.
- Deploy the same model version to all regions simultaneously.
- Respect data residency: customer behavioral data from EU stays in EU region.
- If a region has stale features, prefer a conservative decision for high-risk transactions.

## Section 8: Reliability, observability, security

**Key metrics to monitor**:

- Decision latency (P50, P99).
- Approval/review/decline distribution per merchant.
- False positive rate (legitimate transactions incorrectly declined).
- Model score distribution (sudden shifts indicate data drift).
- Feature freshness (age of velocity counters).
- Rule trigger frequency (detect broken or obsolete rules).

**Security**: fraud feature data contains sensitive behavioral signals. Access must be role-based, logged, and time-limited. Raw customer data should be masked in logs.

## Section 9: Tradeoffs and wrap

- **key decision**: rules plus model gives explainability and flexibility.
- **key decision**: parallel evaluation keeps latency low despite multiple checks.
- **tradeoff**: more components mean more operational work, but each component can scale independently.
- **tradeoff**: strict false-positive targets may let some fraud through. Tuning is ongoing.
- **risk**: stale features lead to incorrect velocity checks.
- **mitigation**: feature freshness monitoring with automatic conservative fallback.
- **risk**: model drift as fraud patterns change.
- **mitigation**: continuous offline evaluation, shadow scoring, and automated retraining pipeline.

## Beginner Deep Dive: Real-time Fraud Detection

<div class="system-flow-demo">
  <div class="system-flow-title">Fraud decision combines request data, history, rules, and model score</div>
  <div class="flow-lane">
    <div class="flow-node">Payment Request</div>
    <div class="flow-node">Feature Lookup</div>
    <div class="flow-node">Rules Engine</div>
    <div class="flow-node">Model Score</div>
    <div class="flow-node">Decision + Reason</div>
  </div>
  <div class="flow-packet"></div>
</div>

### Feature Lookup

A feature is a useful fact about the transaction. Examples: merchant risk level, customer country, device fingerprint history, number of failed payments in the last hour, and how this transaction amount compares to the customer's normal spending.

**Velocity features** are the most important for real-time fraud. They answer questions like: how many transactions has this card made in the last 10 minutes? Has this device been seen before? Is the IP address associated with previous fraud?

I choose a feature cache because fraud decisions must be fast. Reading every fact from slow databases during checkout would add 50-200ms of latency, which is unacceptable when the total fraud budget is 50ms.

**Two-tier feature store**:

- Hot tier (Redis): velocity counters, recent transaction lists, device trust scores. Updated in near-real-time as transactions flow through.
- Cold tier (precomputed): merchant category risk, historical chargeback rate, account age. Updated in batch every few hours.

### Rules Engine

A rule is a human-readable condition such as "decline if the card country and merchant country are different AND the amount exceeds 5,000 dollars AND the card has fewer than 3 previous transactions."

Rules are easier to explain than machine learning scores. When a compliance officer asks "why was this transaction blocked?", a rule answer like "velocity_exceeded: 15 transactions in 10 minutes from a new card" is much clearer than "model score 0.87."

I choose rules for clear policy enforcement and compliance review. The alternative is only using a model, which may be more flexible but harder to explain and harder to audit.

### Model Score

A model score estimates risk based on historical patterns the model learned from labeled fraud data. The model takes in the feature vector (all the facts about this transaction) and outputs a probability between 0 and 1.

Good models also return feature importance: "the top 3 reasons for this high score are: new device, unusual amount, and international transaction."

I choose model scoring after feature assembly because we should use the richest data available. I run the model in parallel with rules to keep total latency low.

### Decision and Reason Codes

The output should not be only allow or block. It should include a reason such as `velocity_exceeded`, `amount_unusual`, `country_mismatch`, `new_device`, or `manual_review_needed`.

Reason codes serve four purposes:

1. Support teams can explain declined transactions to merchants.
2. Compliance teams can audit decision logic.
3. Model engineers can analyze which patterns trigger most.
4. Merchants can reduce false positives by providing better data.

### Failure, Multi-region, and Safe Fallback

**risks**: stale features, model timeout, false positives blocking good customers, and false negatives letting fraud through.

**decisions**: use timeouts per component (rules: 5ms, model: 20ms, total: 50ms). If any component exceeds its timeout, proceed without it but log the degradation. For high-risk transactions with missing data, prefer review or decline.

**security**: fraud data may contain sensitive behavioral signals, so access must be limited, role-based, and audited.

For multi-region, feature reads should be local where possible. Model deployment should be versioned per region. If a region has stale data, the system should prefer a conservative decision for high-risk transactions.

## Follow-up Interview Questions With Answers

**Q: Why use both rules and machine learning?**  
A: Rules are explainable and good for known policy. Models are better at finding complex patterns humans cannot write rules for. Using both gives control (rules) and adaptability (model). Rules handle compliance requirements; models handle evolving attack patterns.

**Q: What happens if fraud service is slow?**  
A: The payment service uses a 50ms timeout for the fraud call. If the fraud service does not respond in time, the payment service applies a fallback policy: deny high-risk transactions (new merchant, large amount, international), approve low-risk traffic (established merchant, small amount, domestic). This fallback is configurable per merchant tier.

**Q: How do you avoid hurting good customers?**  
A: Track false positives aggressively. Monitor the ratio of declined transactions that were later confirmed as legitimate. Tune thresholds per merchant or region. Use "review" instead of "decline" when confidence is medium. Allow merchants to provide additional verification data to reduce false positives.

**Q: How do you retrain the model?**  
A: Fraud labels arrive with delay (chargebacks take 30-120 days). We use a pipeline that collects labeled outcomes, retrains weekly, evaluates against a holdout set, shadow-deploys the new model, compares performance for 48 hours, and promotes only if it improves precision without degrading recall.

**Q: What if a rule and the model disagree?**  
A: The strictest decision wins. A rule that says "decline" overrides a model that says "approve." This is safer for payments because a missed fraud case is more costly than a false decline. However, we track disagreement rates to identify rules that may be too aggressive.
