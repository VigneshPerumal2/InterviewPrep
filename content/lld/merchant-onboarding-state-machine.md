# Merchant Onboarding State Machine

## NEXT THING TO SAY

I will design the state machine with a centralized transition table so every valid transition is explicit and testable. Invalid transitions are rejected with a clear error. Every transition records who triggered it and when.

## 0) Two-Line Design Framing

- We need a state machine that controls merchant onboarding workflow from draft to active.
- Correctness means only valid transitions are allowed, every transition is audited, and the merchant cannot process payments until fully activated.

## 1) Requirements and Constraints

- States: DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, ACTIVE, SUSPENDED.
- Only valid transitions are allowed (no DRAFT → ACTIVE).
- Each transition has guard conditions (e.g., "can only approve if all documents are verified").
- Side effects on transition: send notifications, publish events, update configuration.
- Full transition history for audit and compliance.

## 2) Objects and Responsibilities

| Object | Responsibility |
|---|---|
| `MerchantState` | Enum of all valid states |
| `StateMachine` | Validates and executes transitions |
| `TransitionRule` | Defines a valid transition with guard and side effects |
| `TransitionHistory` | Stores audit trail of all transitions |
| `GuardCondition` | Checks if a transition is allowed (e.g., all docs verified) |
| `SideEffect` | Actions triggered by a transition (notify, publish) |

## 3) Class/API Design

```text
StateMachine.transition(merchant_id, target_state, actor, reason) -> MerchantState
StateMachine.can_transition(current_state, target_state) -> bool
TransitionHistory.record(merchant_id, from_state, to_state, actor, reason) -> None
TransitionHistory.get_history(merchant_id) -> list[TransitionRecord]
```

## 4) Core Workflow

1. Caller requests a transition (e.g., SUBMITTED → UNDER_REVIEW).
2. StateMachine looks up valid transitions from current state.
3. If target state is not in valid transitions, reject with InvalidTransitionError.
4. Run guard conditions for the transition (e.g., all documents uploaded).
5. If guards pass, update state and execute side effects (notify, publish event).
6. Record transition in history with actor and timestamp.

## 5) Invariants

- **invariant**: only transitions defined in the transition table are allowed.
- **invariant**: every transition is recorded in the history with actor and timestamp.
- **invariant**: guard conditions are checked before every transition.
- **invariant**: a merchant cannot reach ACTIVE without passing through APPROVED.

## 6) Edge Cases

- **edge case**: transition to current state → reject (no self-transitions).
- **edge case**: guard fails → transition rejected, state unchanged.
- **edge case**: side effect fails → transition should still complete (side effects are non-blocking).
- **edge case**: concurrent transitions → database lock prevents inconsistent state.
- **edge case**: REJECTED → DRAFT (resubmission) → guard requires rejection reason addressed.

## 7) Python Implementation Sketch

