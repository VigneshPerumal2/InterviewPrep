# LLD Interview Framework

## NEXT THING TO SAY

I will design this with clear objects, clear ownership, and simple Python classes. I will name the **invariants** early so the design is easy to test and hard to misuse.

## 0) Two-Line Design Framing

- Say what the component must do in one sentence.
- Say what correctness means: what must always be true.

**Example**: "We need to store and replay idempotency keys for payment retries. Correctness means the same key with the same request always returns the same response, and the same key with a different request is always rejected."

## 1) Requirements and Constraints

Ask about operations, scale, concurrency, storage, and failure handling.

**Concrete questions to ask the interviewer**:

- How many operations per second?
- Does this need to survive process restarts (persistent storage)?
- Are there concurrent callers (thread safety)?
- What happens on failure — reject, retry, or degrade?
- What are the latency requirements?

## 2) Objects and Responsibilities

Use entities, services, repositories, and policies only when they help. Do not create objects without clear justification.

**SOLID principles mapped to payment domain**:

| Principle | Payment Example |
|---|---|
| Single Responsibility | PaymentValidator only validates, never stores |
| Open/Closed | Add new fraud rules without changing FraudEvaluator |
| Liskov Substitution | InMemoryRepo and PostgresRepo are interchangeable |
| Interface Segregation | FraudClient only exposes evaluate(), not internal model details |
| Dependency Inversion | AuthorizationService depends on Repository interface, not PostgreSQL directly |

## 3) Class/API Design

Show method names, inputs, outputs, and return types. Keep method signatures minimal and focused.

**How to present in an interview**: Write the class name and 2-3 key methods on the whiteboard. Explain what each method does before writing the implementation.

## 4) Core Workflow

Walk through one happy path and one failure path. Show how objects collaborate.

**Template**: "Request enters at Service.method(). Service calls Validator, then Repository, then Policy. If Policy says no, Service returns an error. If everything succeeds, Service writes the result and returns."

## 5) Invariants

An **invariant** is a rule that must always be true, no matter what sequence of operations occurs.

**Payment domain invariants**:

- One idempotency key maps to exactly one request body.
- A payment state machine only allows valid transitions.
- Tokens in a rate limiter bucket never exceed capacity and never go below zero.
- Audit events are append-only and immutable.
- A retry processor never exceeds max attempts.

**Why invariants matter in interviews**: Naming invariants early shows the interviewer you understand what the system must protect. It gives you a framework to evaluate edge cases: "does this scenario violate any of our invariants?"

## 6) Edge Cases

Call out **edge cases** before coding. This shows the interviewer you think defensively.

**Common edge case categories**:

- **Empty input**: no data, zero amount, empty string.
- **Boundary values**: exactly at capacity, exactly at max retries.
- **Concurrent access**: two identical requests arrive simultaneously.
- **Failure during write**: crash between checking and storing.
- **Stale data**: cache returns old value while database has new value.

## 7) Python Implementation Sketch

Use clear Python. No clever tricks. Comment every non-obvious decision.

**Interview code rules**:

- Use descriptive variable names (not x, y, z).
- Handle the most important error case explicitly.
- Keep methods under 15 lines.
- Use type hints if comfortable.
- Show the core logic, not boilerplate.

## 8) Tests

Say what you would test. Organize by: happy path, error path, edge cases, invariant violations.

**Template**: "I would test four things: (1) the happy path works, (2) invalid input is rejected with a clear error, (3) the invariant holds under concurrent access, (4) failure recovery behaves correctly."

## 9) Follow-up Interview Questions

Prepare for concurrency, persistence, and extensibility.

**Common follow-up themes**:

- "What if this needs to handle 10x the load?" → Discuss sharding, caching, or distributed versions.
- "What if we need to add a new rule/policy?" → Show how strategy pattern allows extension.
- "How would you test this in production?" → Discuss observability, canary deploys, feature flags.
- "What if the database is down?" → Discuss graceful degradation, circuit breaker, fallback.

## 10) Tradeoffs and Wrap

Close with what is simple now and what you would improve later.

**Format**: "The current design is correct and testable. For production, I would add: (1) persistent storage instead of in-memory, (2) thread safety with locking or atomic operations, (3) metrics and logging for observability, (4) TTL-based cleanup for storage management."

