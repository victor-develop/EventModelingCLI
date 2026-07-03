---
title: "TC01 Minimal Linear Flow"
notion_id: d3d7af4d-4882-4c6a-be8e-2b3f000029ab
synced_at: 2026-07-03T13:43:20.828Z
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

- `renderLayoutAscii(input)` exactly equals [Output — ASCII Graph](https://app.notion.com/p/bff068dfe3d04a7a8caf60fc998d511e).
- `renderLayoutTable(input)` exactly equals [Output — Table](https://app.notion.com/p/83dc39a031f54afb9260709af223435e).
