# Merchant Onboarding State Machine

## NEXT THING TO SAY

I will model merchant onboarding as explicit states and allowed transitions so invalid progress is rejected and audit is easy.

## 0) Two-Line Design Framing

- We need to move merchants through onboarding states.
- Correctness means only allowed transitions can happen.

## 1) Requirements and Constraints

- Support draft, submitted, under review, approved, rejected, active.
- Reject invalid transitions.
- Record who changed state.

## 2) Objects and Responsibilities

`StateMachine` owns transitions. `MerchantApplication` stores state. `AuditWriter` records changes.

## 3) Class/API Design

```text
StateMachine.transition(application, new_state, actor)
StateMachine.can_transition(from_state, to_state)
```

## 4) Core Workflow

Check transition, update state, record audit.

## 5) Invariants

- **invariant**: active requires approved first.
- **invariant**: every transition creates audit.

## 6) Edge Cases

- **edge cases**: approve draft directly.
- **edge cases**: activate rejected merchant.
- **edge cases**: duplicate transition.

## 7) Python Implementation Sketch

```python
# Define the state machine.
class StateMachine:

    # Define the constructor.
    def __init__(self):

        # Store allowed transitions.
        self.allowed = {
            "draft": {"submitted"},
            "submitted": {"under_review"},
            "under_review": {"approved", "rejected"},
            "approved": {"active"},
            "rejected": {"draft"},
            "active": set(),
        }

    # Define the transition check.
    def can_transition(self, from_state, to_state):

        # Return whether transition is allowed.
        return to_state in self.allowed.get(from_state, set())

    # Define the transition method.
    def transition(self, application, to_state):

        # Check allowed transition.
        if not self.can_transition(application["state"], to_state):

            # Raise an error for invalid transition.
            raise ValueError("invalid transition")

        # Update the application state.
        application["state"] = to_state

        # Return the application.
        return application
```

## 8) Tests

- Draft to submitted works.
- Draft to approved fails.
- Approved to active works.
- Active to rejected fails.

## 9) Follow-up Interview Questions

**Q: Where does audit fit?**  
A: Write an audit event after every successful transition.

## 10) Tradeoffs and Wrap

Explicit transitions are simple and testable. The tradeoff is maintaining the transition table as workflow grows.

## Beginner Deep Dive: Merchant Onboarding State Machine

<div class="class-demo">
  <div class="class-card"><strong>MerchantApplication</strong>Stores current state and merchant data.</div>
  <div class="class-card"><strong>TransitionPolicy</strong>Defines allowed state moves.</div>
  <div class="class-card"><strong>OnboardingService</strong>Applies transitions and writes audit events.</div>
  <div class="class-card"><strong>AuditEvent</strong>Records who changed what and why.</div>
</div>

### What The Design Is Protecting

The main **invariant** is that a merchant can only move through valid states.

For example, draft can move to submitted, submitted can move to under_review, and approved can move to active. Draft should not jump directly to active.

### Step-by-step Explanation

`MerchantApplication` stores the current state and core merchant details.

`TransitionPolicy` owns the allowed transition table. This keeps rules in one place.

`OnboardingService` checks the policy, changes the state, and writes an audit event.

`AuditEvent` is important because onboarding affects financial access. Reviewers and compliance teams need to know who approved the merchant.

### Failure and Safe Defaults

If the transition is not allowed, reject it.

If audit cannot be recorded, do not silently activate the merchant. Use an outbox or fail the transition based on compliance requirements.

If merchant state is unknown, payments should treat the merchant as inactive.

### Follow-up Interview Questions With Answers

**Q: Why not use simple if statements everywhere?**  
A: A central transition table is easier to review and prevents inconsistent rules across the codebase.

**Q: How do you add a new state?**  
A: Add it to the transition policy, update tests, and update any workflow screens that depend on states.

**Q: What is the key tradeoff?**  
A: A state machine adds structure, but it prevents dangerous invalid transitions.
