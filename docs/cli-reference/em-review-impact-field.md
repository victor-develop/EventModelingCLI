# em review impact field

### Purpose

Show which UI nodes or processors consume one ViewModel field.

### Syntax

```bash
em review impact field <viewModelId> <fieldId>
```

### Expected `data`

```json
{
  "viewModelId": "order.payment.view.charge.detail",
  "fieldId": "f.refund-status",
  "consumers": {
    "ui": ["ui.section.payment.detail.refund-status"],
    "proc": ["order.payment.proc.charge.reconcile"]
  }
}
```

### Example

```bash
em review impact field order.payment.view.charge.detail f.refund-status
```

```json
{
  "ok": true,
  "command": "em review impact field",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "viewModelId": "order.payment.view.charge.detail",
    "fieldId": "f.refund-status",
    "consumers": {
      "ui": ["ui.section.payment.detail.refund-status"],
      "proc": ["order.payment.proc.charge.reconcile"]
    }
  },
  "warnings": []
}
```