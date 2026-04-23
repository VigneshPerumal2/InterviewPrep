# First Recurring Character

## NEXT THING TO SAY

I need the first character that repeats while scanning left to right. I will use a set because membership checks are fast.

<div class="visual-demo">
  <div class="visual-demo-title">Seen set grows as we scan</div>
  <div class="array-demo">
    <div class="array-cell">a</div><div class="array-cell">b</div><div class="array-cell">c</div><div class="array-cell hot">a</div>
  </div>
</div>

## 0) Two-Line Problem Framing

- We are given a string.
- We must return the first character that appears again during a left-to-right scan.

## 1) Constraints First (Ask 4-6 Sharp Questions)

- Can the string be empty? My answer: yes, return `None`.
- Is matching case-sensitive? My answer: yes unless told otherwise.
- Can spaces appear? My answer: yes, treat them as characters unless told otherwise.
- Should I return the character or index? My answer: character.
- Are unicode characters possible? My answer: Python handles them as characters.

Given these **constraints**, a quadratic solution will not scale, so I will target a linear approach.

## 2) Brute Force First (No Code)

For each character, scan all previous characters to see if it appeared before.

It is correct because it checks exactly what "recurring" means. It is too slow because each character may scan many earlier characters.

- Time: quadratic time, O(n²).
- Space: constant space, O(1).

## 3) Name the Pattern Early

The pattern is hash set lookup.

## 4) Optimized Approach (Structured Reasoning)

Use a set named `seen`. If the current character is already in `seen`, return it.

The **invariant** is: before processing index `i`, `seen` contains exactly the characters from indexes before `i`.

Alternative not chosen: sorting. Sorting loses original order, and we need first recurring by scan order.

Compared with brute force, this improves from quadratic time, O(n²), to linear time, O(n). Space increases from constant space, O(1), to linear space, O(n). The tradeoff is memory for speed.

## 5) Complexity (Plain English + Big-O)

- Time is linear time, O(n).
- Space is linear space, O(n).
- The scan through the string dominates runtime.

## 6) Tradeoffs (Simple)

Brute force saves memory but is slow. The set uses memory but makes lookup fast.

## 7) Dry Run Before Coding

Normal example: `"abca"` returns `"a"`.

**edge case**: `"abc"` returns `None`.

## 8) Python Code (TWO VERSIONS REQUIRED)

### 8A) Initial Clean Solution (No helpers unless truly needed)

```python
# Define the solution class.
class Solution:

    # Define the method that finds the first recurring character.
    def first_recurring(self, text):

        # Store characters we have already seen.
        seen = set()

        # Scan each character from left to right.
        for character in text:

            # Check whether this character has appeared before.
            if character in seen:

                # Return the first recurring character.
                return character

            # Add the character to the seen set.
            seen.add(character)

        # Return none when there is no recurring character.
        return None

# Define the main function.
def main():

    # Store the sample input.
    text = "abca"

    # Store the expected answer.
    expected = "a"

    # Run the solution.
    actual = Solution().first_recurring(text)

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

### 8B) Refactored Version (Small helpers, not extensive)

```python
# Define the solution class.
class Solution:

    # Define a helper that checks whether a character was seen.
    def was_seen(self, seen, character):

        # Return whether the character exists in the seen set.
        return character in seen

    # Define the method that finds the first recurring character.
    def first_recurring(self, text):

        # Store characters we have already seen.
        seen = set()

        # Scan each character from left to right.
        for character in text:

            # Check if this character was already seen.
            if self.was_seen(seen, character):

                # Return the repeated character.
                return character

            # Store this character.
            seen.add(character)

        # Return none if no repeated character exists.
        return None

# Define the main function.
def main():

    # Store the sample input.
    text = "abca"

    # Store the expected answer.
    expected = "a"

    # Run the solution.
    actual = Solution().first_recurring(text)

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

Refactor keeps the same complexity, it mainly improves readability.

## 9) Edge Case Validation

- **edge cases**: empty string.
- **edge cases**: no repeated character.
- **edge cases**: repeated first character.
- **edge cases**: case sensitivity.

## 10) Final Complexity + Final Tradeoffs (Brief)

Linear time, O(n). Linear space, O(n). The optimized choice trades memory for speed.

## Follow-up Interview Questions

**Q: How would you return the index instead?**  
A: Return the current loop index when the character is found in `seen`.

**Q: How would you ignore case?**  
A: Convert the string to lowercase before scanning.
