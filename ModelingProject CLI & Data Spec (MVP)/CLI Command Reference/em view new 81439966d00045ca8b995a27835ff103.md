# em view new

### Purpose

Create a ViewModel node.

### Syntax

```bash
em view new <canonicalId> [--name "displayName"]
```

### Expected `data`

```json
{
  "node": {
    "id": "order.payment.view.charge.detail",
    "kind": "viewModel",
    "canonicalId": "order.payment.view.charge.detail",
    "displayName": "Charge Detail"
  }
}
```

### Example

```bash
em view new order.payment.view.charge.detail --name "Charge Detail"
```

```json
{
  "ok": true,
  "command": "em view new",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "node": {
      "id": "order.payment.view.charge.detail",
      "kind": "viewModel",
      "canonicalId": "order.payment.view.charge.detail",
      "displayName": "Charge Detail"
    }
  },
  "warnings": []
}
```