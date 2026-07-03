---
title: "TC05 Invalid Edge Endpoint"
notion_id: 59bca7a4-9dab-4333-89da-8c5377a73bc7
synced_at: 2026-07-03T13:43:31.197Z
---


## Purpose


This test case covers an invalid edge endpoint.


## Fixture pages


## Functions under test


```typescript
renderLayoutAscii(snapshot: VisualizationSnapshot): string
renderLayoutTable(snapshot: VisualizationSnapshot): string
```


## Coverage


This case verifies:

- an edge referencing a missing occurrence is detected.
- `all edges have endpoints` returns `FAIL`.
- other invariant lines remain independently evaluated.
- renderer does not crash.

## Acceptance

- `renderLayoutAscii(input)` exactly equals [Output — ASCII Graph](https://app.notion.com/p/83a67dfc82f24f8bb890d3f762df7a5a).
- `renderLayoutTable(input)` exactly equals [Output — Table](https://app.notion.com/p/0ec77c407c9b4e07831d158ff91a46b8).
