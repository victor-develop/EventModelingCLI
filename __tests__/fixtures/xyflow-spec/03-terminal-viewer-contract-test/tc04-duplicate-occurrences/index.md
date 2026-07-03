---
title: "TC04 Duplicate Occurrences"
notion_id: 389b8bbe-58ce-4c68-8ff8-1996147c4903
synced_at: 2026-07-03T13:43:26.083Z
---


## Purpose


This test case covers duplicate occurrences of the same canonical node.


## Fixture pages


## Functions under test


```typescript
renderLayoutAscii(snapshot: VisualizationSnapshot): string
renderLayoutTable(snapshot: VisualizationSnapshot): string
```


## Coverage


This case verifies:

- two occurrences can share the same `canonicalNodeId`.
- occurrence ids remain unique.
- ASCII output shows both occurrences exactly once.
- table output preserves both rows.
- invariant summary passes.

## Acceptance

- `renderLayoutAscii(input)` exactly equals [Output — ASCII Graph](https://app.notion.com/p/947d8bb6c37b4905a944345bb75a830f).
- `renderLayoutTable(input)` exactly equals [Output — Table](https://app.notion.com/p/46258d5db09c4f3d93001b361a3d10d7).
