# em story suggest-bind

### Purpose

Propose how a story should bind to an existing modeling subgraph.

This command does **not** mutate the model. It resolves candidate root commands and previews the resulting story subgraph according to the hardcoded reachability rules.

### Syntax

```bash
em story suggest-bind --story <id> [--from-cmd <cmdId> ...] [--mode core|full]
```

### Expected `data`

```json
{
  "proposal": {
    "id": "proposal_001",
    "storyId": "node_201",
    "mode": "full",
    "candidateRootCommandIds": ["order.refund.cmd.create-refund"],
    "resolvedSubgraph": {
      "coreNodes": [
        "order.refund.cmd.create-refund",
        "order.refund.evt.refund.created",
        "order.payment.view.charge.detail"
      ],
      "interfaceNodes": [
        "role.customer",
        "ui.screen.payment.detail"
      ],
      "boundaryNodes": [
        "order.payment.proc.charge.reconcile"
      ]
    }
  }
}
```

### Semantics

- This command is for **binding a story to an existing modeling subgraph**.
- Output is a suggestion only.
- The normal next step is `em story revise-bind ...` if the proposal needs tuning.
- Only the final reviewed proposal should be passed to `em story confirm-bind ...`.

### Example

```bash
em story suggest-bind --story node_201 --from-cmd order.refund.cmd.create-refund --mode full
```

```json
{
  "ok": true,
  "command": "em story suggest-bind",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "proposal": {
      "id": "proposal_001",
      "storyId": "node_201",
      "mode": "full",
      "candidateRootCommandIds": ["order.refund.cmd.create-refund"],
      "resolvedSubgraph": {
        "coreNodes": [
          "order.refund.cmd.create-refund",
          "order.refund.evt.refund.created",
          "order.payment.view.charge.detail"
        ],
        "interfaceNodes": [
          "role.customer",
          "ui.screen.payment.detail"
        ],
        "boundaryNodes": [
          "order.payment.proc.charge.reconcile"
        ]
      }
    }
  },
  "warnings": []
}
```