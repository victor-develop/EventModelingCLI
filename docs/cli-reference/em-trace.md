# em trace

### Purpose

Find a path between two nodes.

This is the low-level primitive an agent uses to inspect or materialize the subgraphs that belong to a story.

### Syntax

```bash
em trace --from <id> --to <id> [--max-hops N]
```

### Expected `data`

```json
{
  "paths": [
    [
      "role.customer",
      "edge_451",
      "order.refund.cmd.create-refund",
      "edge_501",
      "order.refund.evt.refund.created",
      "edge_502",
      "order.payment.view.charge.detail"
    ]
  ]
}
```

### Semantics

- A story subgraph can be derived as the union of the relevant traces reachable from that story's bound commands.
- `em trace` is therefore a graph inspection primitive, not just a debugging command.

### Example

```bash
em trace --from role.customer --to order.payment.view.charge.detail --max-hops 6
```

```json
{
  "ok": true,
  "command": "em trace",
  "projectId": "proj_payments",
  "data": {
    "paths": [
      [
        "role.customer",
        "edge_451",
        "order.refund.cmd.create-refund",
        "edge_501",
        "order.refund.evt.refund.created",
        "edge_502",
        "order.payment.view.charge.detail"
      ]
    ]
  },
  "warnings": []
}
```