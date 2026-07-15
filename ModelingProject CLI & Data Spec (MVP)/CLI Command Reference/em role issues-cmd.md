# em role issues-cmd

Connect a role to a command through the surface the role uses to issue it.

This creates an event-modeling edge of type `roleIssuesCommand`. The edge keeps the role as `fromNodeId`, the command as `toNodeId`, and stores the UI or API surface in `viaNodeId`.

## Syntax

```bash
em role issues-cmd --role <roleId> --via <uiOrProcId> --cmd <cmdId>
```

## Output

```json
{
  "edge": {
    "id": "edge_410",
    "type": "roleIssuesCommand",
    "fromNodeId": "role.buyer",
    "toNodeId": "return.cmd.request-return",
    "viaNodeId": "ui.screen.buyer-return-portal"
  }
}
```

## Examples

```bash
em role issues-cmd --role role.buyer --via ui.screen.buyer-return-portal --cmd return.cmd.request-return
```

```bash
em role issues-cmd --role role.buyer --via return.proc.public-api --cmd return.cmd.request-return
```

```json
{
  "ok": true,
  "command": "em role issues-cmd",
  "projectId": "proj_returns",
  "draftId": "draft_001",
  "data": {
    "edge": {
      "id": "edge_410",
      "type": "roleIssuesCommand",
      "fromNodeId": "role.buyer",
      "toNodeId": "return.cmd.request-return",
      "viaNodeId": "return.proc.public-api"
    }
  },
  "warnings": []
}
```
