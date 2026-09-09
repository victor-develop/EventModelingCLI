---
title: "02 VisualizationSnapshot Contract"
---


## Purpose


This page defines the renderer-agnostic interface shared by the CLI, server, terminal viewer, tests, and xyflow viewer.


## `VisualizationSnapshot`


Recommended location:


```plain text
packages/cli/src/viewer-contract/types.ts
```


Required type:


```typescript
import type { Node, Edge } from '../domain/types'
import type {
  LayoutState,
  Occurrence,
  RenderedEdge,
  SwimlaneRect,
} from '../layout/types'

export type VisualizationSnapshot = {
  focusNodeId: string
  projectName: string
  layoutState: LayoutState
  occurrences: Occurrence[]
  renderedEdges: RenderedEdge[]
  swimlaneRects: SwimlaneRect[]
  domainNodes: Record<string, Node>
  domainEdges: Record<string, Edge>
  laneMap: Record<string, string>
}
```


Rules:

- This module must not import React.
- This module must not import `@xyflow/react`.
- This contract is the stable API between CLI/server/layout, terminal viewer, tests, and xyflow viewer.

## `buildVisualizationSnapshot()`


Recommended location:


```plain text
packages/cli/src/viewer-contract/buildVisualizationSnapshot.ts
```


Required API:


```typescript
export function buildVisualizationSnapshot(args: {
  workspace: Workspace
  focus: string
  direction?: 'forward' | 'backward' | 'both'
  hops?: number
}): VisualizationSnapshot
```


Required behavior:

- Resolve focus node by canonical id.
- Walk graph according to `direction` and `hops`.
- Build `NormalizedPathEnvelope`.
- Call `LayoutEngine.initLayout()`.
- Collect domain nodes and edges used by the snapshot.
- Return `VisualizationSnapshot`.

## `/api/layout`


Add endpoint:


```plain text
GET /api/layout?focus=<canonicalId>&direction=both&hops=2
```


Required response:


```typescript
VisualizationSnapshot
```


Required behavior:

- Delegate to `buildVisualizationSnapshot()`.
- Return structured errors.

Error behavior:

- If no active project: structured error.
- If focus node not found: 404 or structured `NOT_FOUND`.
- If layout produces no branches: return empty but valid snapshot.

## Lane policy


MVP uses exactly three visible lanes:


```plain text
shared
commandViewModel
event
```


Current layout code may produce:


```plain text
nonRole
commandViewModel
event
role:*
```


Required mapping:


```typescript
export type VisibleLane = 'shared' | 'commandViewModel' | 'event'

export function toVisibleLane(lane: string): VisibleLane {
  if (lane === 'nonRole') return 'shared'
  if (lane.startsWith('role:')) return 'shared'
  if (lane === 'commandViewModel') return 'commandViewModel'
  if (lane === 'event') return 'event'
  return 'shared'
}
```


Required lane labels:


```plain text
shared
command / viewModel
event
```


Required lane order:

1. `shared`
2. `commandViewModel`
3. `event`
