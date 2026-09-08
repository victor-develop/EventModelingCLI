---
title: "Input — Previous React Flow State"
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

