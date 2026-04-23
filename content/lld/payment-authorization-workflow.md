# Payment Authorization Workflow

## NEXT THING TO SAY

I will design the authorization workflow using clear class separation: a service orchestrates the flow, a validator checks inputs, clients handle external communication, a repository manages state, and an audit writer records decisions.

## 0) Two-Line Design Framing

- We need to orchestrate a payment authorization: validate, check fraud, call processor, store result, and emit events.
- Correctness means no duplicate charges, every decision is audited, processor timeouts create a pending state for reconciliation, and the response accurately reflects the authorization outcome.

## 1) Requirements and Constraints

- Validate merchant, amount, currency, and payment token.
- Check fraud risk before calling the processor.
- Handle processor timeout with pending state.
- Store payment state atomically with idempotency record.
- Emit audit events for every decision.
- Support circuit breaker for processor failures.
- Keep total latency under 500 milliseconds.

## 2) Objects and Responsibilities

| Object | Responsibility |
|---|---|
| `AuthorizationService` | Orchestrates the full authorization flow |
| `PaymentValidator` | Validates request fields and business rules |
| `FraudClient` | Calls fraud service for risk evaluation |
| `ProcessorClient` | Calls payment processor for authorization |
| `PaymentRepository` | Stores and retrieves payment state |
| `IdempotencyManager` | Prevents duplicate charges |
| `AuditWriter` | Records every decision |
| `CircuitBreaker` | Protects against processor failures |

## 3) Class/API Design

```text
AuthorizationService.authorize(request) -> AuthorizationResult
PaymentValidator.validate(request) -> ValidationResult
FraudClient.evaluate(context) -> FraudDecision
ProcessorClient.authorize(payment) -> ProcessorResponse
PaymentRepository.save(payment) -> None
PaymentRepository.find_by_id(payment_id) -> Payment
IdempotencyManager.execute(key, merchant_id, body, action_fn) -> result
AuditWriter.record(action, actor, entity_id, entity_type, metadata) -> None
CircuitBreaker.call(fn) -> result
```

## 4) Core Workflow

1. AuthorizationService receives an authorization request.
2. IdempotencyManager checks for duplicates. If replay, return stored result.
3. PaymentValidator validates all fields. If invalid, return 400 error.
4. FraudClient evaluates risk. If declined, skip processor and return decline.
5. CircuitBreaker wraps the ProcessorClient call. If circuit is open, return failure.
6. ProcessorClient sends authorization to the payment network.
7. If processor approves: store AUTHORIZED state and return success.
8. If processor declines: store DECLINED state and return decline.
9. If processor times out: store PENDING state and schedule reconciliation.
10. AuditWriter records the decision with all context.

## 5) Invariants

- **invariant**: a retry with the same idempotency key returns the same result.
- **invariant**: every authorization attempt is recorded in the audit log.
- **invariant**: processor timeout creates PENDING, never AUTHORIZED.
- **invariant**: fraud decline skips the processor (never sends a declined transaction to the network).

## 6) Edge Cases

- **edge case**: exact retry → return stored result from idempotency manager.
- **edge case**: fraud service timeout → use fallback policy (deny high-risk, allow low-risk).
- **edge case**: processor timeout → PENDING state with reconciliation.
- **edge case**: processor returns unknown status code → treat as decline, log for investigation.
- **edge case**: database failure during state write → retry with idempotency protection.
- **edge case**: circuit breaker open → return SERVICE_UNAVAILABLE immediately.

## 7) Python Implementation Sketch

