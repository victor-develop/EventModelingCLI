---
title: "Input — Previous React Flow State"
notion_id: cc529c82-8a3c-4fad-b776-da9fbc1c27e1
synced_at: 2026-07-03T13:43:44.120Z
---


```json
{
  "nodes": [
    { "id": "lane:shared", "type": "swimlaneGroup", "position": { "x": -40, "y": -40 }, "style": { "width": 900, "height": 136 }, "data": { "lane": "shared", "label": "shared" }, "selected": false },
    { "id": "lane:commandViewModel", "type": "swimlaneGroup", "position": { "x": -40, "y": 160 }, "style": { "width": 900, "height": 136 }, "data": { "lane": "commandViewModel", "label": "command / viewModel" }, "selected": false },
    { "id": "lane:event", "type": "swimlaneGroup", "position": { "x": -40, "y": 360 }, "style": { "width": 900, "height": 136 }, "data": { "lane": "event", "label": "event" }, "selected": false },
    { "id": "occ-cmd-submit-order", "type": "em.cmd", "parentId": "lane:commandViewModel", "extent": "parent", "position": { "x": 440, "y": 40 }, "data": { "canonicalNodeId": "cmd.submit-order", "label": "Submit Order", "visibleLane": "commandViewModel", "lockLevel": "none" }, "selected": true }
  ],
  "edges": []
}
```

