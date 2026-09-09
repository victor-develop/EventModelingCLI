# em proc bind-view

### Purpose

Connect a ViewModel to a processor that consumes it.

### Syntax

```bash
em proc bind-view --proc <procId> --view <viewModelId> [--fields ...]
```

### Expected `data`

```json
{
  "edge": {
    "id": "edge_601",
    "type": "viewModelConsumedByUiOrProcessor",
    "fromNodeId": "order.payment.view.charge.detail",
    "toNodeId": "order.payment.proc.charge.reconcile",
    "meta": {
      "fieldRefs": ["f.latest-status", "f.refund-status"]
    }
  }
}
```

### Example

```bash
em proc bind-view --proc order.payment.proc.charge.reconcile --view order.payment.view.charge.detail --fields f.latest-status,f.refund-status
```

```json
{
  "ok": true,
  "command": "em proc bind-view",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "edge": {
      "id": "edge_601",
      "type": "viewModelConsumedByUiOrProcessor",
      "fromNodeId": "order.payment.view.charge.detail",
      "toNodeId": "order.payment.proc.charge.reconcile",
      "meta": {
        "fieldRefs": ["f.latest-status", "f.refund-status"]
      }
    }
  },
  "warnings": []
}
```
