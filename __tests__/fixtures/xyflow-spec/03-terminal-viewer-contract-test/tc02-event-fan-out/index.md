---
title: "TC02 Event Fan-out"
notion_id: 429576bc-2cbe-41bb-ba1d-a560316dbe25
synced_at: 2026-07-03T13:43:22.651Z
---


## Purpose


This test case covers event fan-out from one command/event path into two downstream view models.


## Fixture pages


## Functions under test


```typescript
renderLayoutAscii(snapshot: VisualizationSnapshot): string
renderLayoutTable(snapshot: VisualizationSnapshot): string
```


## Coverage


This case verifies:

- one event can fan out to multiple downstream view models.
- multiple nodes can exist in the same lane at different rows.
- ASCII graph can show branch connectors.
- edge summary remains machine-checkable.
- invariant summary passes.

## Acceptance

- `renderLayoutAscii(input)` exactly equals [Output — ASCII Graph](https://app.notion.com/p/8156fa7e901a47da9857ed42f07fea14).
- `renderLayoutTable(input)` exactly equals [Output — Table](https://app.notion.com/p/8ac4547a77094b18a3a2e8b5811010f1).
