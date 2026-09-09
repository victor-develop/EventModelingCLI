---
title: "Contract Tests — xyflow Adapter"
---


## Purpose


Contract tests for converting `VisualizationSnapshot` into React Flow nodes and edges.


These tests are object-level tests. They must not mount React Flow or open a browser.


## Functions under test


```typescript
export function toReactFlowNodes(snapshot: VisualizationSnapshot): Node[]
export function toReactFlowEdges(snapshot: VisualizationSnapshot): Edge[]
```


## Test case structure


```plain text
TCxx Scenario
  ├── Input — VisualizationSnapshot
  ├── Output — React Flow Nodes
  └── Output — React Flow Edges
```


## Required coverage

- lane group nodes are emitted before occurrence child nodes.
- occurrence child nodes use `parentId`.
- occurrence child nodes use `extent: "parent"`.
- occurrence positions are lane-relative.
- edge endpoints reference existing occurrence node ids.
- edge data contains layout core route `points`.
