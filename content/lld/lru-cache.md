# LRU Cache

## NEXT THING TO SAY

I will implement an LRU cache using a hash map for O(1) lookups and a doubly linked list for O(1) recency tracking. When the cache is full, I evict the least recently used item.

## 0) Two-Line Design Framing

- We need a fixed-size cache where the most recently accessed items are kept and the least recently used are evicted.
- Correctness means every get and put operation is O(1), eviction removes the actual least recently used item, and the cache never exceeds capacity.

## 1) Requirements and Constraints

- O(1) time complexity for both get and put.
- Fixed capacity — never store more than N items.
- On cache full, evict the least recently used item.
- Support both read-through (get promotes to most recent) and write-through (put adds as most recent).
- Thread-safe version for concurrent access.
- Optional: TTL support for automatic expiration.

## 2) Objects and Responsibilities

| Object | Responsibility |
|---|---|
| `Node` | Doubly linked list node storing key, value, and prev/next pointers |
| `LRUCache` | Hash map + doubly linked list for O(1) get/put/evict |
| `ThreadSafeLRUCache` | Wrapper with locking for concurrent access |

## 3) Class/API Design

```text
LRUCache(capacity)
LRUCache.get(key) -> value or None
LRUCache.put(key, value) -> None
LRUCache.size() -> int
LRUCache.stats() -> (hits, misses, evictions)
```

## 4) Core Workflow

**get(key)**:
1. Look up key in hash map.
2. If found: move node to head of linked list (most recent), return value.
3. If not found: return None.

**put(key, value)**:
1. If key exists: update value, move to head.
2. If key does not exist: create new node, add to head.
3. If size exceeds capacity: remove tail node (least recent), delete from hash map.

## 5) Invariants

- **invariant**: cache size never exceeds capacity.
- **invariant**: the tail of the linked list is always the least recently accessed item.
- **invariant**: every key in the hash map has a corresponding node in the linked list.
- **invariant**: every node in the linked list has a corresponding entry in the hash map.

## 6) Edge Cases

- **edge case**: get on empty cache → returns None.
- **edge case**: put when cache is at capacity → evicts LRU, adds new item.
- **edge case**: put with existing key → updates value without changing size.
- **edge case**: get followed by eviction — the got item should NOT be evicted (it was just used).
- **edge case**: capacity of 1 → every new put evicts the previous item.
- **edge case**: capacity of 0 → every put is immediately evicted (degenerate case).

## 7) Python Implementation Sketch

### Manual doubly linked list (no OrderedDict)

```python
class Node:
    """Doubly linked list node for the LRU cache."""

    __slots__ = ('key', 'value', 'prev', 'next', 'expires_at')

    def __init__(self, key, value, expires_at=0):
        self.key = key
        self.value = value
        self.prev = None
        self.next = None
        self.expires_at = expires_at


class LRUCache:
    """LRU cache using hash map + doubly linked list.

    All operations are O(1).
    Uses sentinel head/tail nodes to simplify edge cases.
    """

    def __init__(self, capacity):
        self.capacity = capacity
        self.cache = {}  # key -> Node

        # Sentinel nodes simplify add/remove logic.
        # head.next is the most recently used.
        # tail.prev is the least recently used.
        self.head = Node("_head", "_head")
        self.tail = Node("_tail", "_tail")
        self.head.next = self.tail
        self.tail.prev = self.head

        # Statistics
        self.hits = 0
        self.misses = 0
        self.evictions = 0

    def get(self, key):
        """Get value by key. Returns None if not found.

        Moves the accessed node to the head (most recent).
        """
        node = self.cache.get(key)
        if node is None:
            self.misses += 1
            return None

        # Check TTL expiration.
        if node.expires_at > 0:
            import time
            if time.time() > node.expires_at:
                self._remove_node(node)
                del self.cache[key]
                self.misses += 1
                return None

        # Move to head (most recently used).
        self._remove_node(node)
        self._add_to_head(node)
        self.hits += 1
        return node.value

    def put(self, key, value, ttl_seconds=0):
        """Add or update a key-value pair.

        If the cache is at capacity, evicts the LRU item.
        """
        if key in self.cache:
            # Update existing node.
            node = self.cache[key]
            node.value = value
            if ttl_seconds > 0:
                import time
                node.expires_at = time.time() + ttl_seconds
            self._remove_node(node)
            self._add_to_head(node)
            return

        # Create new node.
        import time
        expires_at = time.time() + ttl_seconds if ttl_seconds > 0 else 0
        node = Node(key, value, expires_at)
        self.cache[key] = node
        self._add_to_head(node)

        # Evict if over capacity.
        if len(self.cache) > self.capacity:
            self._evict_lru()

    def size(self):
        """Return current cache size."""
        return len(self.cache)

    def stats(self):
        """Return cache statistics."""
        total = self.hits + self.misses
        hit_rate = self.hits / total if total > 0 else 0
        return {
            "hits": self.hits,
            "misses": self.misses,
            "evictions": self.evictions,
            "size": len(self.cache),
            "capacity": self.capacity,
            "hit_rate": round(hit_rate, 3)
        }

    def _add_to_head(self, node):
        """Add node right after the head sentinel."""
        node.prev = self.head
        node.next = self.head.next
        self.head.next.prev = node
        self.head.next = node

    def _remove_node(self, node):
        """Remove node from its current position."""
        node.prev.next = node.next
        node.next.prev = node.prev

    def _evict_lru(self):
        """Remove the least recently used item (tail.prev)."""
        lru = self.tail.prev
        if lru == self.head:
            return  # Empty cache
        self._remove_node(lru)
        del self.cache[lru.key]
        self.evictions += 1
```

