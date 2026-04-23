# Payment Authorization Workflow

## NEXT THING TO SAY

I will design the authorization workflow as one service that coordinates validation, fraud check, processor call, persistence, and audit.

## 0) Two-Line Design Framing

- We need to approve or decline a payment authorization request.
- Correctness means one request produces one clear payment state.

## 1) Requirements and Constraints

- Validate amount and merchant.
- Check fraud risk.
- Call processor.
- Store state.
- Write audit event.

## 2) Objects and Responsibilities

| Object | Responsibility |
|---|---|
| `AuthorizationService` | Orchestrates the flow. |
| `PaymentValidator` | Validates request. |
| `FraudClient` | Gets fraud decision. |
| `ProcessorClient` | Calls external processor. |
| `PaymentRepository` | Stores payment. |
| `AuditWriter` | Writes audit event. |

## 3) Class/API Design

```text
AuthorizationService.authorize(request)
PaymentValidator.validate(request)
FraudClient.evaluate(request)
ProcessorClient.authorize(request)
PaymentRepository.save(payment)
AuditWriter.record(event)
```

## 4) Core Workflow

Validate request, run fraud check, call processor, store payment state, and write audit event.

## 5) Invariants

- **invariant**: a payment has one final authorization state.
- **invariant**: every processor decision creates an audit event.

## 6) Edge Cases

- **edge cases**: invalid amount.
- **edge cases**: fraud service unavailable.
- **edge cases**: processor timeout.
- **edge cases**: duplicate request.

## 7) Python Implementation Sketch

```python
# Define the payment validator.
class PaymentValidator:

    # Define the validate method.
    def validate(self, request):

        # Check that amount is positive.
        if request["amount"] <= 0:

            # Raise an error for invalid amount.
            raise ValueError("amount must be positive")

# Define the authorization service.
class AuthorizationService:

    # Define the constructor.
    def __init__(self, validator, fraud_client, processor_client, repository, audit_writer):

        # Store the validator.
        self.validator = validator

        # Store the fraud client.
        self.fraud_client = fraud_client

        # Store the processor client.
        self.processor_client = processor_client

        # Store the repository.
        self.repository = repository

        # Store the audit writer.
        self.audit_writer = audit_writer

    # Define the authorize method.
    def authorize(self, request):

        # Validate the request.
        self.validator.validate(request)

        # Ask fraud service for a decision.
        fraud_decision = self.fraud_client.evaluate(request)

        # Reject high-risk requests.
        if fraud_decision == "decline":

            # Store the decline response.
            response = {"status": "declined", "reason": "fraud"}

            # Save the response.
            self.repository.save(response)

            # Record the audit event.
            self.audit_writer.record(response)

            # Return the response.
            return response

        # Call the processor.
        response = self.processor_client.authorize(request)

        # Save the processor response.
        self.repository.save(response)

        # Record the audit event.
        self.audit_writer.record(response)

        # Return the response.
        return response
```

## 8) Tests

- Valid request is authorized.
- Invalid amount fails.
- Fraud decline skips processor.
- Processor result is stored and audited.

## 9) Follow-up Interview Questions

**Q: Where does idempotency fit?**  
A: Wrap this service call with idempotency so retries do not create duplicate authorizations.

**Q: What happens if audit write fails?**  
A: Store an outbox event in the same transaction and retry asynchronously.

## 10) Tradeoffs and Wrap

This design is easy to test because each dependency is replaceable. The tradeoff is more classes, but each class has clear ownership.
