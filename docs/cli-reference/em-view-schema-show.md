# em view schema show

### Purpose

Show the full schema for a ViewModel.

### Syntax

```bash
em view schema show <viewModelId>
```

### Expected `data`

```json
{
  "viewModelId": "order.payment.view.charge.detail",
  "fields": [
    {
      "fieldId": "f.latest-status",
      "type": "string"
    },
    {
      "fieldId": "f.refund-status",
      "type": "string"
    }
  ]
}
```

### Example

```bash
em view schema show order.payment.view.charge.detail
```

```json
{
  "ok": true,
  "command": "em view schema show",
  "projectId": "proj_payments",
  "data": {
    "viewModelId": "order.payment.view.charge.detail",
    "fields": [
      {
        "fieldId": "f.latest-status",
        "type": "string"
      },
      {
        "fieldId": "f.refund-status",
        "type": "string"
      }
    ]
  },
  "warnings": []
}
```