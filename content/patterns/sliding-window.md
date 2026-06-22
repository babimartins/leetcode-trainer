## Intuition

Maintain a contiguous window over the sequence and slide it instead of
recomputing from scratch. Each element enters and leaves the window at most
once, so the whole scan is linear time.

## When to reach for it

- "longest / shortest / max / min **contiguous** subarray or substring…"
- a window constraint you can grow and shrink (sum ≤ k, at most K distinct
  characters, no repeats)
- brute force is O(n·k) and recomputes overlapping work

## Template

```python
def slide(s):
    left = 0
    best = 0
    for right in range(len(s)):
        # add s[right] to the window
        while window_is_invalid():
            # remove s[left] from the window
            left += 1
        best = max(best, right - left + 1)
    return best
```

## Complexity

- Time: O(n) — each index is added and removed at most once.
- Space: O(k) — proportional to the window's contents.

## Common pitfalls

- Forgetting to shrink the window, which silently turns the scan into O(n²).
- Updating the answer before the window is valid again.
- Off-by-one when the window size is fixed vs. variable.

> Sample content — replace with your own deep notes over time.
