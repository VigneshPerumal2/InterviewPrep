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
