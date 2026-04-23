# Grid Paths With Blocked Cells

## NEXT THING TO SAY

I need to count paths through a grid while avoiding blocked cells. I will use dynamic programming because each cell depends on the number of ways to reach the cell above it and the cell to its left.

<div class="visual-demo">
  <div class="visual-demo-title">Paths flow around blocked cells</div>
  <div class="grid-demo">
    <div class="grid-cell path">S</div><div class="grid-cell path">1</div><div class="grid-cell">2</div><div class="grid-cell">3</div>
    <div class="grid-cell">1</div><div class="grid-cell blocked">X</div><div class="grid-cell path">1</div><div class="grid-cell">4</div>
    <div class="grid-cell">1</div><div class="grid-cell path">1</div><div class="grid-cell path">2</div><div class="grid-cell path">E</div>
  </div>
</div>

## 0) Two-Line Problem Framing

- We are given a grid where `1` means blocked and `0` means open.
- We must return the number of paths from top-left to bottom-right moving only right or down.

## 1) Constraints First (Ask 4-6 Sharp Questions)

- Can the start or end be blocked? My answer: yes, return `0`.
- Can the grid be empty? My answer: yes, return `0`.
- Are moves only right and down? My answer: yes.
- Should I return the count, not the actual paths? My answer: yes.
- Can the count be large? My answer: mention integer limits if language requires it.

Given these **constraints**, a quadratic scan of all paths will not scale, so I will target a dynamic programming approach.

## 2) Brute Force First (No Code)

Brute force tries every possible path recursively.

It is correct because it explores every valid route. It is too slow because many subpaths are recalculated.

- Time: exponential time, roughly O(2^(rows + cols)).
- Space: linear recursion depth, O(rows + cols).

## 3) Name the Pattern Early

The pattern is dynamic programming on a grid.

## 4) Optimized Approach (Structured Reasoning)

Use a `dp` grid where `dp[row][col]` means how many ways reach that cell.

The **invariant** is: after processing a cell, its value equals paths from top plus paths from left, unless blocked.

Alternative not chosen: depth-first search with memoization. It also works, but iterative dynamic programming is easier to explain here.

Compared with brute force, this improves from exponential time to rows times columns time, O(rows * cols). Space is O(rows * cols), or can be optimized later.

## 5) Complexity (Plain English + Big-O)

- Time is rows times columns time, O(rows * cols).
- Space is rows times columns space, O(rows * cols).
- Filling the table dominates runtime.

## 6) Tradeoffs (Simple)

The table uses memory, but it avoids recalculating the same subproblems.

## 7) Dry Run Before Coding

Normal example: a `3 x 3` grid with center blocked has `2` paths.

**edge case**: if the start is blocked, return `0`.

## 8) Python Code (TWO VERSIONS REQUIRED)

### 8A) Initial Clean Solution (No helpers unless truly needed)

```python
# Define the solution class.
class Solution:

    # Define the method that counts paths.
    def unique_paths_with_obstacles(self, grid):

        # Check for an empty grid.
        if not grid or not grid[0]:

            # Return zero because no path exists.
            return 0

        # Store the number of rows.
        rows = len(grid)

        # Store the number of columns.
        cols = len(grid[0])

        # Check whether the start is blocked.
        if grid[0][0] == 1:

            # Return zero because we cannot start.
            return 0

        # Create the dynamic programming table.
        dp = [[0 for _ in range(cols)] for _ in range(rows)]

        # Set the starting cell.
        dp[0][0] = 1

        # Visit every row.
        for row in range(rows):

            # Visit every column.
            for col in range(cols):

                # Skip blocked cells.
                if grid[row][col] == 1:

                    # Store zero paths for the blocked cell.
                    dp[row][col] = 0

                    # Continue to the next cell.
                    continue

                # Add paths from above.
                if row > 0:

                    # Add the top cell count.
                    dp[row][col] += dp[row - 1][col]

                # Add paths from the left.
                if col > 0:

                    # Add the left cell count.
                    dp[row][col] += dp[row][col - 1]

        # Return the bottom-right count.
        return dp[rows - 1][cols - 1]

# Define the main function.
def main():

    # Store the sample grid.
    grid = [[0, 0, 0], [0, 1, 0], [0, 0, 0]]

    # Store the expected answer.
    expected = 2

    # Run the solution.
    actual = Solution().unique_paths_with_obstacles(grid)

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

### 8B) Refactored Version (Small helpers, not extensive)

```python
# Define the solution class.
class Solution:

    # Define a helper that checks whether a cell is blocked.
    def is_blocked(self, grid, row, col):

        # Return whether the cell contains a block.
        return grid[row][col] == 1

    # Define the method that counts paths.
    def unique_paths_with_obstacles(self, grid):

        # Check for an empty grid.
        if not grid or not grid[0]:

            # Return zero for empty input.
            return 0

        # Store row count.
        rows = len(grid)

        # Store column count.
        cols = len(grid[0])

        # Check whether the start is blocked.
        if self.is_blocked(grid, 0, 0):

            # Return zero because no path can begin.
            return 0

        # Create the dynamic programming table.
        dp = [[0 for _ in range(cols)] for _ in range(rows)]

        # Set the start count.
        dp[0][0] = 1

        # Visit each row.
        for row in range(rows):

            # Visit each column.
            for col in range(cols):

                # Check blocked cells.
                if self.is_blocked(grid, row, col):

                    # Store zero for a blocked cell.
                    dp[row][col] = 0

                    # Move to the next cell.
                    continue

                # Add paths from above when possible.
                if row > 0:

                    # Add the above count.
                    dp[row][col] += dp[row - 1][col]

                # Add paths from the left when possible.
                if col > 0:

                    # Add the left count.
                    dp[row][col] += dp[row][col - 1]

        # Return the final cell count.
        return dp[rows - 1][cols - 1]

# Define the main function.
def main():

    # Store the sample grid.
    grid = [[0, 0, 0], [0, 1, 0], [0, 0, 0]]

    # Store the expected answer.
    expected = 2

    # Run the solution.
    actual = Solution().unique_paths_with_obstacles(grid)

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

Refactor keeps the same complexity, it mainly improves readability.

## 9) Edge Case Validation

- **edge cases**: empty grid.
- **edge cases**: start blocked.
- **edge cases**: end blocked.
- **edge cases**: one row or one column.

## 10) Final Complexity + Final Tradeoffs (Brief)

Rows times columns time, O(rows * cols). Rows times columns space, O(rows * cols). Space can be reduced to one row if needed.

## Follow-up Interview Questions

**Q: Can space be improved?**  
A: Yes, use one row of dynamic programming values for linear space, O(cols).

**Q: What if diagonal moves are allowed?**  
A: Add the diagonal predecessor into the recurrence.
