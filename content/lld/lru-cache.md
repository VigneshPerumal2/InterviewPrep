# LRU Cache

## NEXT THING TO SAY

I will design an LRU cache where every get or put marks a key as recently used, and the oldest key is evicted when capacity is exceeded.

## 0) Two-Line Design Framing

- We need `get` and `put`.
- Correctness means the least recently used key is removed first.

## 1) Requirements and Constraints

- `get` returns value or `-1`.
- `put` inserts or updates.
- Both update recency.
- Capacity is fixed.

## 2) Objects and Responsibilities

Use `OrderedDict` for the clean Python version. Explain dictionary plus doubly linked list if asked.

## 3) Class/API Design

```text
LRUCache.get(key)
LRUCache.put(key, value)
```

## 4) Core Workflow

On get, move key to recent end. On put, set value, move to recent end, evict oldest if over capacity.

## 5) Invariants

- **invariant**: oldest key is first.
- **invariant**: newest key is last.
- **invariant**: size never exceeds capacity after put.

## 6) Edge Cases

- **edge cases**: missing key.
- **edge cases**: update existing key.
- **edge cases**: capacity one.

## 7) Python Implementation Sketch

```python
# Import OrderedDict.
from collections import OrderedDict

# Define the LRU cache.
class LRUCache:

    # Define the constructor.
    def __init__(self, capacity):

        # Store the capacity.
        self.capacity = capacity

        # Store values in recency order.
        self.values = OrderedDict()

    # Define the get method.
    def get(self, key):

        # Check missing key.
        if key not in self.values:

            # Return negative one.
            return -1

        # Move key to most recent.
        self.values.move_to_end(key)

        # Return value.
        return self.values[key]

    # Define the put method.
    def put(self, key, value):

        # Store value.
        self.values[key] = value

        # Mark key as recent.
        self.values.move_to_end(key)

        # Check size.
        if len(self.values) > self.capacity:

            # Remove oldest item.
            self.values.popitem(last=False)
```

## 8) Tests

- Get missing key.
- Evict least recent key.
- Update existing key.
- Get updates recency.

## 9) Follow-up Interview Questions

**Q: Why not just a dictionary?**  
A: A dictionary gives lookup, but not eviction order.

## 10) Tradeoffs and Wrap

`OrderedDict` is clear. Manual linked list gives more control but more bug risk.

## Beginner Deep Dive: LRU Cache

<div class="class-demo">
  <div class="class-card"><strong>Cache Entry</strong>Stores a key and value.</div>
  <div class="class-card"><strong>Hash Map</strong>Finds entries in constant time, O(1).</div>
  <div class="class-card"><strong>Recency Order</strong>Tracks most recently used to least recently used.</div>
  <div class="class-card"><strong>Cache API</strong>Supports get and put operations.</div>
</div>

### What The Design Is Protecting

The main **invariant** is that the recency order must match actual usage. The most recently used item is at one end, and the least recently used item is at the other.

The second **invariant** is that cache size never exceeds capacity.

### Step-by-step Explanation

The hash map gives fast lookup. Without it, finding a key would take linear time, O(n).

The recency order tells us which item to evict. In Python, `OrderedDict` can represent this clearly. In a lower-level language, you can use a hash map plus doubly linked list.

`get(key)` returns the value and marks the key as recently used.

`put(key, value)` updates existing keys or inserts new keys. If the cache is full, remove the least recently used key.

### Failure and Safe Defaults

If capacity is zero, the cache should store nothing.

If a key is missing, return a clear miss value.

If concurrency is required, protect `get` and `put` with a lock or use a thread-safe structure.

### Follow-up Interview Questions With Answers

**Q: Why not just use a list?**  
A: A list makes lookup linear time, O(n). A hash map gives constant time, O(1), lookup.

**Q: What dominates runtime?**  
A: Both get and put should be constant time, O(1), because lookup and recency updates are constant.

**Q: What is the tradeoff?**  
A: The cache uses extra linear space, O(n), to make reads and writes fast.
