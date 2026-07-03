---
title: "TC06 Non-LTR Edge Route"
notion_id: 6f8cbf50-6332-4441-9315-00839fb96fd6
synced_at: 2026-07-03T13:43:32.931Z
---


## Purpose


This test case covers a non-left-to-right route.


## Fixture pages


## Functions under test


```typescript
renderLayoutAscii(snapshot: VisualizationSnapshot): string
renderLayoutTable(snapshot: VisualizationSnapshot): string
```


## Coverage


This case verifies:

- an edge with final x less than initial x is detected.
- `left-to-right edges` returns `FAIL`.
- renderer still produces deterministic output.

## Acceptance

- `renderLayoutAscii(input)` exactly equals [Output — ASCII Graph](https://app.notion.com/p/d35d150f88664014aeb2902cf9e583eb).
- `renderLayoutTable(input)` exactly equals [Output — Table](https://app.notion.com/p/cecb4787828b436d83ad305b7e4f7830).
