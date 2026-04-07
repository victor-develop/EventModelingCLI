# em proc bind-view

### Purpose

Connect a processor to a ViewModel it consumes.

### Syntax

```bash
em proc bind-view --proc <procId> --view <viewModelId> [--fields ...]
```

### Expected `data`

```json
{
  "edge": {
    "id": "edge_601",
    "type": "uiOrProcessorConsumesViewModel",
    "fromNodeId": "order.payment.proc.charge.reconcile",
    "toNodeId": "order.payment.view.charge.detail",
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
      "type": "uiOrProcessorConsumesViewModel",
      "fromNodeId": "order.payment.proc.charge.reconcile",
      "toNodeId": "order.payment.view.charge.detail",
      "meta": {
        "fieldRefs": ["f.latest-status", "f.refund-status"]
      }
    }
  },
  "warnings": []
}
```