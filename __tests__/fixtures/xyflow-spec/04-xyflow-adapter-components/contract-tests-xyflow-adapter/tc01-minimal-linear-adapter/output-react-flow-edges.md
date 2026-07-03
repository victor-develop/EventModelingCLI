---
title: "Output — React Flow Edges"
notion_id: a65393d8-3855-44fc-97eb-78fa7c6fa10d
synced_at: 2026-07-03T13:43:41.925Z
---


```json
[
  {
    "id": "edge-ui-to-cmd",
    "source": "occ-ui-checkout",
    "target": "occ-cmd-submit-order",
    "type": "em.orthogonal",
    "data": {
      "kind": "shared-to-cmd",
      "points": [[220, 28], [400, 228]]
    },
    "selectable": true
  },
  {
    "id": "edge-cmd-to-evt",
    "source": "occ-cmd-submit-order",
    "target": "occ-evt-order-submitted",
    "type": "em.orthogonal",
    "data": {
      "kind": "cmd-to-evt",
      "points": [[620, 228], [800, 428]]
    },
    "selectable": true
  }
]
```

