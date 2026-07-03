---
title: "Output — Next React Flow State"
notion_id: cf3640e3-6f77-4ee8-933d-877ac8674217
synced_at: 2026-07-03T13:43:44.711Z
---


```json
{
  "nodes": [
    { "id": "lane:shared", "type": "swimlaneGroup", "position": { "x": -40, "y": -40 }, "style": { "width": 1100, "height": 136 }, "data": { "lane": "shared", "label": "shared" }, "selected": false },
    { "id": "lane:commandViewModel", "type": "swimlaneGroup", "position": { "x": -40, "y": 160 }, "style": { "width": 1100, "height": 136 }, "data": { "lane": "commandViewModel", "label": "command / viewModel" }, "selected": false },
    { "id": "lane:event", "type": "swimlaneGroup", "position": { "x": -40, "y": 360 }, "style": { "width": 1100, "height": 136 }, "data": { "lane": "event", "label": "event" }, "selected": false },
    { "id": "occ-cmd-submit-order", "type": "em.cmd", "parentId": "lane:commandViewModel", "extent": "parent", "position": { "x": 440, "y": 40 }, "data": { "canonicalNodeId": "cmd.submit-order", "label": "Submit Order", "visibleLane": "commandViewModel", "lockLevel": "none" }, "selected": true },
    { "id": "occ-evt-order-submitted", "type": "em.evt", "parentId": "lane:event", "extent": "parent", "position": { "x": 840, "y": 40 }, "data": { "canonicalNodeId": "evt.order-submitted", "label": "evt.order-submitted", "visibleLane": "event", "lockLevel": "none" }, "selected": false }
  ],
  "edges": [
    { "id": "edge-cmd-to-evt", "source": "occ-cmd-submit-order", "target": "occ-evt-order-submitted", "type": "em.orthogonal", "data": { "kind": "cmd-to-evt", "points": [[620, 228], [800, 428]] }, "selectable": true }
  ]
}
```

