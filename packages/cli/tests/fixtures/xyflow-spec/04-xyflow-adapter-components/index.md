---
title: "04 xyflow Adapter & Components"
---


## Purpose


This page defines the xyflow adapter and component layer.


The xyflow viewer is the final interactive product surface. It must use the same `VisualizationSnapshot` and layout core as the terminal viewer.


## Adapter files


Create:


```plain text
apps/viewer/src/xyflow/adapter/toReactFlowNodes.ts
apps/viewer/src/xyflow/adapter/toReactFlowEdges.ts
apps/viewer/src/xyflow/adapter/applyLayoutPatch.ts
apps/viewer/src/xyflow/adapter/lanePolicy.ts
apps/viewer/src/xyflow/adapter/nodeTypes.ts
apps/viewer/src/xyflow/adapter/edgeTypes.ts
```


## Node adapter


Input:


```typescript
VisualizationSnapshot
```


Output:


```typescript
Node[]
```


Rules:

- Generate lane group nodes first.
- Generate occurrence nodes after lane nodes.
- Occurrence node must use lane-relative position.
- Occurrence node must be child of the corresponding lane group node.
- Occurrence node must use `extent: "parent"`.

Required lane node ids:


```plain text
lane:shared
lane:commandViewModel
lane:event
```


## Edge adapter


Input:


```typescript
VisualizationSnapshot
```


Output:


```typescript
Edge[]
```


Rules:

- Edge id equals `displayEdgeId`.
- Edge source equals `fromOccurrenceId`.
- Edge target equals `toOccurrenceId`.
- Edge type equals `em.orthogonal`.
- Edge data includes `points`.
- Do not use `getSmoothStepPath()` as the source of truth.

## Patch adapter


Create:


```typescript
function applyLayoutPatchToReactFlow(args: {
  patch: LayoutPatch
  previousNodes: Node[]
  previousEdges: Edge[]
  snapshotContext: SnapshotContext
}): {
  nodes: Node[]
  edges: Edge[]
}
```


Rules:

- Upsert added occurrences.
- Upsert updated occurrences.
- Upsert added edges.
- Upsert updated edges.
- Update lane group nodes when `updatedSwimlaneRects` changes.
- Do not regenerate all nodes.
- Preserve selected state when possible.

## xyflow components


Create:


```plain text
apps/viewer/src/xyflow/components/XyflowCanvas.tsx
apps/viewer/src/xyflow/components/SwimlaneGroupNode.tsx
apps/viewer/src/xyflow/components/CommandNode.tsx
apps/viewer/src/xyflow/components/EventNode.tsx
apps/viewer/src/xyflow/components/ViewModelNode.tsx
apps/viewer/src/xyflow/components/SharedNode.tsx
apps/viewer/src/xyflow/components/OrthogonalDisplayEdge.tsx
apps/viewer/src/xyflow/components/FrontierHandleNode.tsx
```


## `XyflowCanvas`


Required features:

- Uses `ReactFlow`.
- Uses `Background`.
- Uses `Controls`.
- Uses `MiniMap`.
- Registers stable `nodeTypes`.
- Registers stable `edgeTypes`.
- Receives `VisualizationSnapshot`.
- Receives and applies `LayoutPatch`.

## `SwimlaneGroupNode`


Required behavior:

- Renders lane label.
- Renders lane background.
- Has no handles.
- Is not draggable.
- Is not connectable.
- Visually supports dynamic width / height.

## Occurrence nodes


Required node types:


```plain text
em.cmd
em.evt
em.viewModel
em.ui
em.trigger
em.proc
em.shared
```


Required display:

- display name from domain node.
- canonical id fallback.
- node kind badge.
- selected style.
- lock state if present.

Node components must not:

- compute layout.
- query all graph state.
- mutate domain model.

## Orthogonal edge


Required behavior:

- Uses React Flow `BaseEdge` with a path helper.
- Receives arrow marker config from the edge adapter.
- Styles by `DisplayEdgeKind`.
