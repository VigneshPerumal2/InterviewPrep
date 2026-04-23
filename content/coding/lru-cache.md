# LRU Cache

## NEXT THING TO SAY

I need a cache that removes the least recently used key when full. In Python, I can use `OrderedDict` for a clean interview solution and explain the hash map plus linked list idea.

<div class="visual-demo">
  <div class="visual-demo-title">Least recently used item fades out</div>
  <div class="cache-demo">
    <div class="cache-row"><span>Most recent</span><span>C</span></div>
    <div class="cache-row"><span>Middle</span><span>B</span></div>
    <div class="cache-row evicted"><span>Least recent</span><span>A</span></div>
  </div>
</div>

## 0) Two-Line Problem Framing

- We need `get` and `put` operations for a fixed-capacity cache.
- We must evict the least recently used key when the cache is full.

## 1) Constraints First (Ask 4-6 Sharp Questions)

- Should `get` update recency? My answer: yes.
- Should `put` update existing keys? My answer: yes.
- What should missing `get` return? My answer: `-1`.
- Is capacity positive? My answer: assume yes.
- Do operations need to be fast? My answer: yes, constant time.

Given these **constraints**, a slow scan will not scale, so I will target constant time operations.

## 2) Brute Force First (No Code)

Use a list of keys ordered by recency. On every access, scan and move the key.

It is correct because it preserves recency order. It is too slow because list movement may scan many keys.

- Time: linear time, O(n), per operation.
- Space: linear space, O(n).

## 3) Name the Pattern Early

The pattern is hash map plus recency order. In Python, `OrderedDict` gives this behavior.

## 4) Optimized Approach (Structured Reasoning)

Use `OrderedDict`. Move a key to the end whenever it is used. Pop from the front when capacity is exceeded.

The **invariant** is: the front is least recently used and the back is most recently used.

Alternative not chosen: manual doubly linked list plus dictionary. I would choose it if the interviewer wants implementation from scratch.

Compared with brute force, this improves each operation from linear time, O(n), to constant time, O(1). Space stays linear, O(n). The tradeoff is using a library data structure.

## 5) Complexity (Plain English + Big-O)

- Time is constant time, O(1), average per operation.
- Space is linear space, O(capacity).
- Hash lookup and recency updates dominate.

## 6) Tradeoffs (Simple)

`OrderedDict` is clean and reliable. Manual linked list shows deeper data structure control but is longer and easier to bug.

## 7) Dry Run Before Coding

Normal example: capacity `2`, put `1`, put `2`, get `1`, put `3`; key `2` is evicted.

**edge case**: updating an existing key should not increase size.

## 8) Python Code (TWO VERSIONS REQUIRED)

### 8A) Initial Clean Solution (No helpers unless truly needed)

```python
# Import OrderedDict.
from collections import OrderedDict

# Define the cache class.
class LRUCache:

    # Define the constructor.
    def __init__(self, capacity):

        # Store the capacity.
        self.capacity = capacity

        # Store keys in recency order.
        self.values = OrderedDict()

    # Define the get operation.
    def get(self, key):

        # Return missing value when key is absent.
        if key not in self.values:

            # Return negative one for missing keys.
            return -1

        # Move the key to the most recent position.
        self.values.move_to_end(key)

        # Return the stored value.
        return self.values[key]

    # Define the put operation.
    def put(self, key, value):

        # Store or update the value.
        self.values[key] = value

        # Move the key to the most recent position.
        self.values.move_to_end(key)

        # Check whether capacity was exceeded.
        if len(self.values) > self.capacity:

            # Remove the least recently used key.
            self.values.popitem(last=False)

# Define the main function.
def main():

    # Create a cache with capacity two.
    cache = LRUCache(2)

    # Put the first key.
    cache.put(1, 1)

    # Put the second key.
    cache.put(2, 2)

    # Read key one.
    actual = cache.get(1)

    # Store the expected answer.
    expected = 1

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

### 8B) Refactored Version (Small helpers, not extensive)

```python
# Import OrderedDict.
from collections import OrderedDict

# Define the cache class.
class LRUCache:

    # Define the constructor.
    def __init__(self, capacity):

        # Store the capacity.
        self.capacity = capacity

        # Store cache values.
        self.values = OrderedDict()

    # Define a helper that marks a key as recently used.
    def mark_recent(self, key):

        # Move the key to the end of the order.
        self.values.move_to_end(key)

    # Define the get operation.
    def get(self, key):

        # Check for missing key.
        if key not in self.values:

            # Return negative one when missing.
            return -1

        # Mark the key as recent.
        self.mark_recent(key)

        # Return the value.
        return self.values[key]

    # Define the put operation.
    def put(self, key, value):

        # Store the value.
        self.values[key] = value

        # Mark the key as recent.
        self.mark_recent(key)

        # Check capacity.
        if len(self.values) > self.capacity:

            # Remove the oldest key.
            self.values.popitem(last=False)

# Define the main function.
def main():

    # Create a cache with capacity two.
    cache = LRUCache(2)

    # Put the first key.
    cache.put(1, 1)

    # Put the second key.
    cache.put(2, 2)

    # Read key one.
    actual = cache.get(1)

    # Store the expected answer.
    expected = 1

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

Refactor keeps the same complexity, it mainly improves readability.

## 9) Edge Case Validation

- **edge cases**: update existing key.
- **edge cases**: get missing key.
- **edge cases**: capacity one.
- **edge cases**: many repeated gets.

## 10) Final Complexity + Final Tradeoffs (Brief)

Constant time, O(1), per operation. Linear space, O(capacity). Library solution is concise; manual linked list is better if requested.

## Follow-up Interview Questions

**Q: How would you make it thread-safe?**  
A: Protect `get` and `put` with a lock because both mutate recency order.

**Q: Why does `get` mutate state?**  
A: Because reading a key makes it recently used.
