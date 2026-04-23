# LLD Interview Framework

## NEXT THING TO SAY

I will design this with clear objects, clear ownership, and simple Python classes. I will name the **invariants** early so the design is easy to test.

## 0) Two-Line Design Framing

- Say what the component must do.
- Say what correctness means.

## 1) Requirements and Constraints

Ask about operations, scale, concurrency, storage, and failure handling.

## 2) Objects and Responsibilities

Use entities, services, repositories, and policies only when they help.

## 3) Class/API Design

Show method names and inputs/outputs.

## 4) Core Workflow

Walk through one happy path and one failure path.

## 5) Invariants

An **invariant** is a rule that must always be true.

## 6) Edge Cases

Call out **edge cases** before coding.

## 7) Python Implementation Sketch

Use clear Python. No clever tricks.

## 8) Tests

Say what you would test.

## 9) Follow-up Interview Questions

Prepare for concurrency, persistence, and extensibility.

## 10) Tradeoffs and Wrap

Close with what is simple now and what you would improve later.

## Beginner Deep Dive: What LLD Really Tests

Low-level design tests whether you can break a feature into small objects that have clear jobs. It is not about making many classes. It is about making the rules easy to understand, easy to test, and hard to misuse.

<div class="class-demo">
  <div class="class-card"><strong>Entity</strong>Stores business data, like Payment or Merchant.</div>
  <div class="class-card"><strong>Service</strong>Owns workflow, like authorize payment or evaluate fraud.</div>
  <div class="class-card"><strong>Repository</strong>Hides storage details, like save record or find by id.</div>
  <div class="class-card"><strong>Policy</strong>Encapsulates a rule, like retry policy or rate limit policy.</div>
</div>

### The Simple LLD Mental Model

Start with what must always be true. These are **invariants**. Example: one idempotency key cannot map to two different request bodies.

Then identify the objects:

- Entity: the data that has identity.
- Service: the action or workflow.
- Repository: the storage boundary.
- Policy or strategy: a replaceable rule.
- Event writer: the audit or async boundary.

### Why This Helps in Interviews

Clear objects let you explain each responsibility without jumping around. If the interviewer asks about concurrency, storage, or testing, you know exactly which object changes.

### Interview Answer You Can Say

I will start with the core invariant, then design the smallest set of objects that protects that invariant. I will keep storage behind a repository, business flow inside a service, and rules inside policies so each piece is easy to test.