### Thread-safe wrapper

```python
import threading


class ThreadSafeLRUCache:
    """Thread-safe wrapper around LRUCache."""

    def __init__(self, capacity):
        self._cache = LRUCache(capacity)
        self._lock = threading.Lock()

    def get(self, key):
        with self._lock:
            return self._cache.get(key)

    def put(self, key, value, ttl_seconds=0):
        with self._lock:
            self._cache.put(key, value, ttl_seconds)

    def size(self):
        with self._lock:
            return self._cache.size()

    def stats(self):
        with self._lock:
            return self._cache.stats()
```

## 8) Tests

- **Happy path**: put(1, "a"), get(1) returns "a".
- **Eviction**: Fill to capacity, add one more, LRU item is evicted.
- **Access preserves**: get(key) moves it to most recent, so it is not evicted next.
- **Update**: put(existing_key, new_value) updates without eviction.
- **Size**: size never exceeds capacity.
- **Stats**: hit rate, miss rate, and eviction count are accurate.
- **TTL**: Expired items return None on get.
- **Thread safety**: Concurrent get/put operations do not corrupt state.
- **Capacity 1**: Every new put evicts the previous item.

## 9) Follow-up Interview Questions

**Q: Why not use Python's OrderedDict?**  
A: OrderedDict works but hides the data structure. In an interview, showing the manual linked list proves you understand the O(1) implementation. In production, OrderedDict is a reasonable choice for simplicity.

**Q: How do you handle TTL?**  
A: Store an expires_at timestamp on each node. Check expiration on get(). For proactive cleanup, run a background sweep periodically to remove expired entries (lazy eviction on read + periodic sweep).

**Q: How would you make this distributed?**  
A: Use Redis with its built-in LRU eviction policy (maxmemory-policy allkeys-lru). Redis handles the LRU algorithm internally with approximation sampling.

## 10) Tradeoffs and Wrap

Manual linked list + hash map gives O(1) for all operations and clear LRU semantics. The tradeoff is implementation complexity compared to using OrderedDict. For production, I would add: TTL support, hit rate monitoring, memory usage tracking, and configurable eviction policies (LRU, LFU, FIFO).

## Beginner Deep Dive: LRU Cache

<div class="class-demo">
  <div class="class-card"><strong>Node</strong>Stores a key-value pair with prev/next pointers. Lives in both the hash map and the linked list.</div>
  <div class="class-card"><strong>LRUCache</strong>Hash map for O(1) lookup + doubly linked list for O(1) recency ordering. Sentinel nodes simplify edge cases.</div>
  <div class="class-card"><strong>ThreadSafeLRUCache</strong>Wraps LRUCache with a lock. All operations acquire the lock before reading or modifying state.</div>
</div>

### What The Design Is Protecting

The main **invariant** is that the cache never exceeds capacity and always evicts the actual least recently used item. This guarantees predictable memory usage while keeping the most useful data in fast storage.

### Why Two Data Structures

A hash map alone gives O(1) lookup but does not track recency. A linked list alone tracks recency but gives O(n) lookup. Using both together gives O(1) for everything.

The hash map maps key → node. The linked list orders nodes by recency. When we access a node, we remove it from its current position (O(1) because we have prev/next pointers) and add it to the head (O(1) because we have the head sentinel).

### Sentinel Nodes Explained

Without sentinels, every add/remove operation needs special cases for empty list, single item, adding to empty head, and removing the last item. With sentinel head and tail nodes, these cases disappear because every real node always has a non-null prev and next.

### Why __slots__

`__slots__ = ('key', 'value', 'prev', 'next', 'expires_at')` tells Python to use a fixed memory layout instead of a dictionary for instance attributes. This saves about 40 bytes per node, which matters when the cache holds millions of items.

### Failure and Safe Defaults

If the cache is unavailable, the system should fall back to the underlying database with a higher latency. Cache failure should never cause data loss or incorrect results — it only causes slower performance.