```python
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum


class PaymentStatus(Enum):
    CREATED = "created"
    AUTHORIZED = "authorized"
    DECLINED = "declined"
    PENDING = "pending"
    FAILED = "failed"


@dataclass
class AuthorizationRequest:
    merchant_id: str
    amount: int  # minor units (cents)
    currency: str
    payment_token: str
    idempotency_key: str
    order_reference: str = ""


@dataclass
class Payment:
    payment_id: str = field(
        default_factory=lambda: str(uuid.uuid4())
    )
    merchant_id: str = ""
    amount: int = 0
    currency: str = ""
    status: PaymentStatus = PaymentStatus.CREATED
    processor_code: str = ""
    fraud_score: float = 0.0
    created_at: float = field(default_factory=time.time)


@dataclass
class AuthorizationResult:
    payment_id: str = ""
    status: str = ""
    processor_code: str = ""
    error: str = ""


class PaymentValidator:
    """Validates authorization request fields."""

    SUPPORTED_CURRENCIES = {"USD", "EUR", "GBP", "CAD", "AUD"}

    def validate(self, request):
        """Validate request fields. Returns list of errors."""
        errors = []

        if not request.merchant_id:
            errors.append("merchant_id is required")

        if request.amount <= 0:
            errors.append("amount must be positive")

        if request.currency not in self.SUPPORTED_CURRENCIES:
            errors.append(
                f"currency must be one of {self.SUPPORTED_CURRENCIES}"
            )

        if not request.payment_token:
            errors.append("payment_token is required")

        if not request.idempotency_key:
            errors.append("idempotency_key is required")

        return errors


class CircuitBreaker:
    """Protects against cascading processor failures.

    After failure_threshold consecutive failures, opens the circuit.
    Rejects all calls for recovery_timeout seconds.
    After timeout, allows one probe call to test recovery.
    """

    def __init__(self, failure_threshold=5, recovery_timeout=30):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.state = "closed"  # closed, open, half_open
        self.last_failure_time = 0

    def call(self, fn):
        """Execute fn through the circuit breaker."""
        if self.state == "open":
            elapsed = time.time() - self.last_failure_time
            if elapsed < self.recovery_timeout:
                raise CircuitOpenError(
                    "Processor circuit breaker is open"
                )
            # Try a probe call.
            self.state = "half_open"

        try:
            result = fn()
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        self.failure_count = 0
        self.state = "closed"

    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "open"


class CircuitOpenError(Exception):
    pass


class AuthorizationService:
    """Orchestrates the payment authorization workflow.

    Coordinates validation, fraud check, processor call,
    state persistence, and audit recording.
    """

    def __init__(self, validator, fraud_client, processor_client,
                 repository, idempotency_manager, audit_writer,
                 circuit_breaker):
        self.validator = validator
        self.fraud = fraud_client
        self.processor = processor_client
        self.repository = repository
        self.idempotency = idempotency_manager
        self.audit = audit_writer
        self.circuit = circuit_breaker

    def authorize(self, request):
        """Execute the full authorization workflow.

        Steps:
        1. Validate input
        2. Check idempotency (return stored result if replay)
        3. Check fraud
        4. Call processor (through circuit breaker)
        5. Store result
        6. Record audit event
        """
        # Step 1: Validate
        errors = self.validator.validate(request)
        if errors:
            return AuthorizationResult(
                status="invalid",
                error="; ".join(errors)
            )

        # Step 2: Idempotency
        def execute_authorization():
            return self._do_authorize(request)

        return self.idempotency.execute(
            key=request.idempotency_key,
            merchant_id=request.merchant_id,
            request_body={
                "amount": request.amount,
                "currency": request.currency,
                "payment_token": request.payment_token,
            },
            action_fn=execute_authorization
        )

    def _do_authorize(self, request):
        """Internal authorization logic after idempotency check."""
        payment = Payment(
            merchant_id=request.merchant_id,
            amount=request.amount,
            currency=request.currency,
        )

        # Step 3: Fraud check
        fraud_decision = self._check_fraud(request, payment)
        if fraud_decision == "decline":
            payment.status = PaymentStatus.DECLINED
            self.repository.save(payment)
            self._record_audit(payment, "fraud_declined")
            return AuthorizationResult(
                payment_id=payment.payment_id,
                status="declined",
                processor_code="FRAUD_DECLINE"
            )

        # Step 4: Processor call
        try:
            response = self.circuit.call(
                lambda: self.processor.authorize(payment)
            )

            if response.approved:
                payment.status = PaymentStatus.AUTHORIZED
                payment.processor_code = response.code
            else:
                payment.status = PaymentStatus.DECLINED
                payment.processor_code = response.code

        except CircuitOpenError:
            payment.status = PaymentStatus.FAILED
            payment.processor_code = "CIRCUIT_OPEN"
        except TimeoutError:
            payment.status = PaymentStatus.PENDING
            payment.processor_code = "TIMEOUT"
        except Exception:
            payment.status = PaymentStatus.FAILED
            payment.processor_code = "ERROR"

        # Step 5: Store result
        self.repository.save(payment)

        # Step 6: Audit
        self._record_audit(payment, "authorization_completed")

        return AuthorizationResult(
            payment_id=payment.payment_id,
            status=payment.status.value,
            processor_code=payment.processor_code
        )

    def _check_fraud(self, request, payment):
        """Check fraud with timeout fallback."""
        try:
            decision = self.fraud.evaluate({
                "merchant_id": request.merchant_id,
                "amount": request.amount,
                "currency": request.currency,
            })
            payment.fraud_score = decision.get("score", 0)
            return decision.get("decision", "approve")
        except TimeoutError:
            # Fallback: deny high-risk, allow low-risk.
            if request.amount > 500000:  # > $5,000
                return "decline"
            return "approve"
        except Exception:
            return "approve"  # Do not block on fraud errors

    def _record_audit(self, payment, action):
        """Record audit event (non-blocking)."""
        try:
            self.audit.record(
                action=action,
                actor=payment.merchant_id,
                entity_id=payment.payment_id,
                entity_type="payment",
                metadata={
                    "amount": payment.amount,
                    "status": payment.status.value,
                    "processor_code": payment.processor_code,
                }
            )
        except Exception:
            pass  # Audit failure should not block authorization
```

