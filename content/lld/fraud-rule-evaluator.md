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

## Beginner Deep Dive: Fraud Rule Evaluator

<div class="class-demo">
  <div class="class-card"><strong>FraudRule</strong>One condition that can allow, deny, or review.</div>
  <div class="class-card"><strong>RuleContext</strong>Input facts about transaction, merchant, and customer.</div>
  <div class="class-card"><strong>RuleEvaluator</strong>Runs rules and merges decisions.</div>
  <div class="class-card"><strong>Decision</strong>Final result plus reason codes.</div>
</div>

### What The Design Is Protecting

The main **invariant** is that the evaluator must return one final decision with explainable reasons.

This matters because fraud systems need to explain why a payment was blocked or reviewed.

### Step-by-step Explanation

`RuleContext` contains the data rules need. Examples: amount, country, merchant category, recent transaction count, and account age.

`FraudRule` is an interface or base class. Each concrete rule checks one thing.

`RuleEvaluator` loops through active rules, collects results, and applies priority. A deny decision usually beats review, and review usually beats allow.

`Decision` stores final action and reasons. Reason codes help audits and support teams.

### Failure and Safe Defaults

If a rule has missing data, it should return review or no decision based on risk.

If rules conflict, priority must be explicit.

If the evaluator fails completely, high-risk transactions should fail safe, often deny or review.

### Follow-up Interview Questions With Answers

**Q: Why use a rule interface?**  
A: It lets us add new rules without rewriting the evaluator.

**Q: How do you test it?**  
A: Test each rule alone, then test evaluator priority with conflicting decisions.

**Q: What is the tradeoff?**  
A: Rules are explainable, but too many rules can become hard to manage without ownership and monitoring.
