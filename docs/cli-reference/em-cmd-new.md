# em cmd new

### Purpose

Create a command node.

### Syntax

```bash
em cmd new <canonicalId> [--name "displayName"]
```

### Expected `data`

```json
{
  "node": {
    "id": "order.refund.cmd.create-refund",
    "kind": "cmd",
    "canonicalId": "order.refund.cmd.create-refund",
    "displayName": "Create Refund"
  }
}
```

### Example

```bash
em cmd new order.refund.cmd.create-refund --name "Create Refund"
```

```json
{
  "ok": true,
  "command": "em cmd new",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "node": {
      "id": "order.refund.cmd.create-refund",
      "kind": "cmd",
      "canonicalId": "order.refund.cmd.create-refund",
      "displayName": "Create Refund"
    }
  },
  "warnings": []
}
```