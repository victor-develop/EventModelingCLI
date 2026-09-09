# em link cmd->evt

### Purpose

Create a `commandCausesEvent` edge.

### Syntax

```bash
em link cmd->evt <cmdId> <evtId>
```

### Expected `data`

```json
{
  "edge": {
    "id": "edge_501",
    "type": "commandCausesEvent",
    "fromNodeId": "order.refund.cmd.create-refund",
    "toNodeId": "order.refund.evt.refund.created"
  }
}
```

### Example

```bash
em link cmd->evt order.refund.cmd.create-refund order.refund.evt.refund.created
```

```json
{
  "ok": true,
  "command": "em link cmd->evt",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "edge": {
      "id": "edge_501",
      "type": "commandCausesEvent",
      "fromNodeId": "order.refund.cmd.create-refund",
      "toNodeId": "order.refund.evt.refund.created"
    }
  },
  "warnings": []
}
```