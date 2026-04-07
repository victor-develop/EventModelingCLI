# em show

### Purpose

Show one node by `id` or `canonicalId`.

### Syntax

```bash
em show <nodeId|canonicalId>
```

### Expected `data`

```json
{
  "node": {
    "id": "order.payment.view.charge.detail",
    "kind": "viewModel",
    "canonicalId": "order.payment.view.charge.detail",
    "displayName": "Charge Detail"
  },
  "relations": {
    "incoming": ["edge_502"],
    "outgoing": ["edge_450"]
  }
}
```

### Example

```bash
em show order.payment.view.charge.detail
```

```json
{
  "ok": true,
  "command": "em show",
  "projectId": "proj_payments",
  "data": {
    "node": {
      "id": "order.payment.view.charge.detail",
      "kind": "viewModel",
      "canonicalId": "order.payment.view.charge.detail",
      "displayName": "Charge Detail"
    },
    "relations": {
      "incoming": ["edge_502"],
      "outgoing": ["edge_450"]
    }
  },
  "warnings": []
}
```