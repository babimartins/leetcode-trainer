## Intuition

Explore a graph by following edges. BFS expands in layers (shortest path in
unweighted graphs); DFS dives deep first (connectivity, cycles, topological
order).

## When to reach for it

- grids or adjacency lists, "number of islands / regions / components"
- shortest path in an **unweighted** graph → BFS
- reachability, cycle detection, ordering → DFS

## Template

```python
from collections import deque

def bfs(start, neighbors):
    seen = {start}
    q = deque([start])
    while q:
        node = q.popleft()
        for nxt in neighbors(node):
            if nxt not in seen:
                seen.add(nxt)
                q.append(nxt)
    return seen
```

## Complexity

- Time: O(V + E).
- Space: O(V) for the visited set and frontier.

## Common pitfalls

- Marking visited when dequeuing instead of when enqueuing (BFS) — can revisit.
- Forgetting bounds/visited checks on grid neighbors.

> Sample content — replace with your own deep notes over time.
