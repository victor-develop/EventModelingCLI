# em view field add

### Purpose

Add a field to a ViewModel schema.

### Syntax

```bash
em view field add <viewModelId> --field-id <fieldId> --name "..." --type "..." --from-event <evtId> --path "payload...." [--nullable]
```

### Expected `data`

```json
{
  "field": {
    "fieldId": "f.refund-status",
    "name": "refundStatus",
    "type": "string",
    "nullable": false,
    "source": {
      "eventNodeId": "order.refund.evt.refund.status-updated",
      "eventFieldPath": "payload.refund.status"
    }
  }
}
```

### Example

```bash
em view field add order.payment.view.charge.detail --field-id f.refund-status --name "refundStatus" --type "string" --from-event order.refund.evt.refund.status-updated --path "payload.refund.status"
```

```json
{
  "ok": true,
  "command": "em view field add",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "field": {
      "fieldId": "f.refund-status",
      "name": "refundStatus",
      "type": "string",
      "nullable": false,
      "source": {
        "eventNodeId": "order.refund.evt.refund.status-updated",
        "eventFieldPath": "payload.refund.status"
      }
    }
  },
  "warnings": []
}
```