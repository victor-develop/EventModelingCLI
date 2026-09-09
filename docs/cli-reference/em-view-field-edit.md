# em view field edit

### Purpose

Update a field already present in a ViewModel schema.

### Syntax

```bash
em view field edit <viewModelId> <fieldId> ...
```

### Expected `data`

```json
{
  "field": {
    "fieldId": "f.refund-status",
    "name": "refundStatus",
    "type": "string",
    "nullable": true
  }
}
```

### Example

```bash
em view field edit order.payment.view.charge.detail f.refund-status --nullable
```

```json
{
  "ok": true,
  "command": "em view field edit",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "field": {
      "fieldId": "f.refund-status",
      "name": "refundStatus",
      "type": "string",
      "nullable": true
    }
  },
  "warnings": []
}
```