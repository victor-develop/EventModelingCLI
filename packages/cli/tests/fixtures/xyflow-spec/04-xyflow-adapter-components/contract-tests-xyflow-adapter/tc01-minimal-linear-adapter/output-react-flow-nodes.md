---
title: "Output — React Flow Nodes"
---


```json
[
  {
    "id": "lane:shared",
    "type": "swimlaneGroup",
    "position": { "x": -40, "y": -40 },
    "data": { "lane": "shared", "label": "shared" },
    "draggable": false,
    "selectable": false,
    "connectable": false,
    "zIndex": 0,
    "style": { "width": 1100, "height": 136 }
  },
  {
    "id": "lane:commandViewModel",
    "type": "swimlaneGroup",
    "position": { "x": -40, "y": 160 },
    "data": { "lane": "commandViewModel", "label": "command / viewModel" },
    "draggable": false,
    "selectable": false,
    "connectable": false,
    "zIndex": 0,
    "style": { "width": 1100, "height": 136 }
  },
  {
    "id": "lane:event",
    "type": "swimlaneGroup",
    "position": { "x": -40, "y": 360 },
    "data": { "lane": "event", "label": "event" },
    "draggable": false,
    "selectable": false,
    "connectable": false,
    "zIndex": 0,
    "style": { "width": 1100, "height": 136 }
  },
  {
    "id": "occ-ui-checkout",
    "type": "em.ui",
    "parentId": "lane:shared",
    "extent": "parent",
    "position": { "x": 40, "y": 40 },
    "data": { "canonicalNodeId": "ui.checkout", "label": "Checkout UI", "visibleLane": "shared", "lockLevel": "none" },
    "draggable": true,
    "selectable": true,
    "connectable": false
  },
  {
    "id": "occ-cmd-submit-order",
    "type": "em.cmd",
    "parentId": "lane:commandViewModel",
    "extent": "parent",
    "position": { "x": 440, "y": 40 },
    "data": { "canonicalNodeId": "cmd.submit-order", "label": "Submit Order", "visibleLane": "commandViewModel", "lockLevel": "none" },
    "draggable": true,
    "selectable": true,
    "connectable": false
  },
  {
    "id": "occ-evt-order-submitted",
    "type": "em.evt",
    "parentId": "lane:event",
    "extent": "parent",
    "position": { "x": 840, "y": 40 },
    "data": { "canonicalNodeId": "evt.order-submitted", "label": "Order Submitted", "visibleLane": "event", "lockLevel": "none" },
    "draggable": true,
    "selectable": true,
    "connectable": false
  }
]
```

