# Coding Round Framework

## NEXT THING TO SAY

I will solve coding questions in a calm structure. I will start with **constraints**, explain brute force first, name the pattern, dry run, then write Python.

## 0) Two-Line Problem Framing

- Say what we are given.
- Say what we must return.

## 1) Constraints First

Ask 4 to 6 questions:

- What is the input size?
- Can the input be empty?
- Can values repeat?
- Are values sorted?
- Are negative values possible?
- Should I optimize for time, space, or readability?

Then say:

> Given these **constraints**, a quadratic solution will not scale, so I will target a linear or near-linear approach.

## 2) Brute Force First

Explain why brute force is correct before saying why it is slow. This shows you understand the problem.

## 3) Name the Pattern Early

Use simple labels: hash set, hash map, two pointers, sliding window, stack, heap, graph search, dynamic programming, or trie.

## 4) Optimized Approach

Always include:

- Data structures.
- Key variables.
- One **invariant**.
- One alternative not chosen.
- Short comparison with brute force.

## 5) Complexity

Say both plain words and notation:

- Linear time, O(n).
- Constant space, O(1).
- Linear space, O(n).
- Linearithmic time, O(n log n).

## 6) Tradeoffs

Do not pretend optimized is always free. Say what you gained and what became slightly harder.

## 7) Dry Run Before Coding

Use one normal case and one **edge case**.

## 8) Python Code

Use Python only. Do not use inline comments. Put a comment immediately above every line.

## 9) Edge Case Validation

Say empty input, one item, duplicates, large input, and impossible case if relevant.

## 10) Final Complexity + Final Tradeoffs

Keep it brief. Close with confidence.
