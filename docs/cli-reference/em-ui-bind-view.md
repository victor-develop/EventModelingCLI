# em ui bind-view

### Purpose

Connect a ViewModel to a UI node that consumes it and optionally specify consumed fields.

### Syntax

```bash
em ui bind-view --ui <uiId> --view <viewModelId> [--fields <fieldId,fieldId,...>]
```

### Expected `data`

```json
{
  "edge": {
    "id": "edge_450",
    "type": "viewModelConsumedByUiOrProcessor",
    "fromNodeId": "order.payment.view.charge.detail",
    "toNodeId": "node_401",
    "meta": {
      "fieldRefs": ["f.refund-status", "f.latest-status"]
    }
  }
}
```

### Example

```bash
em ui bind-view --ui node_401 --view order.payment.view.charge.detail --fields f.refund-status,f.latest-status
```

```json
{
  "ok": true,
  "command": "em ui bind-view",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "edge": {
      "id": "edge_450",
      "type": "viewModelConsumedByUiOrProcessor",
      "fromNodeId": "order.payment.view.charge.detail",
      "toNodeId": "node_401",
      "meta": {
        "fieldRefs": ["f.refund-status", "f.latest-status"]
      }
    }
  },
  "warnings": []
}
```
