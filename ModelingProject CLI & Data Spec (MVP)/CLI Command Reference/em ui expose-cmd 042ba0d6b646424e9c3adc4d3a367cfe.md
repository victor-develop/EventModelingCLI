# em ui expose-cmd

### Purpose

Declare that a role uses a UI node to issue a command.

### Syntax

```bash
em ui expose-cmd --role <roleId> --ui <uiId> --cmd <cmdId>
```

### Expected `data`

```json
{
  "edge": {
    "id": "edge_451",
    "type": "roleUsesUIToIssueCommand",
    "fromNodeId": "role.customer",
    "toNodeId": "order.refund.cmd.create-refund",
    "viaNodeId": "node_410"
  }
}
```

### Example

```bash
em ui expose-cmd --role role.customer --ui node_410 --cmd order.refund.cmd.create-refund
```

```json
{
  "ok": true,
  "command": "em ui expose-cmd",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "edge": {
      "id": "edge_451",
      "type": "roleUsesUIToIssueCommand",
      "fromNodeId": "role.customer",
      "toNodeId": "order.refund.cmd.create-refund",
      "viaNodeId": "node_410"
    }
  },
  "warnings": []
}
```