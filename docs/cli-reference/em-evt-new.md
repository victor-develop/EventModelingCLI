# em evt new

### Purpose

Create an event node.

### Syntax

```bash
em evt new <canonicalId> [--name "displayName"]
```

### Expected `data`

```json
{
  "node": {
    "id": "order.refund.evt.refund.created",
    "kind": "evt",
    "canonicalId": "order.refund.evt.refund.created",
    "displayName": "Refund Created"
  }
}
```

### Example

```bash
em evt new order.refund.evt.refund.created --name "Refund Created"
```

```json
{
  "ok": true,
  "command": "em evt new",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "node": {
      "id": "order.refund.evt.refund.created",
      "kind": "evt",
      "canonicalId": "order.refund.evt.refund.created",
      "displayName": "Refund Created"
    }
  },
  "warnings": []
}
```