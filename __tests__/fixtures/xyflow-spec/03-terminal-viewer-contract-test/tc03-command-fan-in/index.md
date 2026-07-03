---
title: "TC03 Command Fan-in"
notion_id: 9c637fdc-39a7-4382-9d38-029ce899d7c5
synced_at: 2026-07-03T13:43:24.347Z
---


## Purpose


This test case covers multiple commands converging into one event.


## Fixture pages


## Functions under test


```typescript
renderLayoutAscii(snapshot: VisualizationSnapshot): string
renderLayoutTable(snapshot: VisualizationSnapshot): string
```


## Coverage


This case verifies:

- two command occurrences can point to the same event occurrence.
- command lane contains multiple rows.
- edge summary remains deterministic.
- invariant summary passes.

## Acceptance

- `renderLayoutAscii(input)` exactly equals [Output — ASCII Graph](https://app.notion.com/p/7f20c1ca08e649458f2ca830dd77b976).
- `renderLayoutTable(input)` exactly equals [Output — Table](https://app.notion.com/p/bf6f837f96e6464ca0aabf48c1114639).
