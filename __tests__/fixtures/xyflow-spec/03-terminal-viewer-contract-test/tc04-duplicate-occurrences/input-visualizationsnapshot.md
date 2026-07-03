---
title: "Input — VisualizationSnapshot"
notion_id: f5a8d297-fc47-425d-9b78-0a09703e7a05
synced_at: 2026-07-03T13:43:27.426Z
---


```json
{
  "focusNodeId": "cmd.create-order",
  "projectName": "Order Management",
  "layoutState": {
    "layoutVersion": 1,
    "focusNodeId": "cmd.create-order",
    "occurrences": [
      { "occurrenceId": "occ-ui-checkout", "canonicalNodeId": "ui.checkout", "nodeKind": "shared", "displayRole": "ui", "lane": "shared", "stageIndex": 0, "rowIndex": 0, "x": 0, "y": 0, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-cmd-create-order", "canonicalNodeId": "cmd.create-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 1, "rowIndex": 0, "x": 400, "y": 200, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-evt-order-created", "canonicalNodeId": "evt.order-created", "nodeKind": "evt", "displayRole": "event", "lane": "event", "stageIndex": 2, "rowIndex": 0, "x": 800, "y": 400, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-vm-order-detail-after-created", "canonicalNodeId": "vm.order-detail", "nodeKind": "viewModel", "displayRole": "viewModel", "lane": "commandViewModel", "stageIndex": 3, "rowIndex": 0, "x": 1200, "y": 200, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-cmd-pay-order", "canonicalNodeId": "cmd.pay-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 5, "rowIndex": 0, "x": 2000, "y": 200, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-evt-order-paid", "canonicalNodeId": "evt.order-paid", "nodeKind": "evt", "displayRole": "event", "lane": "event", "stageIndex": 6, "rowIndex": 0, "x": 2400, "y": 400, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-vm-order-detail-after-paid", "canonicalNodeId": "vm.order-detail", "nodeKind": "viewModel", "displayRole": "viewModel", "lane": "commandViewModel", "stageIndex": 7, "rowIndex": 0, "x": 2800, "y": 200, "width": 220, "height": 56, "lockLevel": "none" }
    ],
    "renderedEdges": [
      { "displayEdgeId": "edge-created-to-vm1", "fromOccurrenceId": "occ-evt-order-created", "toOccurrenceId": "occ-vm-order-detail-after-created", "kind": "evt-to-viewModel", "points": [[1020, 428], [1200, 228]] },
      { "displayEdgeId": "edge-create-to-created", "fromOccurrenceId": "occ-cmd-create-order", "toOccurrenceId": "occ-evt-order-created", "kind": "cmd-to-evt", "points": [[620, 228], [800, 428]] },
      { "displayEdgeId": "edge-paid-to-vm2", "fromOccurrenceId": "occ-evt-order-paid", "toOccurrenceId": "occ-vm-order-detail-after-paid", "kind": "evt-to-viewModel", "points": [[2620, 428], [2800, 228]] },
      { "displayEdgeId": "edge-pay-to-paid", "fromOccurrenceId": "occ-cmd-pay-order", "toOccurrenceId": "occ-evt-order-paid", "kind": "cmd-to-evt", "points": [[2220, 228], [2400, 428]] },
      { "displayEdgeId": "edge-ui-to-create", "fromOccurrenceId": "occ-ui-checkout", "toOccurrenceId": "occ-cmd-create-order", "kind": "shared-to-cmd", "points": [[220, 28], [400, 228]] },
      { "displayEdgeId": "edge-vm1-to-pay", "fromOccurrenceId": "occ-vm-order-detail-after-created", "toOccurrenceId": "occ-cmd-pay-order", "kind": "viewModel-to-shared", "points": [[1420, 228], [2000, 228]] }
    ],
    "swimlaneRects": [
      { "lane": "shared", "x": -40, "y": -40, "width": 3100, "height": 136 },
      { "lane": "commandViewModel", "x": -40, "y": 160, "width": 3100, "height": 136 },
      { "lane": "event", "x": -40, "y": 360, "width": 3100, "height": 136 }
    ]
  },
  "occurrences": [
    { "occurrenceId": "occ-ui-checkout", "canonicalNodeId": "ui.checkout", "nodeKind": "shared", "displayRole": "ui", "lane": "shared", "stageIndex": 0, "rowIndex": 0, "x": 0, "y": 0, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-cmd-create-order", "canonicalNodeId": "cmd.create-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 1, "rowIndex": 0, "x": 400, "y": 200, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-evt-order-created", "canonicalNodeId": "evt.order-created", "nodeKind": "evt", "displayRole": "event", "lane": "event", "stageIndex": 2, "rowIndex": 0, "x": 800, "y": 400, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-vm-order-detail-after-created", "canonicalNodeId": "vm.order-detail", "nodeKind": "viewModel", "displayRole": "viewModel", "lane": "commandViewModel", "stageIndex": 3, "rowIndex": 0, "x": 1200, "y": 200, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-cmd-pay-order", "canonicalNodeId": "cmd.pay-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 5, "rowIndex": 0, "x": 2000, "y": 200, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-evt-order-paid", "canonicalNodeId": "evt.order-paid", "nodeKind": "evt", "displayRole": "event", "lane": "event", "stageIndex": 6, "rowIndex": 0, "x": 2400, "y": 400, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-vm-order-detail-after-paid", "canonicalNodeId": "vm.order-detail", "nodeKind": "viewModel", "displayRole": "viewModel", "lane": "commandViewModel", "stageIndex": 7, "rowIndex": 0, "x": 2800, "y": 200, "width": 220, "height": 56, "lockLevel": "none" }
  ],
  "renderedEdges": [
    { "displayEdgeId": "edge-created-to-vm1", "fromOccurrenceId": "occ-evt-order-created", "toOccurrenceId": "occ-vm-order-detail-after-created", "kind": "evt-to-viewModel", "points": [[1020, 428], [1200, 228]] },
    { "displayEdgeId": "edge-create-to-created", "fromOccurrenceId": "occ-cmd-create-order", "toOccurrenceId": "occ-evt-order-created", "kind": "cmd-to-evt", "points": [[620, 228], [800, 428]] },
    { "displayEdgeId": "edge-paid-to-vm2", "fromOccurrenceId": "occ-evt-order-paid", "toOccurrenceId": "occ-vm-order-detail-after-paid", "kind": "evt-to-viewModel", "points": [[2620, 428], [2800, 228]] },
    { "displayEdgeId": "edge-pay-to-paid", "fromOccurrenceId": "occ-cmd-pay-order", "toOccurrenceId": "occ-evt-order-paid", "kind": "cmd-to-evt", "points": [[2220, 228], [2400, 428]] },
    { "displayEdgeId": "edge-ui-to-create", "fromOccurrenceId": "occ-ui-checkout", "toOccurrenceId": "occ-cmd-create-order", "kind": "shared-to-cmd", "points": [[220, 28], [400, 228]] },
    { "displayEdgeId": "edge-vm1-to-pay", "fromOccurrenceId": "occ-vm-order-detail-after-created", "toOccurrenceId": "occ-cmd-pay-order", "kind": "viewModel-to-shared", "points": [[1420, 228], [2000, 228]] }
  ],
  "swimlaneRects": [
    { "lane": "shared", "x": -40, "y": -40, "width": 3100, "height": 136 },
    { "lane": "commandViewModel", "x": -40, "y": 160, "width": 3100, "height": 136 },
    { "lane": "event", "x": -40, "y": 360, "width": 3100, "height": 136 }
  ],
  "domainNodes": {
    "ui.checkout": { "id": "ui.checkout", "kind": "ui", "name": "Checkout UI" },
    "cmd.create-order": { "id": "cmd.create-order", "kind": "cmd", "name": "Create Order" },
    "evt.order-created": { "id": "evt.order-created", "kind": "evt", "name": "Order Created" },
    "vm.order-detail": { "id": "vm.order-detail", "kind": "viewModel", "name": "Order Detail" },
    "cmd.pay-order": { "id": "cmd.pay-order", "kind": "cmd", "name": "Pay Order" },
    "evt.order-paid": { "id": "evt.order-paid", "kind": "evt", "name": "Order Paid" }
  },
  "domainEdges": {},
  "laneMap": { "shared": "shared", "commandViewModel": "command / viewModel", "event": "event" }
}
```

