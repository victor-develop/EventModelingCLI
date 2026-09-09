---
title: "TC04 Duplicate Occurrences"
---


## Purpose


This test case covers duplicate occurrences of the same canonical node.


## Fixture pages


## Functions under test


```typescript
renderLayoutAscii(snapshot: VisualizationSnapshot): string
renderLayoutTable(snapshot: VisualizationSnapshot): string
```


## Coverage


This case verifies:

- two occurrences can share the same `canonicalNodeId`.
- occurrence ids remain unique.
- ASCII output shows both occurrences exactly once.
- table output preserves both rows.
- invariant summary passes.

## Acceptance

- `renderLayoutAscii(input)` exactly equals output ASCII fixture.
- `renderLayoutTable(input)` exactly equals output table fixture.
