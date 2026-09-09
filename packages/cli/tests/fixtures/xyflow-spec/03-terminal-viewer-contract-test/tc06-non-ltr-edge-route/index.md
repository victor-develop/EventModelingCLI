---
title: "TC06 Non-LTR Edge Route"
---


## Purpose


This test case covers a non-left-to-right route.


## Fixture pages


## Functions under test


```typescript
renderLayoutAscii(snapshot: VisualizationSnapshot): string
renderLayoutTable(snapshot: VisualizationSnapshot): string
```


## Coverage


This case verifies:

- an edge with final x less than initial x is detected.
- `left-to-right edges` returns `FAIL`.
- renderer still produces deterministic output.

## Acceptance

- `renderLayoutAscii(input)` exactly equals output ASCII fixture.
- `renderLayoutTable(input)` exactly equals output table fixture.