```python
from enum import Enum
from dataclasses import dataclass, field
import time


class MerchantState(Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ACTIVE = "active"
    SUSPENDED = "suspended"


@dataclass
class TransitionRecord:
    merchant_id: str
    from_state: MerchantState
    to_state: MerchantState
    actor: str
    reason: str
    timestamp: float = field(default_factory=time.time)


class InvalidTransitionError(Exception):
    """Raised when a transition is not allowed."""
    pass


class GuardFailedError(Exception):
    """Raised when a guard condition is not met."""
    pass


class StateMachine:
    """Centralized state machine with transition table, guards, and side effects.

    The transition table is the single source of truth for all
    valid state changes. Adding a new transition means adding
    one entry to this table.
    """

    def __init__(self):
        self._states = {}  # merchant_id -> MerchantState
        self._history = []

        # Transition table: (from, to) -> (guards, side_effects)
        self._transitions = {
            (MerchantState.DRAFT, MerchantState.SUBMITTED): {
                "guards": [self._guard_all_fields_present],
                "side_effects": [self._notify_review_team]
            },
            (MerchantState.SUBMITTED, MerchantState.UNDER_REVIEW): {
                "guards": [self._guard_compliance_checks_started],
                "side_effects": [self._notify_merchant_review_started]
            },
            (MerchantState.UNDER_REVIEW, MerchantState.APPROVED): {
                "guards": [self._guard_all_docs_verified,
                           self._guard_compliance_passed],
                "side_effects": [self._notify_merchant_approved,
                                 self._publish_approval_event]
            },
            (MerchantState.UNDER_REVIEW, MerchantState.REJECTED): {
                "guards": [],
                "side_effects": [self._notify_merchant_rejected]
            },
            (MerchantState.APPROVED, MerchantState.ACTIVE): {
                "guards": [self._guard_config_published],
                "side_effects": [self._publish_activation_event]
            },
            (MerchantState.REJECTED, MerchantState.DRAFT): {
                "guards": [],
                "side_effects": [self._notify_merchant_resubmit]
            },
            (MerchantState.ACTIVE, MerchantState.SUSPENDED): {
                "guards": [],
                "side_effects": [self._notify_merchant_suspended,
                                 self._disable_payment_processing]
            },
            (MerchantState.SUSPENDED, MerchantState.ACTIVE): {
                "guards": [self._guard_suspension_resolved],
                "side_effects": [self._enable_payment_processing]
            },
        }

    def get_state(self, merchant_id):
        """Get current state. Default is DRAFT for new merchants."""
        return self._states.get(merchant_id, MerchantState.DRAFT)

    def can_transition(self, merchant_id, target_state):
        """Check if a transition is valid without executing it."""
        current = self.get_state(merchant_id)
        return (current, target_state) in self._transitions

    def get_valid_transitions(self, merchant_id):
        """List all valid target states from current state."""
        current = self.get_state(merchant_id)
        return [
            to_state for (from_state, to_state) in self._transitions
            if from_state == current
        ]

    def transition(self, merchant_id, target_state, actor, reason=""):
        """Execute a state transition with guards and side effects.

        Raises InvalidTransitionError if transition is not in the table.
        Raises GuardFailedError if any guard condition fails.
        """
        current = self.get_state(merchant_id)

        # Check if transition is defined.
        transition_key = (current, target_state)
        if transition_key not in self._transitions:
            valid = self.get_valid_transitions(merchant_id)
            raise InvalidTransitionError(
                f"Cannot transition from {current.value} to "
                f"{target_state.value}. Valid targets: "
                f"{[s.value for s in valid]}"
            )

        config = self._transitions[transition_key]

        # Run guard conditions.
        for guard in config["guards"]:
            result = guard(merchant_id)
            if not result:
                raise GuardFailedError(
                    f"Guard {guard.__name__} failed for "
                    f"{merchant_id}"
                )

        # Execute transition.
        self._states[merchant_id] = target_state

        # Record in history.
        record = TransitionRecord(
            merchant_id=merchant_id,
            from_state=current,
            to_state=target_state,
            actor=actor,
            reason=reason
        )
        self._history.append(record)

        # Run side effects (non-blocking).
        for effect in config["side_effects"]:
            try:
                effect(merchant_id, record)
            except Exception:
                # Side effect failure should not prevent transition.
                pass

        return target_state

    def get_history(self, merchant_id):
        """Get full transition history for a merchant."""
        return [
            r for r in self._history
            if r.merchant_id == merchant_id
        ]

    # Guard conditions
    def _guard_all_fields_present(self, merchant_id):
        """Check that all required fields are filled."""
        return True  # Implementation checks merchant record

    def _guard_compliance_checks_started(self, merchant_id):
        """Check that compliance checks have been initiated."""
        return True

    def _guard_all_docs_verified(self, merchant_id):
        """Check that all required documents are verified."""
        return True

    def _guard_compliance_passed(self, merchant_id):
        """Check that compliance/sanctions screening passed."""
        return True

    def _guard_config_published(self, merchant_id):
        """Check that config has been published to all systems."""
        return True

    def _guard_suspension_resolved(self, merchant_id):
        """Check that the suspension reason has been resolved."""
        return True

    # Side effects
    def _notify_review_team(self, merchant_id, record):
        pass  # Send notification to review team

    def _notify_merchant_review_started(self, merchant_id, record):
        pass  # Email merchant: review has started

    def _notify_merchant_approved(self, merchant_id, record):
        pass  # Email merchant: approved

    def _publish_approval_event(self, merchant_id, record):
        pass  # Publish to event stream

    def _notify_merchant_rejected(self, merchant_id, record):
        pass  # Email merchant: rejected with reasons

    def _notify_merchant_resubmit(self, merchant_id, record):
        pass  # Email merchant: please resubmit

    def _publish_activation_event(self, merchant_id, record):
        pass  # Publish activation to all downstream systems

    def _notify_merchant_suspended(self, merchant_id, record):
        pass  # Email merchant: suspended

    def _disable_payment_processing(self, merchant_id, record):
        pass  # Update payment gateway config

    def _enable_payment_processing(self, merchant_id, record):
        pass  # Re-enable payment processing
```

