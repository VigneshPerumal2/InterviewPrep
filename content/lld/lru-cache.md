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
