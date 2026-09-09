---
title: "Contract Tests — VisualizationSnapshot Builder"
---


## Purpose


Contract tests for `buildVisualizationSnapshot()`.


These tests verify the renderer-agnostic contract between:

- workspace / graph builder.
- layout core.
- terminal viewer.
- xyflow adapter.
- API server.

## Function under test


```typescript
export function buildVisualizationSnapshot(args: {
  workspace: Workspace
  focus: string
  direction?: 'forward' | 'backward' | 'both'
  hops?: number
}): VisualizationSnapshot
```


## Test case structure


```plain text
TCxx Scenario
  ├── Input — Workspace Fixture
  └── Output — VisualizationSnapshot
```


## Required coverage

- happy path snapshot build.
- missing focus error.
- empty walk result returns valid empty snapshot.
- lane normalization is preserved for consumers.
- every returned edge endpoint exists or is explicitly represented as invalid for invariant tests.
