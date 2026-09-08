---
title: "TC08 Locked Occurrence"
---


## Purpose


This test case covers locked occurrence rendering.


## Fixture pages


## Functions under test


```typescript
renderLayoutAscii(snapshot: VisualizationSnapshot): string
renderLayoutTable(snapshot: VisualizationSnapshot): string
```


## Coverage


This case verifies:

- `lockLevel: "hard"` appears in table output.
- ASCII output marks locked node.
- locked occurrence is still included in invariant checks.
- invariant summary passes.

## Acceptance

- `renderLayoutAscii(input)` exactly equals output ASCII fixture.
- `renderLayoutTable(input)` exactly equals output table fixture.
