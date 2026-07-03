---
title: "Contract Tests — Layout API"
notion_id: cee937b5-1b11-4683-a7a0-ae4d22400942
synced_at: 2026-07-03T13:43:10.621Z
---


## Purpose


Contract tests for API endpoints used by the visualization engine.


## Design decision


`/api/layout` must **not** shell out to the CLI command process and must **not** parse CLI text output.


It should be based on the same internal implementation modules that the CLI already uses:


```plain text
Workspace
  -> ws.listNodes() / ws.listEdges()
  -> buildGraph()
  -> walkGraph()
  -> NormalizedPathEnvelope
  -> LayoutEngine.initLayout()
  -> VisualizationSnapshot
```


The correct refactor is:


```plain text
shared library function
  -> used by em layout --format json/table/ascii
  -> used by GET /api/layout
  -> used by headless contract tests
```


Recommended shared module:


```plain text
src/viewer-contract/buildVisualizationSnapshot.ts
```


Recommended API:


```typescript
export function buildVisualizationSnapshot(args: {
  workspace: Workspace
  focus: string
  direction?: 'forward' | 'backward' | 'both'
  hops?: number
}): VisualizationSnapshot
```


Then:

- `em layout --format json` calls `buildVisualizationSnapshot()` and prints JSON.
- `em layout --format table` calls `buildVisualizationSnapshot()` and then `renderLayoutTable()`.
- `em layout --format ascii` calls `buildVisualizationSnapshot()` and then `renderLayoutAscii()`.
- `GET /api/layout` calls `buildVisualizationSnapshot()` and returns JSON.

This prevents drift between CLI behavior and HTTP behavior.


## Existing code assessment


Current repository structure already has the needed lower-level modules:


```plain text
src/workspace/workspace.ts
src/graph/graph-builder.ts
src/layout/layout-engine.ts
src/cli/commands.ts
src/cli/serve.ts
```


Current `src/cli/serve.ts` already exposes:


```plain text
GET /api/roots
GET /api/init?focus=<canonicalId>
GET /api/walk?from=<canonicalId>&direction=forward|backward|both&hops=<n>
```


Current `src/cli/commands.ts` already has `layout(ws, focusNodeId, direction, maxHops)`, but that command currently returns a CLI-shaped result:


```plain text
{
  layout: {
    nodes,
    edges,
    viewport
  }
}
```


That is not enough for the viewer contract because it omits:

- `layoutState`
- `occurrences`
- `renderedEdges`
- `swimlaneRects`
- `domainNodes`
- `domainEdges`
- `laneMap`

So `/api/layout` should not simply proxy the current `em layout` result. Instead, extract the shared layout-building logic into `buildVisualizationSnapshot()` and make both the CLI command and HTTP API call it.


## Required refactor of current layout command


Yes: the current layout command should be **refactored**, not duplicated and not fully discarded.


Current implementation location:


```plain text
src/cli/commands.ts
export function layout(ws, focusNodeId, direction, maxHops)
```


Current responsibility problem:

- it performs graph loading.
- it performs graph walking.
- it builds `NormalizedPathEnvelope`.
- it calls `LayoutEngine.initLayout()`.
- it formats the result into a CLI-specific shape.

That means it mixes two concerns:

1. **layout snapshot construction**.
2. **CLI response formatting**.

The refactor should split those concerns.


Target structure:


```plain text
src/viewer-contract/buildVisualizationSnapshot.ts
  owns graph -> walk -> envelope -> LayoutEngine -> VisualizationSnapshot

src/terminal-viewer/renderLayoutTable.ts
  owns VisualizationSnapshot -> deterministic table string

src/terminal-viewer/renderLayoutAscii.ts
  owns VisualizationSnapshot -> deterministic ASCII string

src/cli/commands.ts layout()
  becomes a thin command wrapper

src/cli/serve.ts /api/layout
  becomes a thin HTTP wrapper
```


Required new dependency direction:


```plain text
commands.ts layout()
  -> buildVisualizationSnapshot()
  -> renderLayoutTable() / renderLayoutAscii() / JSON

serve.ts /api/layout
  -> buildVisualizationSnapshot()
  -> res.json(snapshot)
```


Do **not** keep the current layout logic as the canonical implementation inside `src/cli/commands.ts`.


Do **not** copy/paste that logic into `src/cli/serve.ts`.


Do **not** delete `LayoutEngine` or rewrite `src/layout/layout-engine.ts` as part of this refactor.


`LayoutEngine` remains the layout core. The refactor is around the CLI command wrapper and the new viewer contract builder.


Recommended migration steps:

1. Move the graph/walk/envelope/layout-state construction from `commands.ts layout()` into `buildVisualizationSnapshot()`.
2. Make `commands.ts layout()` call `buildVisualizationSnapshot()`.
3. Add `--format json | table | ascii` handling in `commands.ts layout()`.
4. Make `serve.ts` expose `/api/layout` by calling `buildVisualizationSnapshot()`.
5. Keep existing `/api/init` and `/api/walk` temporarily for current viewer compatibility.
6. Mark `/api/init` as legacy once `em-viewer` fully migrates to `/api/layout`.

Acceptance criteria for this refactor:

- only one module constructs `VisualizationSnapshot`.
- CLI and HTTP layout outputs come from the same builder.
- `src/layout/**` remains renderer-agnostic.
- `commands.ts layout()` no longer manually builds occurrence/edge output.
- `/api/layout` does not shell out to CLI.
- `/api/layout` does not parse CLI output.
- tests cover both direct builder output and HTTP output.

## Endpoint under test


```plain text
GET /api/layout?focus=<canonicalId>&direction=both&hops=2
```


## Related existing endpoints


```plain text
GET /api/roots
GET /api/walk?from=<canonicalId>&direction=forward&hops=3
```


## Test case structure


```plain text
TCxx Scenario
  ├── Input — HTTP Request
  └── Output — HTTP Response
```


## Testing rule


API contract tests must run without a browser.


Preferred approach:


```typescript
const app = createServerApp(workspace)
const res = await request(app).get('/api/layout?focus=cmd.submit-order&direction=both&hops=2')
expect(res.status).toBe(200)
expect(res.body).toEqual(expected)
```


`src/cli/serve.ts` should therefore be refactored into:


```typescript
export function createServerApp(ws: Workspace): express.Express
export function startServer(ws: Workspace, opts?: { port?: number }): Promise<void>
```


`startServer()` should only create the app and call `listen()`.


If `supertest` is unavailable, test `buildVisualizationSnapshot()` directly.


## Implementation rule


Do this:


```plain text
HTTP route -> buildVisualizationSnapshot() -> response.json(snapshot)
CLI command -> buildVisualizationSnapshot() -> formatter -> stdout
```


Do not do this:


```plain text
HTTP route -> spawn em layout -> parse stdout -> response.json(...)
```


Do not do this either:


```plain text
HTTP route and CLI command each reimplement graph walk + layout separately
```


The single source of truth is the shared builder module.

