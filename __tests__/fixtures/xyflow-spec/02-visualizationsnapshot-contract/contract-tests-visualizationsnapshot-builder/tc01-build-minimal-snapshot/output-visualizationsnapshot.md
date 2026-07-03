---
title: "Output — VisualizationSnapshot"
notion_id: edda3b60-cfee-4576-a4d1-596a3ac1266d
synced_at: 2026-07-03T13:43:14.955Z
---


```json
{
  "focusNodeId": "cmd.submit-order",
  "projectName": "Order Management",
  "occurrences": [
    { "occurrenceId": "occ-ui-checkout", "canonicalNodeId": "ui.checkout", "nodeKind": "shared", "displayRole": "ui", "lane": "shared", "stageIndex": 0, "rowIndex": 0, "x": 0, "y": 0, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-cmd-submit-order", "canonicalNodeId": "cmd.submit-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 1, "rowIndex": 0, "x": 400, "y": 200, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-evt-order-submitted", "canonicalNodeId": "evt.order-submitted", "nodeKind": "evt", "displayRole": "event", "lane": "event", "stageIndex": 2, "rowIndex": 0, "x": 800, "y": 400, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-vm-order-detail", "canonicalNodeId": "vm.order-detail", "nodeKind": "viewModel", "displayRole": "viewModel", "lane": "commandViewModel", "stageIndex": 3, "rowIndex": 0, "x": 1200, "y": 200, "width": 220, "height": 56, "lockLevel": "none" }
  ],
  "renderedEdges": [
    { "displayEdgeId": "edge-ui-to-cmd", "fromOccurrenceId": "occ-ui-checkout", "toOccurrenceId": "occ-cmd-submit-order", "kind": "shared-to-cmd", "points": [[220, 28], [400, 228]] },
    { "displayEdgeId": "edge-cmd-to-evt", "fromOccurrenceId": "occ-cmd-submit-order", "toOccurrenceId": "occ-evt-order-submitted", "kind": "cmd-to-evt", "points": [[620, 228], [800, 428]] },
    { "displayEdgeId": "edge-evt-to-vm", "fromOccurrenceId": "occ-evt-order-submitted", "toOccurrenceId": "occ-vm-order-detail", "kind": "evt-to-viewModel", "points": [[1020, 428], [1200, 228]] }
  ],
  "swimlaneRects": [
    { "lane": "shared", "x": -40, "y": -40, "width": 1500, "height": 136 },
    { "lane": "commandViewModel", "x": -40, "y": 160, "width": 1500, "height": 136 },
    { "lane": "event", "x": -40, "y": 360, "width": 1500, "height": 136 }
  ],
  "domainNodes": {
    "ui.checkout": { "id": "ui.checkout", "kind": "ui", "name": "Checkout UI" },
    "cmd.submit-order": { "id": "cmd.submit-order", "kind": "cmd", "name": "Submit Order" },
    "evt.order-submitted": { "id": "evt.order-submitted", "kind": "evt", "name": "Order Submitted" },
    "vm.order-detail": { "id": "vm.order-detail", "kind": "viewModel", "name": "Order Detail" }
  },
  "domainEdges": {
    "domain-edge-ui-to-cmd": { "id": "domain-edge-ui-to-cmd", "from": "ui.checkout", "to": "cmd.submit-order", "kind": "shared-to-cmd" },
    "domain-edge-cmd-to-evt": { "id": "domain-edge-cmd-to-evt", "from": "cmd.submit-order", "to": "evt.order-submitted", "kind": "cmd-to-evt" },
    "domain-edge-evt-to-vm": { "id": "domain-edge-evt-to-vm", "from": "evt.order-submitted", "to": "vm.order-detail", "kind": "evt-to-viewModel" }
  },
  "laneMap": { "shared": "shared", "commandViewModel": "command / viewModel", "event": "event" }
}
```

