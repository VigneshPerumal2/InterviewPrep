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
