# em proc new

### Purpose

Create a processor node.

### Syntax

```bash
em proc new <canonicalId>
```

### Expected `data`

```json
{
  "node": {
    "id": "order.payment.proc.charge.reconcile",
    "kind": "proc",
    "canonicalId": "order.payment.proc.charge.reconcile"
  }
}
```

### Example

```bash
em proc new order.payment.proc.charge.reconcile
```

```json
{
  "ok": true,
  "command": "em proc new",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "node": {
      "id": "order.payment.proc.charge.reconcile",
      "kind": "proc",
      "canonicalId": "order.payment.proc.charge.reconcile"
    }
  },
  "warnings": []
}
```