# Sliding Window Maximum

## NEXT THING TO SAY

I need the maximum value for every window of size `k`. I will keep useful indexes in a deque so the largest value is always at the front.

<div class="visual-demo">
  <div class="visual-demo-title">Window slides while deque keeps useful values</div>
  <div class="window-demo">
    <div class="array-cell">1</div><div class="array-cell">3</div><div class="array-cell">-1</div><div class="array-cell">-3</div><div class="array-cell hot">5</div><div class="array-cell">3</div>
  </div>
</div>

## 0) Two-Line Problem Framing

- We are given an array and a window size `k`.
- We must return the maximum value in each contiguous window.

## 1) Constraints First (Ask 4-6 Sharp Questions)

- Can `k` be `1`? My answer: yes, return the original values.
- Can values be negative? My answer: yes.
- Is `k` always valid? My answer: assume `1 <= k <= n`.
- Should output preserve window order? My answer: yes.
- Can there be duplicates? My answer: yes.

Given these **constraints**, a quadratic solution will not scale, so I will target a linear approach.

## 2) Brute Force First (No Code)

For every window, scan all `k` values and pick the largest.

It is correct because it directly checks each window. It is too slow when `k` is large.

- Time: quadratic-like time, O(n * k).
- Space: constant extra space besides output, O(1).

## 3) Name the Pattern Early

The pattern is monotonic deque.

## 4) Optimized Approach (Structured Reasoning)

Store indexes in a deque. Remove expired indexes from the front. Remove smaller values from the back.

The **invariant** is: deque values are decreasing from front to back, and the front is the current window maximum.

Alternative not chosen: max heap. It works, but it gives linearithmic time, O(n log n), and needs lazy deletion.

Compared with brute force, this improves from O(n * k) to linear time, O(n). Space becomes linear in the window size, O(k). The tradeoff is more careful deque logic.

## 5) Complexity (Plain English + Big-O)

- Time is linear time, O(n).
- Space is window-size space, O(k).
- Each index enters and leaves the deque at most once.

## 6) Tradeoffs (Simple)

Brute force is easier. The deque is faster but harder to explain without the **invariant**.

## 7) Dry Run Before Coding

Normal example: `[1,3,-1,-3,5,3,6,7]`, `k = 3`, returns `[3,3,5,5,6,7]`.

**edge case**: `k = 1` returns every value.

## 8) Python Code (TWO VERSIONS REQUIRED)

### 8A) Initial Clean Solution (No helpers unless truly needed)

```python
# Import deque.
from collections import deque

# Define the solution class.
class Solution:

    # Define the sliding window maximum method.
    def max_sliding_window(self, nums, k):

        # Store useful indexes.
        window = deque()

        # Store the answer.
        result = []

        # Visit each index and value.
        for index, value in enumerate(nums):

            # Remove indexes that are outside the window.
            while window and window[0] <= index - k:

                # Remove the expired index.
                window.popleft()

            # Remove smaller values from the back.
            while window and nums[window[-1]] <= value:

                # Remove the weaker index.
                window.pop()

            # Add the current index.
            window.append(index)

            # Start recording answers after the first full window.
            if index >= k - 1:

                # Append the current maximum value.
                result.append(nums[window[0]])

        # Return all window maximums.
        return result

# Define the main function.
def main():

    # Store the sample numbers.
    nums = [1, 3, -1, -3, 5, 3, 6, 7]

    # Store the expected answer.
    expected = [3, 3, 5, 5, 6, 7]

    # Run the solution.
    actual = Solution().max_sliding_window(nums, 3)

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

### 8B) Refactored Version (Small helpers, not extensive)

```python
# Import deque.
from collections import deque

# Define the solution class.
class Solution:

    # Define a helper that removes expired indexes.
    def remove_expired(self, window, index, k):

        # Remove indexes that left the window.
        while window and window[0] <= index - k:

            # Remove the expired index.
            window.popleft()

    # Define the sliding window maximum method.
    def max_sliding_window(self, nums, k):

        # Store useful indexes.
        window = deque()

        # Store the answer.
        result = []

        # Visit each index and value.
        for index, value in enumerate(nums):

            # Remove old indexes.
            self.remove_expired(window, index, k)

            # Remove weaker values.
            while window and nums[window[-1]] <= value:

                # Remove the weaker index.
                window.pop()

            # Add the current index.
            window.append(index)

            # Record a maximum when the window is full.
            if index >= k - 1:

                # Append the front value.
                result.append(nums[window[0]])

        # Return the answer.
        return result

# Define the main function.
def main():

    # Store the sample numbers.
    nums = [1, 3, -1, -3, 5, 3, 6, 7]

    # Store the expected answer.
    expected = [3, 3, 5, 5, 6, 7]

    # Run the solution.
    actual = Solution().max_sliding_window(nums, 3)

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

Refactor keeps the same complexity, it mainly improves readability.

## 9) Edge Case Validation

- **edge cases**: `k = 1`.
- **edge cases**: all decreasing values.
- **edge cases**: all equal values.
- **edge cases**: negative values.

## 10) Final Complexity + Final Tradeoffs (Brief)

Linear time, O(n). Window-size space, O(k). Deque is more complex but gives the best runtime.

## Follow-up Interview Questions

**Q: Why store indexes, not values?**  
A: Indexes let us remove values that leave the window.

**Q: Can a heap solve this?**  
A: Yes, but it is slower: linearithmic time, O(n log n).
