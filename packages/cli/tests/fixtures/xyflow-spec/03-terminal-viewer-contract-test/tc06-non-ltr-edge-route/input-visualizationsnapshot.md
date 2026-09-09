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
      { "occurrenceId": "occ-cmd-submit-order", "canonicalNodeId": "cmd.submit-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 1, "rowIndex": 0, "x": 400, "y": 200, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-evt-order-submitted", "canonicalNodeId": "evt.order-submitted", "nodeKind": "evt", "displayRole": "event", "lane": "event", "stageIndex": 2, "rowIndex": 0, "x": 800, "y": 400, "width": 220, "height": 56, "lockLevel": "none" }
    ],
    "renderedEdges": [
      { "displayEdgeId": "edge-cmd-to-evt-rtl", "fromOccurrenceId": "occ-cmd-submit-order", "toOccurrenceId": "occ-evt-order-submitted", "kind": "cmd-to-evt", "points": [[620, 228], [500, 428]] }
    ],
    "swimlaneRects": [
      { "lane": "shared", "x": -40, "y": -40, "width": 1000, "height": 136 },
      { "lane": "commandViewModel", "x": -40, "y": 160, "width": 1000, "height": 136 },
      { "lane": "event", "x": -40, "y": 360, "width": 1000, "height": 136 }
    ]
  },
  "occurrences": [
    { "occurrenceId": "occ-cmd-submit-order", "canonicalNodeId": "cmd.submit-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 1, "rowIndex": 0, "x": 400, "y": 200, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-evt-order-submitted", "canonicalNodeId": "evt.order-submitted", "nodeKind": "evt", "displayRole": "event", "lane": "event", "stageIndex": 2, "rowIndex": 0, "x": 800, "y": 400, "width": 220, "height": 56, "lockLevel": "none" }
  ],
  "renderedEdges": [
    { "displayEdgeId": "edge-cmd-to-evt-rtl", "fromOccurrenceId": "occ-cmd-submit-order", "toOccurrenceId": "occ-evt-order-submitted", "kind": "cmd-to-evt", "points": [[620, 228], [500, 428]] }
  ],
  "swimlaneRects": [
    { "lane": "shared", "x": -40, "y": -40, "width": 1000, "height": 136 },
    { "lane": "commandViewModel", "x": -40, "y": 160, "width": 1000, "height": 136 },
    { "lane": "event", "x": -40, "y": 360, "width": 1000, "height": 136 }
  ],
  "domainNodes": {
    "cmd.submit-order": { "id": "cmd.submit-order", "kind": "cmd", "name": "Submit Order" },
    "evt.order-submitted": { "id": "evt.order-submitted", "kind": "evt", "name": "Order Submitted" }
  },
  "domainEdges": {},
  "laneMap": { "shared": "shared", "commandViewModel": "command / viewModel", "event": "event" }
}
```

