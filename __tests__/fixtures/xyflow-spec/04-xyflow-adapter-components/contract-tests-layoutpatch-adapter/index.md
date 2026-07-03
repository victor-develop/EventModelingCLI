---
title: "Contract Tests — LayoutPatch Adapter"
notion_id: 164d5c82-e0c8-4bd2-9f2f-b9ecc2339231
synced_at: 2026-07-03T13:43:43.050Z
---


## Purpose


Contract tests for applying `LayoutPatch` to React Flow state.


These tests verify incremental exploration without a full relayout.


## Function under test


```typescript
export function applyLayoutPatchToReactFlow(args: {
  patch: LayoutPatch
  previousNodes: Node[]
  previousEdges: Edge[]
  snapshotContext: SnapshotContext
}): {
  nodes: Node[]
  edges: Edge[]
}
```


## Test case structure


```plain text
TCxx Scenario
  ├── Input — Previous React Flow State
  ├── Input — LayoutPatch
  └── Output — Next React Flow State
```


## Required coverage

- added occurrences become new React Flow nodes.
- updated occurrences update existing nodes.
- added rendered edges become new React Flow edges.
- lane group dimensions update from swimlane rect patches.
- stable old nodes preserve position and selection state.
- full node/edge regeneration is not required.
