# Best Time To Buy And Sell Stock

## NEXT THING TO SAY

I need one buy and one sell, and the buy must happen before the sell. I will track the lowest price seen so far and the best profit possible at each day.

<div class="visual-demo">
  <div class="visual-demo-title">Minimum price stays behind the current day</div>
  <div class="array-demo">
    <div class="array-cell hot">7</div><div class="array-cell">1</div><div class="array-cell">5</div><div class="array-cell">3</div><div class="array-cell hot">6</div><div class="array-cell">4</div>
  </div>
</div>

## 0) Two-Line Problem Framing

- We are given a list of prices where each index is a day.
- We must return the maximum profit from one buy and one sell.

## 1) Constraints First (Ask 4-6 Sharp Questions)

- Can the list be empty? My answer: yes, return `0`.
- Can prices be equal? My answer: yes.
- Can profit be negative? My answer: no, return `0` if no profitable trade exists.
- Can I buy and sell on the same day? My answer: no.
- Is only one transaction allowed? My answer: yes.

Given these **constraints**, a quadratic solution will not scale, so I will target a linear approach.

## 2) Brute Force First (No Code)

Try every pair of buy day and sell day where sell is later.

It is correct because it checks every possible transaction. It is too slow for large input.

- Time: quadratic time, O(n²).
- Space: constant space, O(1).

## 3) Name the Pattern Early

The pattern is one-pass tracking with a running minimum.

## 4) Optimized Approach (Structured Reasoning)

Use `min_price` for the cheapest buy price seen so far and `best_profit` for the best answer so far.

The **invariant** is: before evaluating today as a sell day, `min_price` is the best buy price from earlier or current days.

Alternative not chosen: sorting prices. Sorting loses day order, so it breaks the rule that buy must happen before sell.

Compared with brute force, this improves from quadratic time, O(n²), to linear time, O(n). Space stays constant space, O(1). The tradeoff is that we must carefully preserve day order.

## 5) Complexity (Plain English + Big-O)

- Time is linear time, O(n).
- Space is constant space, O(1).
- The single pass dominates runtime.

## 6) Tradeoffs (Simple)

Brute force is simple but slow. The optimized version is just as memory efficient and much faster.

## 7) Dry Run Before Coding

Normal example: `[7,1,5,3,6,4]`. Minimum becomes `1`, best profit becomes `5` from buying at `1` and selling at `6`.

**edge case**: `[7,6,4,3,1]` returns `0`.

## 8) Python Code (TWO VERSIONS REQUIRED)

### 8A) Initial Clean Solution (No helpers unless truly needed)

```python
# Define the solution class.
class Solution:

    # Define the max profit method.
    def max_profit(self, prices):

        # Store the lowest price seen so far.
        min_price = float("inf")

        # Store the best profit found so far.
        best_profit = 0

        # Visit each price from left to right.
        for price in prices:

            # Update the lowest price seen so far.
            min_price = min(min_price, price)

            # Calculate the profit if we sell today.
            profit = price - min_price

            # Update the best profit.
            best_profit = max(best_profit, profit)

        # Return the best possible profit.
        return best_profit

# Define the main function.
def main():

    # Store the sample prices.
    prices = [7, 1, 5, 3, 6, 4]

    # Store the expected answer.
    expected = 5

    # Run the solution.
    actual = Solution().max_profit(prices)

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

### 8B) Refactored Version (Small helpers, not extensive)

```python
# Define the solution class.
class Solution:

    # Define a helper that updates the best profit.
    def profit_if_sold_today(self, price, min_price):

        # Return the profit for selling at the current price.
        return price - min_price

    # Define the max profit method.
    def max_profit(self, prices):

        # Store the lowest price seen so far.
        min_price = float("inf")

        # Store the best profit found so far.
        best_profit = 0

        # Visit each price.
        for price in prices:

            # Update the minimum price.
            min_price = min(min_price, price)

            # Compute today's sell profit.
            today_profit = self.profit_if_sold_today(price, min_price)

            # Update the best profit.
            best_profit = max(best_profit, today_profit)

        # Return the answer.
        return best_profit

# Define the main function.
def main():

    # Store the sample prices.
    prices = [7, 1, 5, 3, 6, 4]

    # Store the expected answer.
    expected = 5

    # Run the solution.
    actual = Solution().max_profit(prices)

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

Refactor keeps the same complexity, it mainly improves readability.

## 9) Edge Case Validation

- **edge cases**: empty list.
- **edge cases**: one price.
- **edge cases**: descending prices.
- **edge cases**: all equal prices.

## 10) Final Complexity + Final Tradeoffs (Brief)

Linear time, O(n). Constant space, O(1). The optimized solution is simple and keeps day order.

## Follow-up Interview Questions

**Q: What if unlimited transactions are allowed?**  
A: Add every positive day-to-day gain.

**Q: What if at most two transactions are allowed?**  
A: Use dynamic programming with states for first buy, first sell, second buy, and second sell.
