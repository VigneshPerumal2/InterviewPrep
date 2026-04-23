# Fraud Rule Evaluator

## NEXT THING TO SAY

I will design the fraud rule evaluator using the strategy pattern so new rules can be added without changing the evaluator. Each rule implements the same interface. The evaluator runs all rules, collects decisions, and the strictest decision wins.

## 0) Two-Line Design Framing

- We need to evaluate a transaction against multiple fraud rules and return a decision with reason codes.
- Correctness means every active rule is evaluated, the strictest decision wins, and reason codes explain every non-approve decision.

## 1) Requirements and Constraints

- Support multiple rule types: velocity, amount threshold, geographic, device trust, BIN blocklist.
- Rules can be added, removed, or reordered without code deployment.
- Each rule returns approve, review, or decline with a reason code.
- Final decision is the strictest across all rules (decline > review > approve).
- Evaluation latency under 5 milliseconds for all rules combined.
- Rules have priority ordering for short-circuit optimization.

## 2) Objects and Responsibilities

| Object | Responsibility |
|---|---|
| `FraudRule` | Interface: evaluate a transaction and return a decision |
| `VelocityRule` | Check transaction frequency (e.g., >10 in 1 hour) |
| `AmountRule` | Check if amount exceeds threshold for merchant category |
| `GeoRule` | Check if card country mismatches merchant country |
| `DeviceRule` | Check device fingerprint trust score |
| `BINBlocklistRule` | Check if card BIN is on blocklist |
| `FraudEvaluator` | Runs all active rules and combines decisions |
| `RuleConfig` | Stores rule parameters and active/inactive state |
| `TransactionContext` | All data needed for evaluation |

## 3) Class/API Design

```text
FraudRule.evaluate(context: TransactionContext) -> RuleResult
FraudEvaluator.evaluate(context: TransactionContext) -> FraudDecision
RuleConfig.get_active_rules() -> list[FraudRule]
```

## 4) Core Workflow

1. Payment service calls FraudEvaluator.evaluate() with transaction context.
2. Evaluator loads active rules from config, sorted by priority.
3. Each rule evaluates the context and returns a decision.
4. Optional optimization: if any rule returns decline, short-circuit remaining rules.
5. Evaluator combines all results: strictest decision wins.
6. Return decision with all triggered reason codes.

## 5) Invariants

- **invariant**: every active rule is evaluated (unless short-circuited after a decline).
- **invariant**: the final decision is never less strict than any individual rule's decision.
- **invariant**: every non-approve decision includes at least one reason code.
- **invariant**: rule evaluation order does not change the final decision (deterministic combining).

## 6) Edge Cases

- **edge case**: no active rules → default to approve (but log a warning).
- **edge case**: rule throws an exception → skip that rule, log error, do not block the transaction.
- **edge case**: all data for a rule is missing → rule returns "approve with warning" rather than blocking.
- **edge case**: two rules return conflicting decisions → strictest wins (decline > review > approve).
- **edge case**: rule config update while evaluation is in progress → use snapshot of config at evaluation start.

## 7) Python Implementation Sketch

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any


class Decision(IntEnum):
    """Ordered so comparisons give the strictest decision."""
    APPROVE = 0
    REVIEW = 1
    DECLINE = 2


@dataclass
class TransactionContext:
    """All data needed for fraud evaluation."""
    transaction_id: str = ""
    merchant_id: str = ""
    amount: int = 0
    currency: str = ""
    card_country: str = ""
    merchant_country: str = ""
    device_fingerprint: str = ""
    card_bin: str = ""
    transactions_last_hour: int = 0
    is_new_device: bool = False


@dataclass
class RuleResult:
    """Result from a single rule evaluation."""
    decision: Decision = Decision.APPROVE
    reason_code: str = ""
    rule_name: str = ""
    details: dict = field(default_factory=dict)


@dataclass
class FraudDecision:
    """Combined decision from all rules."""
    decision: Decision = Decision.APPROVE
    reason_codes: list = field(default_factory=list)
    rule_results: list = field(default_factory=list)


class FraudRule(ABC):
    """Base class for all fraud rules."""

    @abstractmethod
    def evaluate(self, context: TransactionContext) -> RuleResult:
        pass


class VelocityRule(FraudRule):
    """Check transaction frequency over time."""

    def __init__(self, max_per_hour=10):
        self.max_per_hour = max_per_hour

    def evaluate(self, context):
        if context.transactions_last_hour > self.max_per_hour:
            return RuleResult(
                decision=Decision.DECLINE,
                reason_code="velocity_exceeded",
                rule_name="VelocityRule",
                details={"count": context.transactions_last_hour,
                         "limit": self.max_per_hour}
            )
        if context.transactions_last_hour > self.max_per_hour * 0.8:
            return RuleResult(
                decision=Decision.REVIEW,
                reason_code="velocity_approaching_limit",
                rule_name="VelocityRule"
            )
        return RuleResult(
            decision=Decision.APPROVE,
            rule_name="VelocityRule"
        )


class AmountRule(FraudRule):
    """Check if amount exceeds a threshold."""

    def __init__(self, max_amount_cents=500000):
        self.max_amount_cents = max_amount_cents

    def evaluate(self, context):
        if context.amount > self.max_amount_cents:
            return RuleResult(
                decision=Decision.REVIEW,
                reason_code="high_amount",
                rule_name="AmountRule",
                details={"amount": context.amount,
                         "threshold": self.max_amount_cents}
            )
        return RuleResult(
            decision=Decision.APPROVE,
            rule_name="AmountRule"
        )