## 8) Tests

- **Valid transition**: DRAFT → SUBMITTED succeeds with all fields present.
- **Invalid transition**: DRAFT → ACTIVE raises InvalidTransitionError.
- **Guard failure**: UNDER_REVIEW → APPROVED fails if docs not verified.
- **History**: Every transition is recorded with actor and timestamp.
- **Side effects**: Notification is sent on APPROVED transition.
- **Side effect failure**: Side effect error does not prevent transition.
- **Valid targets**: get_valid_transitions returns correct options for each state.
- **Suspension**: ACTIVE → SUSPENDED disables payment processing.
- **Resubmission**: REJECTED → DRAFT allows merchant to fix and resubmit.

## 9) Follow-up Interview Questions

**Q: How do you handle concurrent transitions?**  
A: In a database-backed implementation, use optimistic locking: include a version column, read current version, attempt update WHERE version = read_version. If another transaction updated first, the version check fails and the transition is retried.

**Q: What if a side effect is critical?**  
A: If a side effect must succeed (like publishing activation config), make it a guard condition instead. The transition only completes if the guard passes. For example: _guard_config_published checks that the activation event was successfully published before transitioning to ACTIVE.

**Q: How do you add a new state?**  
A: Add the new value to the MerchantState enum. Add transition rules to the transition table. Existing code does not change because the transition table is the single source of truth.

## 10) Tradeoffs and Wrap

The centralized transition table makes all valid transitions explicit and testable. The tradeoff is that the table grows with the number of states and transitions. For production, I would add: database-backed state persistence, optimistic locking for concurrent transitions, transition event publishing, and a UI for reviewing and managing the transition table.

## Beginner Deep Dive: Merchant Onboarding State Machine

<div class="class-demo">
  <div class="class-card"><strong>MerchantState (enum)</strong>Lists all valid states. Using an enum prevents typos and makes valid states explicit.</div>
  <div class="class-card"><strong>StateMachine</strong>Owns the transition table. Every valid state change is defined here with guards and side effects.</div>
  <div class="class-card"><strong>TransitionHistory</strong>Immutable audit trail of every state change: who, what, when, and why.</div>
</div>

### What The Design Is Protecting

The main **invariant** is that only transitions in the table are allowed. This prevents dangerous shortcuts like approving a merchant without compliance checks.

### Why a Centralized Transition Table

Without a table, transition logic is scattered across multiple functions and services. A reviewer might be able to approve a merchant by calling the approve endpoint directly, bypassing compliance checks. The centralized table ensures every transition goes through the same validation.

### Guards vs. Side Effects

Guards must pass before the transition happens. If a guard fails, the state does not change. Side effects happen after the transition. If a side effect fails (e.g., email not sent), the state still changes but the failed effect is logged for retry.

This distinction is important: notifications can fail gracefully, but compliance checks cannot.

### Failure and Safe Defaults

If a merchant's state is unknown, the safe default is to treat them as not activated. The payment gateway should only process transactions for merchants in ACTIVE state. Any other state (including unknown) means no payment processing.
