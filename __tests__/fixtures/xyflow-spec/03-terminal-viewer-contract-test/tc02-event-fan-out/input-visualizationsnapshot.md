---
title: "Input — VisualizationSnapshot"
notion_id: 1aba421b-3510-46a9-980b-5dcfcb748db8
synced_at: 2026-07-03T13:43:22.931Z
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
      { "occurrenceId": "occ-cmd-submit-order", "canonicalNodeId": "cmd.submit-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 1, "rowIndex": 0, "x": 400, "y": 200, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-evt-order-submitted", "canonicalNodeId": "evt.order-submitted", "nodeKind": "evt", "displayRole": "event", "lane": "event", "stageIndex": 2, "rowIndex": 0, "x": 800, "y": 400, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-vm-order-summary", "canonicalNodeId": "vm.order-summary", "nodeKind": "viewModel", "displayRole": "viewModel", "lane": "commandViewModel", "stageIndex": 3, "rowIndex": 0, "x": 1200, "y": 160, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-vm-order-audit", "canonicalNodeId": "vm.order-audit", "nodeKind": "viewModel", "displayRole": "viewModel", "lane": "commandViewModel", "stageIndex": 3, "rowIndex": 1, "x": 1200, "y": 240, "width": 220, "height": 56, "lockLevel": "none" }
    ],
    "renderedEdges": [
      { "displayEdgeId": "edge-ui-to-cmd", "fromOccurrenceId": "occ-ui-checkout", "toOccurrenceId": "occ-cmd-submit-order", "kind": "shared-to-cmd", "points": [[220, 28], [400, 228]] },
      { "displayEdgeId": "edge-cmd-to-evt", "fromOccurrenceId": "occ-cmd-submit-order", "toOccurrenceId": "occ-evt-order-submitted", "kind": "cmd-to-evt", "points": [[620, 228], [800, 428]] },
      { "displayEdgeId": "edge-evt-to-vm-audit", "fromOccurrenceId": "occ-evt-order-submitted", "toOccurrenceId": "occ-vm-order-audit", "kind": "evt-to-viewModel", "points": [[1020, 428], [1200, 268]] },
      { "displayEdgeId": "edge-evt-to-vm-summary", "fromOccurrenceId": "occ-evt-order-submitted", "toOccurrenceId": "occ-vm-order-summary", "kind": "evt-to-viewModel", "points": [[1020, 428], [1200, 188]] }
    ],
    "swimlaneRects": [
      { "lane": "shared", "x": -40, "y": -40, "width": 1500, "height": 136 },
      { "lane": "commandViewModel", "x": -40, "y": 120, "width": 1500, "height": 216 },
      { "lane": "event", "x": -40, "y": 360, "width": 1500, "height": 136 }
    ]
  },
  "occurrences": [
    { "occurrenceId": "occ-ui-checkout", "canonicalNodeId": "ui.checkout", "nodeKind": "shared", "displayRole": "ui", "lane": "shared", "stageIndex": 0, "rowIndex": 0, "x": 0, "y": 0, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-cmd-submit-order", "canonicalNodeId": "cmd.submit-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 1, "rowIndex": 0, "x": 400, "y": 200, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-evt-order-submitted", "canonicalNodeId": "evt.order-submitted", "nodeKind": "evt", "displayRole": "event", "lane": "event", "stageIndex": 2, "rowIndex": 0, "x": 800, "y": 400, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-vm-order-summary", "canonicalNodeId": "vm.order-summary", "nodeKind": "viewModel", "displayRole": "viewModel", "lane": "commandViewModel", "stageIndex": 3, "rowIndex": 0, "x": 1200, "y": 160, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-vm-order-audit", "canonicalNodeId": "vm.order-audit", "nodeKind": "viewModel", "displayRole": "viewModel", "lane": "commandViewModel", "stageIndex": 3, "rowIndex": 1, "x": 1200, "y": 240, "width": 220, "height": 56, "lockLevel": "none" }
  ],
  "renderedEdges": [
    { "displayEdgeId": "edge-ui-to-cmd", "fromOccurrenceId": "occ-ui-checkout", "toOccurrenceId": "occ-cmd-submit-order", "kind": "shared-to-cmd", "points": [[220, 28], [400, 228]] },
    { "displayEdgeId": "edge-cmd-to-evt", "fromOccurrenceId": "occ-cmd-submit-order", "toOccurrenceId": "occ-evt-order-submitted", "kind": "cmd-to-evt", "points": [[620, 228], [800, 428]] },
    { "displayEdgeId": "edge-evt-to-vm-audit", "fromOccurrenceId": "occ-evt-order-submitted", "toOccurrenceId": "occ-vm-order-audit", "kind": "evt-to-viewModel", "points": [[1020, 428], [1200, 268]] },
    { "displayEdgeId": "edge-evt-to-vm-summary", "fromOccurrenceId": "occ-evt-order-submitted", "toOccurrenceId": "occ-vm-order-summary", "kind": "evt-to-viewModel", "points": [[1020, 428], [1200, 188]] }
  ],
  "swimlaneRects": [
    { "lane": "shared", "x": -40, "y": -40, "width": 1500, "height": 136 },
    { "lane": "commandViewModel", "x": -40, "y": 120, "width": 1500, "height": 216 },
    { "lane": "event", "x": -40, "y": 360, "width": 1500, "height": 136 }
  ],
  "domainNodes": {
    "ui.checkout": { "id": "ui.checkout", "kind": "ui", "name": "Checkout UI" },
    "cmd.submit-order": { "id": "cmd.submit-order", "kind": "cmd", "name": "Submit Order" },
    "evt.order-submitted": { "id": "evt.order-submitted", "kind": "evt", "name": "Order Submitted" },
    "vm.order-summary": { "id": "vm.order-summary", "kind": "viewModel", "name": "Order Summary" },
    "vm.order-audit": { "id": "vm.order-audit", "kind": "viewModel", "name": "Order Audit" }
  },
  "domainEdges": {},
  "laneMap": { "shared": "shared", "commandViewModel": "command / viewModel", "event": "event" }
}
```

