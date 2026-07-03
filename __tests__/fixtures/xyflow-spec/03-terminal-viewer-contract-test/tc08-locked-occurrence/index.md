---
title: "TC08 Locked Occurrence"
notion_id: 1f410616-4406-4613-b6ec-a24f4b74a122
synced_at: 2026-07-03T13:43:36.397Z
---


## Purpose


This test case covers locked occurrence rendering.


## Fixture pages


## Functions under test


```typescript
renderLayoutAscii(snapshot: VisualizationSnapshot): string
renderLayoutTable(snapshot: VisualizationSnapshot): string
```


## Coverage


This case verifies:

- `lockLevel: "hard"` appears in table output.
- ASCII output marks locked node.
- locked occurrence is still included in invariant checks.
- invariant summary passes.

## Acceptance

- `renderLayoutAscii(input)` exactly equals [Output — ASCII Graph](https://app.notion.com/p/334c1bd614c44a72816f31ff9aca270a).
- `renderLayoutTable(input)` exactly equals [Output — Table](https://app.notion.com/p/e376e4d8fdf74a0c815430d9b52ca6b1).
