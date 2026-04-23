# Fraud Rule Evaluator

## NEXT THING TO SAY

I will design fraud rules as separate strategy objects so new rules can be added without rewriting the evaluator.

## 0) Two-Line Design Framing

- We need to evaluate a transaction against multiple fraud rules.
- Correctness means the final decision includes action and reason codes.

## 1) Requirements and Constraints

- Support multiple rules.
- Return approve, review, or decline.
- Include reason codes.
- Allow new rules later.

## 2) Objects and Responsibilities

`FraudRule` evaluates one rule. `FraudRuleEvaluator` combines rule results. `FraudDecision` stores final output.

## 3) Class/API Design

```text
FraudRule.evaluate(transaction)
FraudRuleEvaluator.evaluate(transaction)
```

## 4) Core Workflow

Run each rule, collect results, choose strictest action, and return reasons.

## 5) Invariants

- **invariant**: every decline includes at least one reason.
- **invariant**: stricter rules override weaker rules.

## 6) Edge Cases

- **edge cases**: no rules configured.
- **edge cases**: one rule fails.
- **edge cases**: conflicting rule decisions.

## 7) Python Implementation Sketch

```python
# Define an amount rule.
class AmountRule:

    # Define the evaluate method.
    def evaluate(self, transaction):

        # Check whether amount is too high.
        if transaction["amount"] > 10000:

            # Return a decline decision.
            return {"action": "decline", "reason": "amount_too_high"}

        # Return an approve decision.
        return {"action": "approve", "reason": "amount_ok"}

# Define the evaluator.
class FraudRuleEvaluator:

    # Define the constructor.
    def __init__(self, rules):

        # Store the rules.
        self.rules = rules

    # Define the evaluate method.
    def evaluate(self, transaction):

        # Store reasons.
        reasons = []

        # Store the final action.
        final_action = "approve"

        # Run every rule.
        for rule in self.rules:

            # Evaluate the rule.
            result = rule.evaluate(transaction)

            # Store the reason.
            reasons.append(result["reason"])

            # Check for decline.
            if result["action"] == "decline":

                # Store the stricter action.
                final_action = "decline"

        # Return the final decision.
        return {"action": final_action, "reasons": reasons}
```

## 8) Tests

- Low amount approves.
- High amount declines.
- Multiple reasons are returned.
- No rules returns approve or configured safe default.

## 9) Follow-up Interview Questions

**Q: How do you add a new rule?**  
A: Create another rule object with the same `evaluate` method.

## 10) Tradeoffs and Wrap

Strategy objects are easy to extend. The tradeoff is that rule ordering and conflict resolution must be explicit.
