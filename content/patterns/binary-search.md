## Intuition

Repeatedly halve a sorted search space by comparing against the middle. The key
generalization for interviews is **binary search on the answer**: search over a
range of possible answers and test feasibility.

## When to reach for it

- the input is sorted, or the answer space is monotonic (a predicate flips from
  false to true exactly once)
- "minimum / maximum value such that some condition holds"

## Template

```python
def lower_bound(lo, hi, ok):
    # smallest x in [lo, hi] with ok(x) True; assumes monotonic ok
    while lo < hi:
        mid = (lo + hi) // 2
        if ok(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo
```

## Complexity

- Time: O(log n) comparisons (times the cost of `ok`).
- Space: O(1).

## Common pitfalls

- Infinite loops from the wrong `mid` rounding with `lo = mid`.
- Searching an answer space that isn't actually monotonic.

> Sample content — replace with your own deep notes over time.