class GeoRule(FraudRule):
    """Check if card country mismatches merchant country."""

    def evaluate(self, context):
        if (context.card_country and context.merchant_country and
                context.card_country != context.merchant_country):
            return RuleResult(
                decision=Decision.REVIEW,
                reason_code="country_mismatch",
                rule_name="GeoRule",
                details={"card": context.card_country,
                         "merchant": context.merchant_country}
            )
        return RuleResult(
            decision=Decision.APPROVE,
            rule_name="GeoRule"
        )


class BINBlocklistRule(FraudRule):
    """Check if card BIN is on a blocklist."""

    def __init__(self, blocklist=None):
        self.blocklist = set(blocklist or [])

    def evaluate(self, context):
        if context.card_bin in self.blocklist:
            return RuleResult(
                decision=Decision.DECLINE,
                reason_code="blocked_bin",
                rule_name="BINBlocklistRule"
            )
        return RuleResult(
            decision=Decision.APPROVE,
            rule_name="BINBlocklistRule"
        )


class FraudEvaluator:
    """Runs all active rules and combines their decisions."""

    def __init__(self, rules=None, short_circuit_on_decline=True):
        self.rules = rules or []
        self.short_circuit = short_circuit_on_decline

    def evaluate(self, context):
        """Evaluate all rules. Strictest decision wins."""
        results = []
        strictest = Decision.APPROVE

        for rule in self.rules:
            try:
                result = rule.evaluate(context)
                results.append(result)

                if result.decision > strictest:
                    strictest = result.decision

                # Short-circuit: no need to run more rules after decline.
                if self.short_circuit and strictest == Decision.DECLINE:
                    break
            except Exception:
                # Skip broken rules. Never block a transaction
                # because of a rule implementation error.
                results.append(RuleResult(
                    decision=Decision.APPROVE,
                    reason_code="rule_error",
                    rule_name=type(rule).__name__
                ))

        # Collect reason codes from non-approve results.
        reason_codes = [
            r.reason_code for r in results
            if r.decision != Decision.APPROVE and r.reason_code
        ]

        return FraudDecision(
            decision=strictest,
            reason_codes=reason_codes,
            rule_results=results
        )
```

## 8) Tests

- **Happy path**: All rules approve → final decision is approve.
- **Single decline**: One rule declines → final decision is decline with reason code.
- **Review**: One rule reviews, others approve → final decision is review.
- **Short circuit**: After first decline, remaining rules are not called.
- **Rule error**: Broken rule does not block the transaction.
- **Empty rules**: No active rules → approve (with warning log).
- **Reason codes**: Every non-approve decision has reason codes in the final result.
- **Priority**: Rules run in configured order.

## 9) Follow-up Interview Questions

**Q: How do you add a new rule?**  
A: Create a new class that implements FraudRule.evaluate(). Add it to the rule configuration. No changes to FraudEvaluator needed. This is the Open/Closed principle in action.

**Q: How do you A/B test rules?**  
A: Run the new rule in shadow mode: evaluate it for every transaction but do not include its decision in the final result. Log the shadow decision. Compare shadow decisions against actual fraud outcomes to measure precision and recall before activating.

**Q: What about rule versioning?**  
A: Store rule parameters in configuration (database or config file). Each parameter change creates a new version. Log which rule version was active for each decision. This enables auditing which version of which rule contributed to a specific decision.

## 10) Tradeoffs and Wrap

Strategy pattern makes rules easy to add and test independently. The tradeoff is that rule interactions can be hard to reason about (e.g., two rules that individually approve but together should review). For production, I would add: rule configuration from a database, shadow mode for new rules, performance monitoring per rule, and a rule management UI.

## Beginner Deep Dive: Fraud Rule Evaluator

<div class="class-demo">
  <div class="class-card"><strong>FraudRule (interface)</strong>Every rule implements evaluate(context) → decision. This makes all rules interchangeable.</div>
  <div class="class-card"><strong>VelocityRule / AmountRule / GeoRule</strong>Concrete rules with specific logic. Each returns approve, review, or decline with a reason code.</div>
  <div class="class-card"><strong>FraudEvaluator</strong>Runs all rules, collects results, returns the strictest decision. New rules can be added without changing this class.</div>
</div>

### What The Design Is Protecting

The main **invariant** is that every transaction is evaluated against all active fraud rules, and the final decision is never less strict than any individual rule. This prevents fraud from slipping through because one rule was accidentally skipped.

### Why Strategy Pattern

Without the strategy pattern, adding a new rule means modifying the evaluator function. With the strategy pattern, adding a new rule means creating a new class. The evaluator does not change. This is safer because existing rule logic is not accidentally broken when adding new rules.

### Decision Combining Explained

Using an IntEnum where APPROVE=0, REVIEW=1, DECLINE=2 makes combining simple: the maximum value is the strictest decision. If any rule says DECLINE (2), the max is 2 = DECLINE. This is mathematically correct and easy to test.

### Failure and Safe Defaults

If a rule throws an exception, the evaluator catches it and continues with the remaining rules. This is important because a bug in one rule should not block all transactions. The error is logged for investigation, and the broken rule's result is treated as APPROVE so it does not cause false declines.
