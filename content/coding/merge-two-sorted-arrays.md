# Merge Two Sorted Arrays

## NEXT THING TO SAY

I am given two sorted arrays, and the first array has extra space at the end. I will avoid overwriting useful values by filling the merged result from the back.

<div class="visual-demo">
  <div class="visual-demo-title">Two pointers move from the back</div>
  <div class="array-demo">
    <div class="array-cell">1</div><div class="array-cell">2</div><div class="array-cell hot">3</div><div class="array-cell">0</div><div class="array-cell">0</div><div class="array-cell hot">6</div>
  </div>
  <div class="pointer-dot"></div>
</div>

## 0) Two-Line Problem Framing

- We are given `nums1`, `m`, `nums2`, and `n`, where both real portions are sorted.
- We must merge `nums2` into `nums1` in sorted order.

## 1) Constraints First (Ask 4-6 Sharp Questions)

- Can one array be empty? My answer: yes, handle `m = 0` or `n = 0`.
- Are values negative? My answer: it does not matter.
- Are duplicates allowed? My answer: yes, preserve all values.
- Is `nums1` guaranteed to have enough space? My answer: yes.
- Should the merge happen in place? My answer: yes.

Given these **constraints**, a quadratic solution will not scale, so I will target a linear approach.

## 2) Brute Force First (No Code)

Brute force copies both arrays into a new list, sorts it, then copies back.

It is correct because sorting all values gives the final order. It is too slow because sorting adds extra work.

- Time: linearithmic time, O((m + n) log(m + n)).
- Space: linear space, O(m + n).

## 3) Name the Pattern Early

The pattern is two pointers from the back.

## 4) Optimized Approach (Structured Reasoning)

Use three pointers:

- `left` points to the last real value in `nums1`.
- `right` points to the last value in `nums2`.
- `write` points to the last open slot in `nums1`.

The **invariant** is: every position after `write` is already correct.

Alternative not chosen: merging from the front. I avoid it because it can overwrite useful values in `nums1`.

Compared with brute force, this improves from linearithmic time, O(n log n), to linear time, O(n), and from linear space, O(n), to constant space, O(1). The tradeoff is that the pointer logic is slightly more careful.

## 5) Complexity (Plain English + Big-O)

- Time is linear time, O(m + n).
- Space is constant space, O(1).
- The loop over the arrays dominates runtime.

## 6) Tradeoffs (Simple)

The brute force version is easier to think about, but it uses extra memory and sorting. The optimized version is slightly more careful but faster and in place.

## 7) Dry Run Before Coding

Normal example: `nums1 = [1,2,3,0,0,0]`, `nums2 = [2,5,6]`. Put `6`, then `5`, then `3`, then `2`, then `2`.

**edge case**: if `m = 0`, copy every value from `nums2` into `nums1`.

## 8) Python Code (TWO VERSIONS REQUIRED)

### 8A) Initial Clean Solution (No helpers unless truly needed)

```python
# Define the solution class.
class Solution:

    # Define the merge method.
    def merge(self, nums1, m, nums2, n):

        # Store the index of the last real value in nums1.
        left = m - 1

        # Store the index of the last value in nums2.
        right = n - 1

        # Store the index where the next largest value should be written.
        write = m + n - 1

        # Continue until every value from nums2 has been placed.
        while right >= 0:

            # Check if nums1 still has a larger value available.
            if left >= 0 and nums1[left] > nums2[right]:

                # Write the nums1 value into the open slot.
                nums1[write] = nums1[left]

                # Move the nums1 pointer left.
                left -= 1

            # Handle the case where nums2 has the next largest value.
            else:

                # Write the nums2 value into the open slot.
                nums1[write] = nums2[right]

                # Move the nums2 pointer left.
                right -= 1

            # Move the write pointer left.
            write -= 1

        # Return nums1 so the sample test can print it.
        return nums1

# Define the main function.
def main():

    # Create the first sample array.
    nums1 = [1, 2, 3, 0, 0, 0]

    # Create the second sample array.
    nums2 = [2, 5, 6]

    # Store the expected result.
    expected = [1, 2, 2, 3, 5, 6]

    # Run the solution.
    actual = Solution().merge(nums1, 3, nums2, 3)

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

### 8B) Refactored Version (Small helpers, not extensive)

```python
# Define the solution class.
class Solution:

    # Define the helper that decides whether nums1 should be used.
    def should_take_from_first(self, nums1, left, nums2, right):

        # Return true only when nums1 has a larger available value.
        return left >= 0 and nums1[left] > nums2[right]

    # Define the merge method.
    def merge(self, nums1, m, nums2, n):

        # Store the left pointer.
        left = m - 1

        # Store the right pointer.
        right = n - 1

        # Store the write pointer.
        write = m + n - 1

        # Place values from largest to smallest.
        while right >= 0:

            # Check which array owns the next largest value.
            if self.should_take_from_first(nums1, left, nums2, right):

                # Write the nums1 value.
                nums1[write] = nums1[left]

                # Move the nums1 pointer.
                left -= 1

            # Otherwise take the nums2 value.
            else:

                # Write the nums2 value.
                nums1[write] = nums2[right]

                # Move the nums2 pointer.
                right -= 1

            # Move the write pointer.
            write -= 1

        # Return the merged array.
        return nums1

# Define the main function.
def main():

    # Create the first sample array.
    nums1 = [1, 2, 3, 0, 0, 0]

    # Create the second sample array.
    nums2 = [2, 5, 6]

    # Store the expected result.
    expected = [1, 2, 2, 3, 5, 6]

    # Run the solution.
    actual = Solution().merge(nums1, 3, nums2, 3)

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

Refactor keeps the same complexity, it mainly improves readability.

## 9) Edge Case Validation

- **edge cases**: `nums2` empty.
- **edge cases**: `nums1` real part empty.
- **edge cases**: duplicates.
- **edge cases**: negative values.

## 10) Final Complexity + Final Tradeoffs (Brief)

Linear time, O(m + n). Constant space, O(1). The optimized solution is less obvious than sorting, but it avoids extra memory and sorting.

## Follow-up Interview Questions

**Q: Why merge from the back?**  
A: Because the empty slots are at the back, so we do not overwrite useful values.

**Q: What if there is no extra space?**  
A: I would create a new result list, which uses linear space, O(n).
