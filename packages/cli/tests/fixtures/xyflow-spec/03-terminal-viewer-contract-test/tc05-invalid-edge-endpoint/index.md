---
title: "TC05 Invalid Edge Endpoint"
---


## Purpose


This test case covers an invalid edge endpoint.


## Fixture pages


## Functions under test


```typescript
renderLayoutAscii(snapshot: VisualizationSnapshot): string
renderLayoutTable(snapshot: VisualizationSnapshot): string
```


## Coverage


This case verifies:

- an edge referencing a missing occurrence is detected.
- `all edges have endpoints` returns `FAIL`.
- other invariant lines remain independently evaluated.
- renderer does not crash.

## Acceptance

- `renderLayoutAscii(input)` exactly equals output ASCII fixture.
- `renderLayoutTable(input)` exactly equals output table fixture.
