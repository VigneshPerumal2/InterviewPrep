# Top K Frequent Elements

## NEXT THING TO SAY

I need the `k` values that appear most often. I will count values first, then keep only the best `k` candidates with a small heap.

<div class="visual-demo">
  <div class="visual-demo-title">Counts feed a top-k heap</div>
  <div class="array-demo">
    <div class="array-cell hot">1</div><div class="array-cell hot">1</div><div class="array-cell hot">1</div><div class="array-cell">2</div><div class="array-cell">2</div><div class="array-cell">3</div>
  </div>
</div>

## 0) Two-Line Problem Framing

- We are given an array and a number `k`.
- We must return the `k` most frequent values.

## 1) Constraints First (Ask 4-6 Sharp Questions)

- Can values repeat? My answer: yes, that is the point.
- Can `k` be zero? My answer: handle it by returning an empty list.
- Is output order important? My answer: assume no unless stated.
- Can values be negative? My answer: yes, a dictionary handles them.
- Is `k` always valid? My answer: assume `0 <= k <= unique values`.

Given these **constraints**, a quadratic solution will not scale, so I will target a near-linear approach.

## 2) Brute Force First (No Code)

Count each value by scanning the full array for every unique value, then sort by count.

It is correct because it computes true frequencies. It is too slow because it rescans the array.

- Time: quadratic time in the worst case, O(n²).
- Space: linear space, O(n).

## 3) Name the Pattern Early

The pattern is hash map plus min heap.

## 4) Optimized Approach (Structured Reasoning)

Use a dictionary for counts and a min heap of size `k`.

The **invariant** is: after processing each unique value, the heap contains at most `k` strongest candidates seen so far.

Alternative not chosen: sort all unique values by frequency. It is simpler, but it is linearithmic time, O(u log u), where `u` is unique values.

Compared with brute force, this improves from quadratic time, O(n²), to linear plus heap work, O(n + u log k). Space stays linear, O(n). The tradeoff is heap logic.

## 5) Complexity (Plain English + Big-O)

- Time is linear plus heap time, O(n + u log k).
- Space is linear space, O(n).
- Counting dominates when `k` is small.

## 6) Tradeoffs (Simple)

Sorting all counts is easier. A heap is better when `k` is much smaller than the number of unique values.

## 7) Dry Run Before Coding

Normal example: `[1,1,1,2,2,3]`, `k = 2`, returns `[1,2]`.

**edge case**: if `k = 0`, return `[]`.

## 8) Python Code (TWO VERSIONS REQUIRED)

### 8A) Initial Clean Solution (No helpers unless truly needed)

```python
# Import heap functions.
import heapq

# Define the solution class.
class Solution:

    # Define the top k method.
    def top_k_frequent(self, nums, k):

        # Return an empty list when k is zero.
        if k == 0:

            # Return no values.
            return []

        # Store frequencies by value.
        counts = {}

        # Count each value.
        for num in nums:

            # Update the count for this value.
            counts[num] = counts.get(num, 0) + 1

        # Store the min heap.
        heap = []

        # Visit each value and frequency.
        for num, count in counts.items():

            # Push the candidate into the heap.
            heapq.heappush(heap, (count, num))

            # Keep only k candidates.
            if len(heap) > k:

                # Remove the weakest candidate.
                heapq.heappop(heap)

        # Return the values from the heap.
        return [num for count, num in heap]

# Define the main function.
def main():

    # Store the sample numbers.
    nums = [1, 1, 1, 2, 2, 3]

    # Store the expected values.
    expected = sorted([1, 2])

    # Run the solution.
    actual = sorted(Solution().top_k_frequent(nums, 2))

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

### 8B) Refactored Version (Small helpers, not extensive)

```python
# Import heap functions.
import heapq

# Define the solution class.
class Solution:

    # Define a helper that builds frequency counts.
    def build_counts(self, nums):

        # Store frequencies by value.
        counts = {}

        # Count each value.
        for num in nums:

            # Update the count.
            counts[num] = counts.get(num, 0) + 1

        # Return the completed counts.
        return counts

    # Define the top k method.
    def top_k_frequent(self, nums, k):

        # Return empty output when k is zero.
        if k == 0:

            # Return no values.
            return []

        # Build the frequency counts.
        counts = self.build_counts(nums)

        # Store the heap.
        heap = []

        # Visit each counted value.
        for num, count in counts.items():

            # Push the value into the heap.
            heapq.heappush(heap, (count, num))

            # Enforce the heap size.
            if len(heap) > k:

                # Remove the weakest value.
                heapq.heappop(heap)

        # Return the selected values.
        return [num for count, num in heap]

# Define the main function.
def main():

    # Store the sample numbers.
    nums = [1, 1, 1, 2, 2, 3]

    # Store the expected values.
    expected = sorted([1, 2])

    # Run the solution.
    actual = sorted(Solution().top_k_frequent(nums, 2))

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

Refactor keeps the same complexity, it mainly improves readability.

## 9) Edge Case Validation

- **edge cases**: `k = 0`.
- **edge cases**: one unique value.
- **edge cases**: ties.
- **edge cases**: negative values.

## 10) Final Complexity + Final Tradeoffs (Brief)

Linear plus heap time, O(n + u log k). Linear space, O(n). Heap logic is slightly harder but avoids sorting all unique values.

## Follow-up Interview Questions

**Q: What if output must be sorted by frequency?**  
A: Sort the final `k` values by count after extraction.

**Q: What if `k` is close to unique count?**  
A: Sorting all unique values may be simpler and acceptable.
