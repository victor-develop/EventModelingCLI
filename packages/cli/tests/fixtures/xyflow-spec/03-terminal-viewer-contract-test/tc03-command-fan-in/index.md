---
title: "TC03 Command Fan-in"
---


## Purpose


This test case covers multiple commands converging into one event.


## Fixture pages


## Functions under test


```typescript
renderLayoutAscii(snapshot: VisualizationSnapshot): string
renderLayoutTable(snapshot: VisualizationSnapshot): string
```


## Coverage


This case verifies:

- two command occurrences can point to the same event occurrence.
- command lane contains multiple rows.
- edge summary remains deterministic.
- invariant summary passes.

## Acceptance

- `renderLayoutAscii(input)` exactly equals output ASCII fixture.
- `renderLayoutTable(input)` exactly equals output table fixture.
