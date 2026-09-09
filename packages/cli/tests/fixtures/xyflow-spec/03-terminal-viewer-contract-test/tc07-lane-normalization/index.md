---
title: "TC07 Lane Normalization"
---


## Purpose


This test case covers lane normalization.


## Fixture pages


## Functions under test


```typescript
renderLayoutAscii(snapshot: VisualizationSnapshot): string
renderLayoutTable(snapshot: VisualizationSnapshot): string
```


## Coverage


This case verifies:

- `nonRole` normalizes to `shared`.
- `role:*` remains a distinct visible role lane.
- role lanes and shared/system lanes render separately.
- terminal output uses visible lane labels.
- invariant summary passes.

## Acceptance

- `renderLayoutAscii(input)` exactly equals output ASCII fixture.
- `renderLayoutTable(input)` exactly equals output table fixture.
