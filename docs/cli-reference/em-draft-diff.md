# em draft diff

### Purpose

Render the current draft as a semantic diff.

Schema envelope changes (`schemasAdded`, `schemasUpdated`, `schemasRemoved`) are reported separately from field-level changes (`fieldsAdded`, `fieldsUpdated`, `fieldsRemoved`) so review UIs can visualize them differently.

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
    "schemasAdded": ["order.payment.view.charge.detail"],
    "fieldsAdded": ["order.payment.view.charge.detail#f.refund-status"]
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
      "schemasAdded": ["order.payment.view.charge.detail"],
      "fieldsAdded": ["order.payment.view.charge.detail#f.refund-status"]
    }
  },
  "warnings": []
}
```
