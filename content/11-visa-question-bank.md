# Visa Question Bank

## How To Use This Page

Do not memorize every answer. Pick 5 questions per day and answer out loud. Then compare your answer with the suggested direction.

## NEXT THING TO SAY

I will practice questions by answering simply first, then adding one technical detail, one tradeoff, and one failure case.

## Payments Questions

**Q: Explain a card payment flow.**  
A: The customer pays a merchant. The merchant sends the request through an acquirer or processor. Visa routes the request to the issuer. The issuer approves or declines. Later, clearing and settlement finalize the financial movement.

**Q: Why do payment APIs need idempotency?**  
A: Network timeouts cause retries. Idempotency prevents one logical payment request from creating duplicate charges.

**Q: What is tokenization?**  
A: Tokenization replaces the real card number with a payment token. This reduces exposure of sensitive card data.

**Q: What should happen if a fraud service is down?**  
A: Use a policy-based fallback. High-risk traffic should fail safely or go to review. Low-risk traffic may use rules-only fallback if allowed.

## Coding Questions

**Q: When do you use a hash set?**  
A: When I need fast membership checks, such as duplicates or first recurring character.

**Q: When do you use two pointers?**  
A: When the data is sorted or when two positions move toward a goal, such as merging arrays.

**Q: When do you use a deque?**  
A: When I need efficient operations at both ends, such as sliding window maximum.

**Q: When do you use dynamic programming?**  
A: When the problem has repeated subproblems and the answer can be built from smaller answers.

## System Design Questions

**Q: Design a payment gateway. What are the core services?**  
A: API gateway, authentication and authorization, idempotency service, payment service, fraud service, processor connector, payment database, event stream, audit pipeline, and dashboards.

**Q: How do you handle duplicate events?**  
A: Use event ids or idempotency keys. Store processed ids and return the same result when replayed.

**Q: How do you handle multi-region writes?**  
A: I start with one write region for correctness unless requirements demand active-active writes. If active-active is required, I need clear conflict rules.

**Q: How do you avoid hotspots?**  
A: Partition by a key that spreads load. If one merchant is too large, split by merchant plus shard.

## LLD Questions

**Q: What is an invariant in LLD?**  
A: A rule that must always be true. For example, one idempotency key maps to one request hash.

**Q: Why use a state machine for onboarding?**  
A: It makes allowed transitions explicit and rejects invalid transitions.

**Q: Why use strategy pattern for fraud rules?**  
A: Each rule can be added, removed, or tested independently.

**Q: What makes a good audit event?**  
A: It records actor, action, resource, time, reason, and metadata.

## Behavioral Questions

**Q: Why Visa?**  
A: Visa combines fullstack product work, scalable backend systems, security, and global payments. My experience with React, Java APIs, observability, identity, and event-driven systems maps well to that environment.

**Q: Tell me about production maturity.**  
A: Use the RUM incident triage story where you attached user-session context to alerts and reduced duplicate escalations.

**Q: Tell me about improving quality.**  
A: Use the Playwright CI/CD story where validation time dropped from 45 minutes to 8 minutes.

**Q: Tell me about backend scale.**  
A: Use the Volkswagen SQL optimization story with 80% query-time reduction and 5000+ transactions per second.
