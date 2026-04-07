# em story confirm-bind

### Purpose

Confirm and persist a previously suggested story binding.

### Syntax

```bash
em story confirm-bind --story <id> --proposal <proposalId>
```

### Expected `data`

```json
{
  "confirmedProposalId": "proposal_001",
  "createdEdges": [
    {
      "id": "edge_301",
      "type": "storyOwnsCommand",
      "fromNodeId": "node_201",
      "toNodeId": "order.refund.cmd.create-refund"
    }
  ]
}
```

### Semantics

- This command performs the final mutation.
- It should only be used after human review or explicit agent approval policy.
- It is the normal persistence step after `em story suggest-bind` and zero or more `em story revise-bind` iterations.
- The proposal passed here should already represent the final intended story boundary.

### Example

```bash
em story confirm-bind --story node_201 --proposal proposal_001
```

```json
{
  "ok": true,
  "command": "em story confirm-bind",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "confirmedProposalId": "proposal_001",
    "createdEdges": [
      {
        "id": "edge_301",
        "type": "storyOwnsCommand",
        "fromNodeId": "node_201",
        "toNodeId": "order.refund.cmd.create-refund"
      }
    ]
  },
  "warnings": []
}
```