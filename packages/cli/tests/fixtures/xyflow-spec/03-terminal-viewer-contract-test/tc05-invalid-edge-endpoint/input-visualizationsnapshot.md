---
title: "Input — VisualizationSnapshot"
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
      { "occurrenceId": "occ-cmd-submit-order", "canonicalNodeId": "cmd.submit-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 1, "rowIndex": 0, "x": 400, "y": 200, "width": 220, "height": 56, "lockLevel": "none" }
    ],
    "renderedEdges": [
      { "displayEdgeId": "edge-ui-to-cmd", "fromOccurrenceId": "occ-ui-checkout", "toOccurrenceId": "occ-cmd-submit-order", "kind": "shared-to-cmd", "points": [[220, 28], [400, 228]] },
      { "displayEdgeId": "edge-cmd-to-missing-event", "fromOccurrenceId": "occ-cmd-submit-order", "toOccurrenceId": "occ-missing-event", "kind": "cmd-to-evt", "points": [[620, 228], [800, 428]] }
    ],
    "swimlaneRects": [
      { "lane": "shared", "x": -40, "y": -40, "width": 900, "height": 136 },
      { "lane": "commandViewModel", "x": -40, "y": 160, "width": 900, "height": 136 },
      { "lane": "event", "x": -40, "y": 360, "width": 900, "height": 136 }
    ]
  },
  "occurrences": [
    { "occurrenceId": "occ-ui-checkout", "canonicalNodeId": "ui.checkout", "nodeKind": "shared", "displayRole": "ui", "lane": "shared", "stageIndex": 0, "rowIndex": 0, "x": 0, "y": 0, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-cmd-submit-order", "canonicalNodeId": "cmd.submit-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 1, "rowIndex": 0, "x": 400, "y": 200, "width": 220, "height": 56, "lockLevel": "none" }
  ],
  "renderedEdges": [
    { "displayEdgeId": "edge-ui-to-cmd", "fromOccurrenceId": "occ-ui-checkout", "toOccurrenceId": "occ-cmd-submit-order", "kind": "shared-to-cmd", "points": [[220, 28], [400, 228]] },
    { "displayEdgeId": "edge-cmd-to-missing-event", "fromOccurrenceId": "occ-cmd-submit-order", "toOccurrenceId": "occ-missing-event", "kind": "cmd-to-evt", "points": [[620, 228], [800, 428]] }
  ],
  "swimlaneRects": [
    { "lane": "shared", "x": -40, "y": -40, "width": 900, "height": 136 },
    { "lane": "commandViewModel", "x": -40, "y": 160, "width": 900, "height": 136 },
    { "lane": "event", "x": -40, "y": 360, "width": 900, "height": 136 }
  ],
  "domainNodes": {
    "ui.checkout": { "id": "ui.checkout", "kind": "ui", "name": "Checkout UI" },
    "cmd.submit-order": { "id": "cmd.submit-order", "kind": "cmd", "name": "Submit Order" }
  },
  "domainEdges": {},
  "laneMap": { "shared": "shared", "commandViewModel": "command / viewModel", "event": "event" }
}
```

