# em draft diff

### Purpose

Render the current draft as a diff.

### Syntax

```bash
em draft diff [--format text|json|mermaid]
```

### Expected `data`

```json
{
  "format": "json",
  "diff": {
    "nodesAdded": ["order.refund.evt.refund.status-updated"],
    "nodesUpdated": ["order.payment.view.charge.detail"],
    "edgesAdded": ["edge_101"],
    "fieldsAdded": ["f.refund-status"]
  }
}
```

### Example

```bash
em draft diff --format json
```

```json
{
  "ok": true,
  "command": "em draft diff",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "format": "json",
    "diff": {
      "nodesAdded": ["order.refund.evt.refund.status-updated"],
      "nodesUpdated": ["order.payment.view.charge.detail"],
      "edgesAdded": ["edge_101"],
      "fieldsAdded": ["f.refund-status"]
    }
  },
  "warnings": []
}
```