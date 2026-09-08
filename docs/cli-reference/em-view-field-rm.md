# em view field rm

### Purpose

Remove a field from a ViewModel schema.

### Syntax

```bash
em view field rm <viewModelId> <fieldId>
```

### Expected `data`

```json
{
  "removedFieldId": "f.refund-status",
  "viewModelId": "order.payment.view.charge.detail"
}
```

### Example

```bash
em view field rm order.payment.view.charge.detail f.refund-status
```

```json
{
  "ok": true,
  "command": "em view field rm",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "removedFieldId": "f.refund-status",
    "viewModelId": "order.payment.view.charge.detail"
  },
  "warnings": []
}
```