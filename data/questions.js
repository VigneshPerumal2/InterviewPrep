window.visaQuestionBank = [
  {
    category: 'Payments',
    question: 'In a card-not-present payment, what does authorization usually answer?',
    options: [
      'Whether the issuer approves the transaction request',
      'Whether the merchant has shipped the item',
      'Whether the customer received a refund',
      'Whether all logs were archived'
    ],
    answer: 0,
    explanation: 'Authorization asks the issuer for approval. Capture/clearing/settlement happen later or as part of a sale flow.'
  },
  {
    category: 'Payments',
    question: 'Why is idempotency important in payment APIs?',
    options: [
      'It makes frontend pages load faster',
      'It prevents duplicate charges when clients retry the same request',
      'It removes the need for authentication',
      'It guarantees every transaction is approved'
    ],
    answer: 1,
    explanation: 'Network calls can time out. Idempotency lets a client safely retry while the server returns the original result instead of creating a second payment.'
  },
  {
    category: 'Tokenization',
    question: 'What does payment tokenization protect?',
    options: [
      'The customer name only',
      'The Primary Account Number by replacing it with a token',
      'The merchant logo',
      'The database index'
    ],
    answer: 1,
    explanation: 'Visa Token Service style tokenization replaces sensitive card account data with a token that can be limited by device, merchant, or use case.'
  },
  {
    category: 'Java',
    question: 'Which Java collection is a good first choice for checking if you have seen a value before?',
    options: ['ArrayList', 'HashSet', 'Stack', 'PriorityQueue'],
    answer: 1,
    explanation: 'A HashSet supports average constant-time membership checks, which is why it is common for duplicate and recurring-character problems.'
  },
  {
    category: 'System Design',
    question: 'What is throughput?',
    options: [
      'How many requests a system can process in a time period',
      'How long one request takes',
      'Whether code is object-oriented',
      'The number of classes in the codebase'
    ],
    answer: 0,
    explanation: 'Latency is time for one request. Throughput is how much work the system handles per second or minute.'
  },
  {
    category: 'Kafka',
    question: 'In Kafka, what does a consumer offset represent?',
    options: [
      'The encryption key',
      'The position of a consumer in a topic partition',
      'The React component state',
      'The API status code'
    ],
    answer: 1,
    explanation: 'Offsets let consumers resume from a known position and are central to replay and failure recovery.'
  },
  {
    category: 'Security',
    question: 'What is authorization?',
    options: [
      'Proving who the user is',
      'Deciding what the authenticated user is allowed to do',
      'Encrypting a database backup',
      'Rendering a login page'
    ],
    answer: 1,
    explanation: 'Authentication verifies identity. Authorization checks permission.'
  },
  {
    category: 'Frontend',
    question: 'In React, why do we usually keep API loading state?',
    options: [
      'To show useful UI while data is loading or failed',
      'To avoid writing CSS',
      'To replace backend validation',
      'To make SQL queries faster'
    ],
    answer: 0,
    explanation: 'Loading, error, and empty states make API-driven screens predictable and user-friendly.'
  }
];

window.visaPracticePrompts = [
  {
    category: 'Coding',
    prompt: 'Explain Merge Two Sorted Arrays out loud using constraints, brute force, pattern, dry run, and complexity.',
    answer: 'Say that the arrays are sorted, nums1 has extra space, and the safest optimized approach is two pointers from the back. Brute force sorts all values in linearithmic time, O(n log n). The optimized approach is linear time, O(n), and constant space, O(1).'
  },
  {
    category: 'Coding',
    prompt: 'Give the invariant for Sliding Window Maximum.',
    answer: 'The deque stores indexes whose values are decreasing from front to back, and the front index is always the maximum for the current window.'
  },
  {
    category: 'Payments',
    prompt: 'Explain authorization, capture, refund, and void in simple English.',
    answer: 'Authorization asks for approval. Capture finalizes an approved payment. Refund returns money after completion. Void cancels a request before it fully completes.'
  },
  {
    category: 'Payments',
    prompt: 'Explain why idempotency matters for payment APIs.',
    answer: 'Payment clients retry after timeouts. Idempotency makes the same request return the same result instead of creating a duplicate charge.'
  },
  {
    category: 'HLD',
    prompt: 'Give a 20-second framing for a payment gateway design.',
    answer: 'I will design a gateway that accepts merchant payment requests, prevents duplicate charges, routes authorization, and records decisions. Success means fast authorization, high availability, and complete auditability.'
  },
  {
    category: 'HLD',
    prompt: 'What safe fallback would you use if fraud data is unavailable?',
    answer: 'For high-risk traffic, send to review or decline by default. For low-risk traffic, use rules-only fallback if business policy allows it. Always log the reason.'
  },
  {
    category: 'LLD',
    prompt: 'Name two invariants for an idempotency key manager.',
    answer: 'One key maps to one request hash. A completed duplicate request returns the original response.'
  },
  {
    category: 'Behavioral',
    prompt: 'Which resume story should you use for production maturity?',
    answer: 'Use the RUM-based incident triage story: you attached user-session context to alerts and reduced duplicate escalations.'
  },
  {
    category: 'System Design',
    prompt: 'Explain cache failure in simple English.',
    answer: 'If cache is down, the system should still work by reading from the database, but it will be slower. Protect the database with limits and alerts.'
  },
  {
    category: 'Security',
    prompt: 'Explain authentication versus authorization.',
    answer: 'Authentication proves who the user or service is. Authorization decides what that identity is allowed to do.'
  }
];
