---
title: "Input — VisualizationSnapshot"
---


```json
{
  "focusNodeId": "cmd.refresh-order",
  "projectName": "Order Management",
  "layoutState": {
    "layoutVersion": 1,
    "focusNodeId": "cmd.refresh-order",
    "occurrences": [
      { "occurrenceId": "occ-role-customer", "canonicalNodeId": "role.customer", "nodeKind": "shared", "displayRole": "role", "lane": "role:role.customer", "stageIndex": 0, "rowIndex": 0, "x": 0, "y": 0, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-nonrole-clock", "canonicalNodeId": "trigger.clock", "nodeKind": "shared", "displayRole": "trigger", "lane": "nonRole", "stageIndex": 0, "rowIndex": 0, "x": 0, "y": 200, "width": 220, "height": 56, "lockLevel": "none" },
      { "occurrenceId": "occ-cmd-refresh-order", "canonicalNodeId": "cmd.refresh-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 1, "rowIndex": 0, "x": 400, "y": 400, "width": 220, "height": 56, "lockLevel": "none" }
    ],
    "renderedEdges": [
      { "displayEdgeId": "edge-clock-to-cmd", "fromOccurrenceId": "occ-nonrole-clock", "toOccurrenceId": "occ-cmd-refresh-order", "kind": "shared-to-cmd", "points": [[220, 228], [400, 428]] },
      { "displayEdgeId": "edge-role-to-cmd", "fromOccurrenceId": "occ-role-customer", "toOccurrenceId": "occ-cmd-refresh-order", "kind": "shared-to-cmd", "points": [[220, 28], [400, 428]] }
    ],
    "swimlaneRects": [
      { "lane": "role:role.customer", "x": -40, "y": -40, "width": 900, "height": 136 },
      { "lane": "shared", "x": -40, "y": 160, "width": 900, "height": 136 },
      { "lane": "commandViewModel", "x": -40, "y": 360, "width": 900, "height": 136 },
      { "lane": "event", "x": -40, "y": 560, "width": 900, "height": 136 }
    ]
  },
  "occurrences": [
    { "occurrenceId": "occ-role-customer", "canonicalNodeId": "role.customer", "nodeKind": "shared", "displayRole": "role", "lane": "role:role.customer", "stageIndex": 0, "rowIndex": 0, "x": 0, "y": 0, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-nonrole-clock", "canonicalNodeId": "trigger.clock", "nodeKind": "shared", "displayRole": "trigger", "lane": "nonRole", "stageIndex": 0, "rowIndex": 0, "x": 0, "y": 200, "width": 220, "height": 56, "lockLevel": "none" },
    { "occurrenceId": "occ-cmd-refresh-order", "canonicalNodeId": "cmd.refresh-order", "nodeKind": "cmd", "displayRole": "command", "lane": "commandViewModel", "stageIndex": 1, "rowIndex": 0, "x": 400, "y": 400, "width": 220, "height": 56, "lockLevel": "none" }
  ],
  "renderedEdges": [
    { "displayEdgeId": "edge-clock-to-cmd", "fromOccurrenceId": "occ-nonrole-clock", "toOccurrenceId": "occ-cmd-refresh-order", "kind": "shared-to-cmd", "points": [[220, 228], [400, 428]] },
    { "displayEdgeId": "edge-role-to-cmd", "fromOccurrenceId": "occ-role-customer", "toOccurrenceId": "occ-cmd-refresh-order", "kind": "shared-to-cmd", "points": [[220, 28], [400, 428]] }
  ],
  "swimlaneRects": [
    { "lane": "role:role.customer", "x": -40, "y": -40, "width": 900, "height": 136 },
    { "lane": "shared", "x": -40, "y": 160, "width": 900, "height": 136 },
    { "lane": "commandViewModel", "x": -40, "y": 360, "width": 900, "height": 136 },
    { "lane": "event", "x": -40, "y": 560, "width": 900, "height": 136 }
  ],
  "laneDescriptors": [
    { "id": "role:role.customer", "kind": "role", "label": "Customer", "sourceNodeId": "role.customer" },
    { "id": "shared", "kind": "shared", "label": "shared" },
    { "id": "commandViewModel", "kind": "commandViewModel", "label": "command / viewModel" },
    { "id": "event", "kind": "event", "label": "event" }
  ],
  "domainNodes": {
    "role.customer": { "id": "role.customer", "kind": "role", "name": "Customer" },
    "trigger.clock": { "id": "trigger.clock", "kind": "trigger", "name": "Clock Trigger" },
    "cmd.refresh-order": { "id": "cmd.refresh-order", "kind": "cmd", "name": "Refresh Order" }
  },
  "domainEdges": {},
  "laneMap": { "role:role.customer": "Customer", "shared": "shared", "commandViewModel": "command / viewModel", "event": "event" }
}
```