## Beginner Deep Dive: What LLD Really Tests

Low-level design tests whether you can break a feature into small objects that have clear jobs. It is not about making many classes. It is about making the rules easy to understand, easy to test, and hard to misuse.

<div class="class-demo">
  <div class="class-card"><strong>Entity</strong>Stores business data, like Payment or Merchant. Has identity (an ID). Contains no business logic beyond validation of its own fields.</div>
  <div class="class-card"><strong>Service</strong>Owns workflow and orchestration, like authorize payment or evaluate fraud. Coordinates between other objects. Contains the "what happens when" logic.</div>
  <div class="class-card"><strong>Repository</strong>Hides storage details, like save record or find by id. Can be swapped between in-memory (testing) and database (production) without changing the service.</div>
  <div class="class-card"><strong>Policy</strong>Encapsulates a replaceable rule, like retry policy, rate limit policy, or fraud rule. New policies can be added without changing the service that uses them.</div>
</div>

### The Simple LLD Mental Model

Start with what must always be true. These are **invariants**. Example: one idempotency key cannot map to two different request bodies.

Then identify the objects:

- Entity: the data that has identity (Payment, Merchant, AuditEvent).
- Service: the action or workflow (AuthorizationService, FraudEvaluator).
- Repository: the storage boundary (PaymentRepository, AuditRepository).
- Policy or strategy: a replaceable rule (RetryPolicy, RateLimitPolicy, FraudRule).
- Event writer: the audit or async boundary (AuditWriter, EventPublisher).

### How to Draw Class Diagrams in Interviews

You do not need UML perfection. Use this simple format:

```text
┌─────────────────────┐
│ AuthorizationService │
├─────────────────────┤
│ + authorize(request) │
│ - validate(request)  │
├─────────────────────┤
│ depends on:          │
│   Validator          │
│   FraudClient        │
│   ProcessorClient    │
│   Repository         │
│   AuditWriter        │
└─────────────────────┘
```

Show the class name, public methods, and dependencies. Draw arrows to show which objects the service depends on. This is enough for an interview.

### Object Relationship Flow

<div class="system-flow-demo">
  <div class="system-flow-title">How LLD objects collaborate: Service orchestrates, Repository stores, Policy decides</div>
  <div class="flow-lane">
    <div class="flow-node">Request In</div>
    <div class="flow-node">Service</div>
    <div class="flow-node">Policy Check</div>
    <div class="flow-node">Repository Write</div>
    <div class="flow-node">Response Out</div>
  </div>
  <div class="flow-packet"></div>
</div>

### Why This Helps in Interviews

Clear objects let you explain each responsibility without jumping around. If the interviewer asks about concurrency, you know which object changes (Repository adds locking). If they ask about testing, you know which objects to mock (FraudClient, ProcessorClient). If they ask about extensibility, you know which objects to extend (add a new FraudRule).

### Interview Scoring: What Separates Levels

<div class="compare-grid">
  <div class="compare-card">
    <h4>Mid-Level Answer</h4>
    <ul>
      <li>Correct implementation that works</li>
      <li>Names some edge cases</li>
      <li>Basic class structure</li>
      <li>Tests the happy path</li>
    </ul>
  </div>
  <div class="compare-card">
    <h4>Senior Answer</h4>
    <ul>
      <li>Names invariants before coding</li>
      <li>Clear separation of concerns</li>
      <li>Handles concurrency explicitly</li>
      <li>Tests invariant violations</li>
      <li>Discusses production considerations</li>
    </ul>
  </div>
  <div class="compare-card">
    <h4>Staff Answer</h4>
    <ul>
      <li>Connects design to system-level impact</li>
      <li>Shows how objects map to team ownership</li>
      <li>Discusses operational cost of the design</li>
      <li>Proposes phased implementation</li>
      <li>Identifies the hardest correctness problem</li>
    </ul>
  </div>
</div>

### Interview Answer You Can Say

I will start with the core invariant, then design the smallest set of objects that protects that invariant. I will keep storage behind a repository, business flow inside a service, and rules inside policies so each piece is easy to test and easy to replace.
