---
title: "Input — VisualizationSnapshot"
notion_id: 06b89b8a-13fd-4b9a-9dd9-8120fcab442b
synced_at: 2026-07-03T13:43:24.630Z
---


```json
{
  "focusNodeId": "cmd.submit-order",
  "projectName": "Order Management",
  "layoutState": {
    "layoutVersion": 1,
    "focusNodeId": "cmd.submit-order",
    "occurrences": [
      { "occurrenceId": "occ-ui-checkout", "canonicalNodeId": "ui.checkout", "nodeKind": "shared", "displayRole": "ui", "lane": "shared", "stageIndex": 0, "rowIndex": 0, "x": 0, "y": 0, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-ui-admin", "canonicalNodeId": "ui.admin", "nodeKind": "shared", "displayRole": "ui", "lane": "shared", "stageIndex": 0, "rowIndex": 1, "x": 0, "y": 80, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-cmd-submit-order", "canonicalNodeId": "cmd.submit-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 1, "rowIndex": 0, "x": 400, "y": 160, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-cmd-approve-order", "canonicalNodeId": "cmd.approve-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 1, "rowIndex": 1, "x": 400, "y": 240, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-evt-order-confirmed", "canonicalNodeId": "evt.order-confirmed", "nodeKind": "evt", "displayRole": "event", "lane": "event", "stageIndex": 2, "rowIndex": 0, "x": 800, "y": 400, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-vm-order-status", "canonicalNodeId": "vm.order-status", "nodeKind": "viewModel", "displayRole": "viewModel", "lane": "commandViewModel", "stageIndex": 3, "rowIndex": 0, "x": 1200, "y": 160, "width": 220, "height": 56, "lockLevel": "none" }
    ],
    "renderedEdges": [
      { "displayEdgeId": "edge-admin-to-approve", "fromOccurrenceId": "occ-ui-admin", "toOccurrenceId": "occ-cmd-approve-order", "kind": "shared-to-cmd", "points": [[220, 108], [400, 268]] },
      { "displayEdgeId": "edge-approve-to-evt", "fromOccurrenceId": "occ-cmd-approve-order", "toOccurrenceId": "occ-evt-order-confirmed", "kind": "cmd-to-evt", "points": [[620, 268], [800, 428]] },
      { "displayEdgeId": "edge-evt-to-vm", "fromOccurrenceId": "occ-evt-order-confirmed", "toOccurrenceId": "occ-vm-order-status", "kind": "evt-to-viewModel", "points": [[1020, 428], [1200, 188]] },
      { "displayEdgeId": "edge-submit-to-evt", "fromOccurrenceId": "occ-cmd-submit-order", "toOccurrenceId": "occ-evt-order-confirmed", "kind": "cmd-to-evt", "points": [[620, 188], [800, 428]] },
      { "displayEdgeId": "edge-ui-to-submit", "fromOccurrenceId": "occ-ui-checkout", "toOccurrenceId": "occ-cmd-submit-order", "kind": "shared-to-cmd", "points": [[220, 28], [400, 188]] }
    ],
    "swimlaneRects": [
      { "lane": "shared", "x": -40, "y": -40, "width": 1500, "height": 216 },
      { "lane": "commandViewModel", "x": -40, "y": 120, "width": 1500, "height": 216 },
      { "lane": "event", "x": -40, "y": 360, "width": 1500, "height": 136 }
    ]
  },
  "occurrences": [
    { "occurrenceId": "occ-ui-checkout", "canonicalNodeId": "ui.checkout", "nodeKind": "shared", "displayRole": "ui", "lane": "shared", "stageIndex": 0, "rowIndex": 0, "x": 0, "y": 0, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-ui-admin", "canonicalNodeId": "ui.admin", "nodeKind": "shared", "displayRole": "ui", "lane": "shared", "stageIndex": 0, "rowIndex": 1, "x": 0, "y": 80, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-cmd-submit-order", "canonicalNodeId": "cmd.submit-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 1, "rowIndex": 0, "x": 400, "y": 160, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-cmd-approve-order", "canonicalNodeId": "cmd.approve-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 1, "rowIndex": 1, "x": 400, "y": 240, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-evt-order-confirmed", "canonicalNodeId": "evt.order-confirmed", "nodeKind": "evt", "displayRole": "event", "lane": "event", "stageIndex": 2, "rowIndex": 0, "x": 800, "y": 400, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-vm-order-status", "canonicalNodeId": "vm.order-status", "nodeKind": "viewModel", "displayRole": "viewModel", "lane": "commandViewModel", "stageIndex": 3, "rowIndex": 0, "x": 1200, "y": 160, "width": 220, "height": 56, "lockLevel": "none" }
  ],
  "renderedEdges": [
    { "displayEdgeId": "edge-admin-to-approve", "fromOccurrenceId": "occ-ui-admin", "toOccurrenceId": "occ-cmd-approve-order", "kind": "shared-to-cmd", "points": [[220, 108], [400, 268]] },
    { "displayEdgeId": "edge-approve-to-evt", "fromOccurrenceId": "occ-cmd-approve-order", "toOccurrenceId": "occ-evt-order-confirmed", "kind": "cmd-to-evt", "points": [[620, 268], [800, 428]] },
    { "displayEdgeId": "edge-evt-to-vm", "fromOccurrenceId": "occ-evt-order-confirmed", "toOccurrenceId": "occ-vm-order-status", "kind": "evt-to-viewModel", "points": [[1020, 428], [1200, 188]] },
    { "displayEdgeId": "edge-submit-to-evt", "fromOccurrenceId": "occ-cmd-submit-order", "toOccurrenceId": "occ-evt-order-confirmed", "kind": "cmd-to-evt", "points": [[620, 188], [800, 428]] },
    { "displayEdgeId": "edge-ui-to-submit", "fromOccurrenceId": "occ-ui-checkout", "toOccurrenceId": "occ-cmd-submit-order", "kind": "shared-to-cmd", "points": [[220, 28], [400, 188]] }
  ],
  "swimlaneRects": [
    { "lane": "shared", "x": -40, "y": -40, "width": 1500, "height": 216 },
    { "lane": "commandViewModel", "x": -40, "y": 120, "width": 1500, "height": 216 },
    { "lane": "event", "x": -40, "y": 360, "width": 1500, "height": 136 }
  ],
  "domainNodes": {
    "ui.checkout": { "id": "ui.checkout", "kind": "ui", "name": "Checkout UI" },
    "ui.admin": { "id": "ui.admin", "kind": "ui", "name": "Admin UI" },
    "cmd.submit-order": { "id": "cmd.submit-order", "kind": "cmd", "name": "Submit Order" },
    "cmd.approve-order": { "id": "cmd.approve-order", "kind": "cmd", "name": "Approve Order" },
    "evt.order-confirmed": { "id": "evt.order-confirmed", "kind": "evt", "name": "Order Confirmed" },
    "vm.order-status": { "id": "vm.order-status", "kind": "viewModel", "name": "Order Status" }
  },
  "domainEdges": {},
  "laneMap": { "shared": "shared", "commandViewModel": "command / viewModel", "event": "event" }
}
```