## 8) Tests

- **Happy path**: Valid request → processor approves → AUTHORIZED status returned.
- **Fraud decline**: Fraud returns decline → processor never called → DECLINED status.
- **Processor decline**: Fraud approves → processor declines → DECLINED with code.
- **Processor timeout**: Fraud approves → processor times out → PENDING status.
- **Circuit breaker**: After 5 processor failures, circuit opens → immediate FAILED.
- **Idempotency replay**: Same key + same body → returns stored result.
- **Idempotency conflict**: Same key + different body → 409 error.
- **Validation failure**: Missing required fields → returns errors.
- **Fraud timeout fallback**: Fraud times out → high amount declines, low amount approves.
- **Audit recording**: Every decision is recorded in audit log.

## 9) Follow-up Interview Questions

**Q: How do you handle the PENDING → AUTHORIZED reconciliation?**  
A: A scheduled reconciliation job queries the processor for the status of PENDING payments. If the processor confirms authorization, update to AUTHORIZED. If the processor has no record, update to FAILED. Use the same idempotency key when querying the processor.

**Q: How do you test the circuit breaker?**  
A: Unit test with a mock processor that throws exceptions. After failure_threshold throws, verify the circuit opens and calls are rejected. After recovery_timeout, verify one probe call is allowed. If probe succeeds, verify circuit closes.

**Q: Why separate the validator from the service?**  
A: Single Responsibility Principle. The service orchestrates the workflow. The validator owns input validation rules. If validation rules change (new currency, new field), only the validator changes. If the workflow changes (new step), only the service changes.

## 10) Tradeoffs and Wrap

Clear class separation makes each component testable in isolation. The tradeoff is more classes to manage. For production, I would add: correlation ID for distributed tracing, configurable timeout per processor, processor response normalization for multi-processor support, and fallback processor routing.

## Beginner Deep Dive: Payment Authorization Workflow

<div class="class-demo">
  <div class="class-card"><strong>AuthorizationService</strong>Orchestrates the flow: validate → fraud → processor → store → audit. Does not contain business logic itself.</div>
  <div class="class-card"><strong>PaymentValidator</strong>Checks fields: amount positive, currency supported, token present. Returns a list of errors, not exceptions.</div>
  <div class="class-card"><strong>CircuitBreaker</strong>Protects against cascading processor failures. Opens after N failures, rejects all calls for a timeout period.</div>
</div>

### What The Design Is Protecting

The main **invariant** is that processor timeouts create a PENDING state, never an AUTHORIZED state. This prevents the system from telling the merchant "payment approved" when we do not actually know the processor's decision.

### Why Circuit Breaker

If the processor is down and we keep sending requests, we waste resources and increase latency for all merchants. The circuit breaker detects failure patterns (5 consecutive failures) and stops sending requests temporarily, returning FAILED immediately. After a recovery timeout, it allows one probe call to test if the processor recovered.

### Flow Through the Objects

1. AuthorizationService receives the request.
2. It delegates to PaymentValidator for field checks.
3. It delegates to FraudClient for risk assessment.
4. It wraps the ProcessorClient call in a CircuitBreaker.
5. It saves the result via PaymentRepository.
6. It records the decision via AuditWriter.

Each object has one job. This makes testing straightforward: mock FraudClient to return "decline" and verify the processor is never called.

### Failure and Safe Defaults

If the processor times out, the system stores PENDING and schedules reconciliation. If the fraud service times out, the system applies a fallback policy based on risk. If the database fails during state write, the idempotency key protects against duplicate charges on retry.

The safe default: when in doubt about the processor's decision, return PENDING and reconcile later, never assume AUTHORIZED.
