---
title: "Output — React Flow Edges"
---


```json
[
  {
    "id": "edge-ui-to-cmd",
    "source": "occ-ui-checkout",
    "target": "occ-cmd-submit-order",
    "type": "em.orthogonal",
    "data": {
      "kind": "shared-to-cmd"
    },
    "markerEnd": {
      "type": "arrowclosed",
      "color": "#8c6f3d",
      "width": 18,
      "height": 18
    },
    "style": {
      "stroke": "#8c6f3d",
      "strokeWidth": 2.2
    },
    "selectable": true
  },
  {
    "id": "edge-cmd-to-evt",
    "source": "occ-cmd-submit-order",
    "target": "occ-evt-order-submitted",
    "type": "em.orthogonal",
    "data": {
      "kind": "cmd-to-evt"
    },
    "markerEnd": {
      "type": "arrowclosed",
      "color": "#2f6f73",
      "width": 18,
      "height": 18
    },
    "style": {
      "stroke": "#2f6f73",
      "strokeWidth": 2.2
    },
    "selectable": true
  }
]
```
