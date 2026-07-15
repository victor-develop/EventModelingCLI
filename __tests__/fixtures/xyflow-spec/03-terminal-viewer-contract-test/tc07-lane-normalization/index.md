---
title: "TC07 Lane Normalization"
notion_id: ad0327dc-a893-4d2b-81e1-ffea3ff65010
synced_at: 2026-07-03T13:43:34.700Z
---


## Purpose


This test case covers lane normalization.


## Fixture pages


## Functions under test


```typescript
renderLayoutAscii(snapshot: VisualizationSnapshot): string
renderLayoutTable(snapshot: VisualizationSnapshot): string
```


## Coverage


This case verifies:

- `nonRole` normalizes to `shared`.
- `role:*` remains a distinct visible role lane.
- role lanes and shared/system lanes render separately.
- terminal output uses visible lane labels.
- invariant summary passes.

## Acceptance

- `renderLayoutAscii(input)` exactly equals [Output — ASCII Graph](https://app.notion.com/p/8a31fa933fb8409c9de378133466be38).
- `renderLayoutTable(input)` exactly equals [Output — Table](https://app.notion.com/p/0a3b9a2108bb410cb664ab000f9723b5).
