# Valid Parentheses With Wildcard

## NEXT THING TO SAY

I need to decide if the string can become valid when `*` acts as `(`, `)`, or empty. I will track the range of possible open-parenthesis counts instead of trying every replacement.

<div class="visual-demo">
  <div class="visual-demo-title">Wildcard expands the possible open-count range</div>
  <div class="array-demo">
    <div class="array-cell">(</div><div class="array-cell hot">*</div><div class="array-cell">)</div><div class="array-cell hot">*</div>
  </div>
</div>

## 0) Two-Line Problem Framing

- We are given a string containing `(`, `)`, and `*`.
- We must return whether some replacement of `*` makes the parentheses valid.

## 1) Constraints First (Ask 4-6 Sharp Questions)

- Can the string be empty? My answer: yes, it is valid.
- Can `*` be empty? My answer: yes.
- Are there only three character types? My answer: assume yes.
- Do we need one valid replacement or all replacements? My answer: just whether one exists.
- Can the string be large? My answer: yes, avoid exponential recursion.

Given these **constraints**, trying every wildcard replacement will not scale, so I will target a linear approach.

## 2) Brute Force First (No Code)

Try every meaning of each `*`, then check if any generated string is valid.

It is correct because it checks every possibility. It is too slow because choices triple for each wildcard.

- Time: exponential time, O(3^s), where `s` is number of wildcards.
- Space: linear recursion depth, O(n).

## 3) Name the Pattern Early

The pattern is greedy range tracking.

## 4) Optimized Approach (Structured Reasoning)

Track `min_open` and `max_open`, the smallest and largest possible open counts after each character.

The **invariant** is: if a valid interpretation exists so far, its open count is inside this range.

Alternative not chosen: dynamic programming over index and open count. It works, but it uses more memory.

Compared with brute force, this improves from exponential time, O(3^s), to linear time, O(n). Space improves to constant space, O(1). The tradeoff is that the range idea is less obvious at first.

## 5) Complexity (Plain English + Big-O)

- Time is linear time, O(n).
- Space is constant space, O(1).
- One scan dominates runtime.

## 6) Tradeoffs (Simple)

Brute force is easy to believe but impossible for many wildcards. Greedy range is compact and fast.

## 7) Dry Run Before Coding

Normal example: `"(*)"` is valid because `*` can be empty.

**edge case**: `")("` is invalid because `max_open` becomes negative.

## 8) Python Code (TWO VERSIONS REQUIRED)

### 8A) Initial Clean Solution (No helpers unless truly needed)

```python
# Define the solution class.
class Solution:

    # Define the validation method.
    def check_valid_string(self, text):

        # Store the minimum possible open count.
        min_open = 0

        # Store the maximum possible open count.
        max_open = 0

        # Scan each character.
        for character in text:

            # Handle an opening parenthesis.
            if character == "(":

                # Increase the minimum open count.
                min_open += 1

                # Increase the maximum open count.
                max_open += 1

            # Handle a closing parenthesis.
            elif character == ")":

                # Decrease the minimum open count but not below zero.
                min_open = max(0, min_open - 1)

                # Decrease the maximum open count.
                max_open -= 1

            # Handle a wildcard.
            else:

                # Treat wildcard as close or empty for the minimum.
                min_open = max(0, min_open - 1)

                # Treat wildcard as open for the maximum.
                max_open += 1

            # Stop if even the maximum is negative.
            if max_open < 0:

                # Return false because too many closings exist.
                return False

        # Return whether zero open count is possible.
        return min_open == 0

# Define the main function.
def main():

    # Store the sample string.
    text = "(*)"

    # Store the expected answer.
    expected = True

    # Run the solution.
    actual = Solution().check_valid_string(text)

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

### 8B) Refactored Version (Small helpers, not extensive)

```python
# Define the solution class.
class Solution:

    # Define a helper that keeps minimum open count valid.
    def clamp_min_open(self, value):

        # Return value clamped at zero.
        return max(0, value)

    # Define the validation method.
    def check_valid_string(self, text):

        # Store minimum possible opens.
        min_open = 0

        # Store maximum possible opens.
        max_open = 0

        # Scan every character.
        for character in text:

            # Handle open character.
            if character == "(":

                # Increase minimum opens.
                min_open += 1

                # Increase maximum opens.
                max_open += 1

            # Handle close character.
            elif character == ")":

                # Decrease minimum opens.
                min_open = self.clamp_min_open(min_open - 1)

                # Decrease maximum opens.
                max_open -= 1

            # Handle wildcard character.
            else:

                # Decrease minimum opens.
                min_open = self.clamp_min_open(min_open - 1)

                # Increase maximum opens.
                max_open += 1

            # Check impossible prefix.
            if max_open < 0:

                # Return false for invalid prefix.
                return False

        # Return whether a balanced interpretation exists.
        return min_open == 0

# Define the main function.
def main():

    # Store the sample string.
    text = "(*)"

    # Store the expected answer.
    expected = True

    # Run the solution.
    actual = Solution().check_valid_string(text)

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

Refactor keeps the same complexity, it mainly improves readability.

## 9) Edge Case Validation

- **edge cases**: empty string.
- **edge cases**: all wildcards.
- **edge cases**: prefix starts with too many closing parentheses.
- **edge cases**: unmatched opening parentheses.

## 10) Final Complexity + Final Tradeoffs (Brief)

Linear time, O(n). Constant space, O(1). The range method is compact but requires careful explanation of the **invariant**.

## Follow-up Interview Questions

**Q: Why track a range instead of one count?**  
A: A wildcard can mean different things, so there can be many possible open counts.

**Q: What if we need the actual replacement string?**  
A: I would use dynamic programming or backtracking with pruning to reconstruct a valid choice.
