---
title: "TC01 Minimal Linear Flow"
---


## Purpose


This test case covers the minimal happy-path Event Modeling flow:


```plain text
UI -> command -> event -> view model
```


## Fixture pages


## Functions under test


```typescript
renderLayoutAscii(snapshot: VisualizationSnapshot): string
renderLayoutTable(snapshot: VisualizationSnapshot): string
```


## Coverage


This case verifies:

- three visible lanes exist.
- one occurrence appears in `shared`.
- command and view model appear in `commandViewModel`.
- event appears in `event`.
- edge directions are left-to-right.
- invariant summary passes.

## Acceptance

- `renderLayoutAscii(input)` exactly equals output ASCII fixture.
- `renderLayoutTable(input)` exactly equals output table fixture.
