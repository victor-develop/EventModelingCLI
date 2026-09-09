---
title: "TC02 Event Fan-out"
---


## Purpose


This test case covers event fan-out from one command/event path into two downstream view models.


## Fixture pages


## Functions under test


```typescript
renderLayoutAscii(snapshot: VisualizationSnapshot): string
renderLayoutTable(snapshot: VisualizationSnapshot): string
```


## Coverage


This case verifies:

- one event can fan out to multiple downstream view models.
- multiple nodes can exist in the same lane at different rows.
- ASCII graph can show branch connectors.
- edge summary remains machine-checkable.
- invariant summary passes.

## Acceptance

- `renderLayoutAscii(input)` exactly equals output ASCII fixture.
- `renderLayoutTable(input)` exactly equals output table fixture.
